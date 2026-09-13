/**
 * PentimentoRecorder — turns TipTap/ProseMirror transactions into COALESCED writing
 * ops (runs), not raw keystrokes, and batches them to the backend. This is what keeps a
 * full novel's process history in the low tens of MB.
 *
 * Op types: 'insert' | 'paste' | 'delete' | 'pause'.
 * A "run" is a stretch of same-type edits in one paragraph with no long pause between
 * them; we only flush the run (with its accumulated text + wall-clock duration) when the
 * paragraph changes, the edit type flips, a pause happens, or it grows too long.
 *
 * Defensive by design: every API call is wrapped so telemetry can never break editing.
 */

const PAUSE_MS = 2500        // gap that becomes its own 'pause' op
const PAUSE_CAP_MS = 10 * 60 * 1000 // don't count more than 10 min of idle as one pause
const RUN_MAX_CHARS = 80     // flush a run once it grows past this
const RUN_MAX_MS = 20000     // or once it spans this long
const PASTE_CHARS = 40       // single step inserting > this is treated as a paste
const FLUSH_COUNT = 40       // flush the op buffer to disk every N ops
const FLUSH_MS = 12000       // …or every N ms
const ANCHOR_EVERY_MS = 10 * 60 * 1000 // Sealed Pentimento: anchor rolling head every 10 min of active typing

// Same fingerprint format the backend seals with (pentimento.py session_end) so a
// verifier can recompute every rolling head from the stored ops.
function opFingerprint(op) {
  return `${op.op_type}|${op.para_index}|${op.char_offset}|${op.length}|${op.text_content || ''}|${op.timestamp}`
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function clamp(pos, size) { return Math.max(0, Math.min(pos, size)) }

// Paragraph index + in-paragraph offset for a doc position.
function locate(doc, pos) {
  try {
    const $p = doc.resolve(clamp(pos, doc.content.size))
    return { para: $p.index(0), offset: $p.parentOffset }
  } catch {
    return { para: 0, offset: 0 }
  }
}

export default class PentimentoRecorder {
  constructor(api) {
    this.api = api
    this.projectPath = null
    this.chapterId = null
    this.sessionId = null
    this.enabled = false
    this.pending = null        // { type, para, offset, text, tStart, tLast }
    this.buffer = []           // ops awaiting flush
    this.lastEventTime = 0
    this._flushTimer = null
    this._starting = null
    // Sealed Pentimento state
    this._seq = 0              // insertion order for deterministic op ordering
    this._headChain = Promise.resolve('')  // rolling head, updated after each flush
    this._lastAnchorTime = 0
    this._lastAnchorHash = null
    this._headDirty = false    // ops flushed since the last anchor
  }

  _verificationOn() {
    try { return localStorage.getItem('fn_pentimento_verification') === 'true' } catch { return false }
  }

  async start(projectPath, chapterId, enabled) {
    // switching chapters (or restarting) → seal the old session first
    if (this.sessionId && (chapterId !== this.chapterId || projectPath !== this.projectPath)) {
      await this.stop()
    }
    this.projectPath = projectPath
    this.chapterId = chapterId
    this.enabled = !!enabled
    this.pending = null
    this.buffer = []
    this.lastEventTime = 0
    this._seq = 0
    this._headChain = Promise.resolve('')
    this._lastAnchorTime = Date.now()
    this._lastAnchorHash = null
    this._headDirty = false
    // NOTE: the backend session is created lazily on the first real op (see
    // _ensureSession), so merely opening a chapter never spawns an empty session.
    if (this.enabled) this._armFlush()
  }

  // Create the backend session on demand — only once there's something to record.
  _ensureSession() {
    if (this.sessionId || !this.enabled || this._starting || !this.chapterId) return
    const pp = this.projectPath, ch = this.chapterId
    this._starting = this.api.pentimentoSessionStart({ project_path: pp, chapter_id: ch })
      .then(res => {
        this.sessionId = res?.session_id || null
        // seed the rolling head with the previous session's chain hash
        this._headChain = Promise.resolve(res?.previous_session_hash || '')
      })
      .catch(() => { this.sessionId = null })
      .finally(() => { this._starting = null })
  }

  // Called from the editor's onUpdate for every doc-changing transaction.
  onTransaction(transaction) {
    if (!this.enabled || !transaction?.docChanged) return
    this._ensureSession()
    const now = Date.now()
    const gap = this.lastEventTime ? now - this.lastEventTime : 0

    if (gap > PAUSE_MS) {
      const where = this._pendingPara()
      this._flushPending()
      this.buffer.push({
        timestamp: new Date().toISOString(), op_type: 'pause',
        para_index: where, char_offset: 0, length: 0, text_content: null,
        duration_ms: Math.min(gap, PAUSE_CAP_MS),
        seq: this._seq++,
      })
    }
    this.lastEventTime = now

    const before = transaction.before
    const after = transaction.doc
    for (const step of transaction.steps) {
      const s = step.toJSON?.()
      if (!s || (s.stepType !== 'replace' && s.stepType !== 'replaceAround')) continue
      const from = step.from, to = step.to
      const insertedSize = step.slice ? step.slice.size : 0
      const deletedSize = Math.max(0, to - from)

      if (deletedSize > 0) {
        let delText = ''
        try { delText = before.textBetween(from, to, '\n', '') } catch { /* noop */ }
        const loc = locate(before, from)
        this._appendDelete(loc.para, loc.offset, delText, deletedSize, now)
      }
      if (insertedSize > 0) {
        let insText = ''
        try { insText = step.slice.content.textBetween(0, step.slice.content.size, '\n', '') } catch { /* noop */ }
        const loc = locate(after, from + insertedSize)
        const type = insertedSize > PASTE_CHARS ? 'paste' : 'insert'
        this._appendInsert(type, loc.para, loc.offset - insText.length, insText, now)
      }
    }

    if (this.buffer.length >= FLUSH_COUNT) this._flush()
  }

  _pendingPara() { return this.pending ? this.pending.para : 0 }

  _appendInsert(type, para, offset, text, now) {
    const p = this.pending
    const contiguous = p && p.type !== 'delete' && p.para === para &&
      (now - p.tStart) < RUN_MAX_MS && p.text.length < RUN_MAX_CHARS && type !== 'paste'
    if (contiguous) {
      p.text += text
      p.tLast = now
    } else {
      this._flushPending()
      this.pending = { type, para, offset: Math.max(0, offset), text, tStart: now, tLast: now }
    }
    if (this.pending.text.length >= RUN_MAX_CHARS) this._flushPending()
  }

  _appendDelete(para, offset, text, size, now) {
    const p = this.pending
    const contiguous = p && p.type === 'delete' && p.para === para &&
      (now - p.tStart) < RUN_MAX_MS && (p.length || 0) < RUN_MAX_CHARS
    if (contiguous) {
      // backspacing removes the char just before the previous deletion → prepend text
      p.text = (text || '') + (p.text || '')
      p.length = (p.length || 0) + size
      p.offset = offset
      p.tLast = now
    } else {
      this._flushPending()
      this.pending = { type: 'delete', para, offset: Math.max(0, offset), text: text || '', length: size, tStart: now, tLast: now }
    }
    if ((this.pending.length || 0) >= RUN_MAX_CHARS) this._flushPending()
  }

  _flushPending() {
    const p = this.pending
    this.pending = null
    if (!p) return
    const length = (p.length != null) ? p.length : (p.text ? p.text.length : 0)
    if (!length) return
    this.buffer.push({
      timestamp: new Date(p.tLast).toISOString(), op_type: p.type,
      para_index: p.para, char_offset: Math.max(0, p.offset || 0),
      length, text_content: p.text || null,
      duration_ms: Math.max(0, p.tLast - p.tStart),
      seq: this._seq++,
    })
  }

  _armFlush() {
    if (this._flushTimer) return
    this._flushTimer = setInterval(() => {
      this._flush()
      this._maybeAnchorHead()
    }, FLUSH_MS)
  }

  async _flush() {
    this._flushPending()
    if (!this.sessionId || this.buffer.length === 0) return
    // Same ordering the backend seals with (ORDER BY timestamp, rowid): rows are
    // inserted in this sorted order, so rowid ties break identically.
    const ops = this.buffer.slice().sort((a, b) =>
      (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.seq - b.seq))
    this.buffer = []
    try {
      await this.api.pentimentoFlush({
        project_path: this.projectPath, session_id: this.sessionId,
        chapter_id: this.chapterId, ops,
      })
      this._advanceHead(ops)
    } catch {
      // put them back so a transient failure doesn't lose the run
      this.buffer = ops.concat(this.buffer)
    }
  }

  // Rolling head = SHA256(prev chain state + flushed fingerprints). Advanced only
  // after a confirmed flush so head hashes always correspond to persisted ops.
  _advanceHead(ops) {
    if (!this._verificationOn() || !ops.length) return
    const fps = ops.map(opFingerprint).join('')
    this._headChain = this._headChain
      .then(prev => sha256Hex((prev || '') + fps))
      .then(head => { this._headDirty = true; return head })
      .catch(() => '')
  }

  // Called on the flush interval: every 10 min of active typing, anchor the
  // current rolling head so fake sessions appended after an honest seal break.
  async _maybeAnchorHead() {
    if (!this._verificationOn() || !this.sessionId) return
    const now = Date.now()
    if (now - this._lastAnchorTime < ANCHOR_EVERY_MS) return
    if (!this._headDirty) return
    this._lastAnchorTime = now
    this._headDirty = false
    try {
      const head = await this._headChain
      if (!head || !this.sessionId) return
      const res = await this.api.pentimentoAnchorHead({
        project_path: this.projectPath, session_id: this.sessionId,
        chapter_id: this.chapterId, rolling_head: head,
        previous_hash: this._lastAnchorHash,
      })
      if (res?.status === 'ok') {
        this._lastAnchorHash = head
        this._lastAnchorTime = Date.now()
      } else if (res?.status === 'disabled') {
        // project opted out — stop asking until the next session
        this._headDirty = false
        this._lastAnchorTime = now + ANCHOR_EVERY_MS
      }
    } catch { /* TSA down → receipt simply isn't created this round */ }
  }

  async stop() {
    if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null }
    if (this._starting) { try { await this._starting } catch { /* noop */ } }
    const sid = this.sessionId
    await this._flush()
    this.sessionId = null
    this.pending = null
    this.lastEventTime = 0
    this._seq = 0
    this._headChain = Promise.resolve('')
    this._lastAnchorTime = 0
    this._lastAnchorHash = null
    this._headDirty = false
    if (sid) {
      try { await this.api.pentimentoSessionEnd({ project_path: this.projectPath, session_id: sid }) } catch { /* noop */ }
    }
  }
}
