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
    // Input provenance hint, set by the editor's beforeinput handler just before the
    // transaction lands ('text' = hardware keyboard/IME, 'paste' = paste/drop,
    // 'undo' = undo/redo, 'spell' = spellcheck/autocomplete). Absent hint + inserted
    // text = programmatic insert (entity chips, AI, IDE features) → 'machine'.
    this._inputHint = null
    // Sealed Pentimento state
    this._seq = 0              // insertion order for deterministic op ordering
    this._headChain = Promise.resolve('')  // rolling head, updated after each flush
    this._lastAnchorTime = 0
    this._lastAnchorHash = null
    this._headDirty = false    // ops flushed since the last anchor
    // Per-word typing-speed trace (replay pacing): [para, wordOffset, wpm] triples.
    // para/wordOffset are computed live from the TipTap doc at typing time, so a
    // deletion mid-sentence needs no bookkeeping — the next word's offset simply
    // self-corrects. _wpmT anchors the current word's clock (last completion or
    // flow start); _wpmChars counts chars since it.
    this._wpmT = 0
    this._wpmChars = 0
    this._wpmSamples = []      // authoritative trace; resent whole on every flush
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
    this._wpmT = Date.now()
    this._wpmChars = 0
    this._wpmSamples = []
    this._inputHint = null
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

  // Called from the editor's editorProps.handleDOMEvents.beforeinput with the DOM
  // inputType, so the next transaction can be classified by how it was really typed.
  static sourceForInputType(inputType) {
    switch (inputType) {
      case 'insertText':
      case 'insertCompositionText':
      case 'insertFromYank':
        return 'text'
      case 'insertFromPaste':
      case 'insertFromDrop':
        return 'paste'
      case 'historyUndo':
      case 'historyRedo':
        return 'undo'
      case 'insertReplacementText':
        return 'spell'
      default:
        return null
    }
  }

  hint(source) { this._inputHint = source }

  // Classify one doc-changing transaction's provenance.
  _resolveSource(transaction) {
    const hint = this._inputHint
    this._inputHint = null
    if (hint === 'text' || hint === 'undo') return 'human'
    if (hint === 'paste') return 'paste'
    if (hint === 'spell') return 'machine'
    try {
      if (transaction.getMeta && transaction.getMeta('history$') !== undefined) return 'human'
      const uiEvent = transaction.getMeta && transaction.getMeta('uiEvent')
      if (uiEvent === 'paste' || uiEvent === 'drop') return 'paste'
    } catch { /* noop */ }
    return 'machine'
  }

  // Called from the editor's onUpdate for every doc-changing transaction.
  onTransaction(transaction) {
    if (!this.enabled || !transaction?.docChanged) return
    this._ensureSession()
    const source = this._resolveSource(transaction)
    const now = Date.now()
    const gap = this.lastEventTime ? now - this.lastEventTime : 0

    if (gap > PAUSE_MS) {
      const where = this._pendingPara()
      this._flushPending()
      this.buffer.push({
        timestamp: new Date().toISOString(), op_type: 'pause',
        para_index: where, char_offset: 0, length: 0, text_content: null,
        duration_ms: Math.min(gap, PAUSE_CAP_MS),
        source: 'human',
        seq: this._seq++,
      })
      // idle time must not deflate the next words' WPM — restart the word clock
      this._wpmChars = 0
      this._wpmT = now
    }
    this.lastEventTime = now

    const before = transaction.before
    const after = transaction.doc
    const wpmChunks = []   // { para, start, text } per insert step, for WPM sampling
    let hadPaste = false
    let hadDelete = false
    let wpmChars = 0
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
        this._appendDelete(loc.para, loc.offset, delText, deletedSize, now, source)
        hadDelete = true
      }
      if (insertedSize > 0) {
        let insText = ''
        try { insText = step.slice.content.textBetween(0, step.slice.content.size, '\n', '') } catch { /* noop */ }
        const loc = locate(after, from + insertedSize)
        const type = insertedSize > PASTE_CHARS ? 'paste' : 'insert'
        // a paste is a paste regardless of how the DOM delivered it
        this._appendInsert(type, loc.para, loc.offset - insText.length, insText, now, type === 'paste' ? 'paste' : source)
        wpmChunks.push({ para: loc.para, start: Math.max(0, loc.offset - insText.length), text: insText, paste: type === 'paste' })
        wpmChars += insText.length
      }
    }

    this._sampleWpm(after, wpmChunks, wpmChars, hadDelete, now)

    if (this.buffer.length >= FLUSH_COUNT) this._flush()
  }

  // Per-word typing-speed sampling: one [para, wordOffset, wpm] triple per completed
  // word, where the offset is the word's index within its paragraph as of typing time
  // (read from the live doc, so later deletions never require fixing up old samples).
  // Deletions and pauses restart the clock so their dead time never pollutes the next
  // word's speed; pastes emit cap-speed samples (still word-aligned). The whole trace
  // is resent on every flush, making the recorder authoritative over what's stored.
  _sampleWpm(doc, chunks, totalChars, hadDelete, now) {
    if (hadDelete) {
      this._wpmChars = 0
      this._wpmT = now
    }
    if (!chunks.length) return

    // Words completed in this transaction = tokens terminated by a whitespace run
    // inside the inserted chunks. A token may start before the chunk (continuation).
    // Pasted chunks emit one cap-speed sample per token regardless of trailing ws.
    const words = []   // { para, ws: word-start index within the paragraph, cap? }
    for (const c of chunks) {
      let paraText = ''
      try { paraText = doc.child(c.para)?.textContent || '' } catch { paraText = '' }
      if (c.paste) {
        const tokRe = /\S+/g
        let t
        while ((t = tokRe.exec(c.text)) !== null) {
          words.push({ para: c.para, ws: c.start + t.index, cap: true })
        }
        continue
      }
      const re = /\s+/g
      let m
      while ((m = re.exec(c.text)) !== null) {
        const endPara = c.start + m.index        // first whitespace char of the run
        if (endPara === 0) continue
        let ts = endPara - 1
        while (ts > 0 && !/\s/.test(paraText[ts - 1] || ' ')) ts--
        words.push({ para: c.para, ws: ts })
      }
    }
    if (!words.length) return

    const completed = words.length
    const trailing = (() => {
      const last = chunks[chunks.length - 1]
      const m = last.text.match(/(\s+)(\S*)$/)
      return m ? m[2].length : 0
    })()
    const doneChars = Math.max(1, this._wpmChars + totalChars - trailing)
    const dtTotal = Math.max(1, now - (this._wpmT || now))
    const dtPer = dtTotal / completed
    const avgLen = doneChars / completed
    const wpm = Math.max(10, Math.min(300, Math.round(((avgLen + 1) / 5) / (dtPer / 60000))))

    for (const w of words) {
      let idx = 0
      try {
        const paraText = doc.child(w.para)?.textContent || ''
        const prefix = paraText.slice(0, w.ws)
        idx = (prefix.match(/\S+/g) || []).length
        // prefix cut mid-token (continuation word) → that partial token isn't a
        // completed word yet; don't count it
        if (w.ws > 0 && !/\s/.test(paraText[w.ws - 1] || ' ')) idx -= 1
      } catch { /* noop */ }
      this._wpmSamples.push([w.para, Math.max(0, idx), w.cap ? 300 : wpm])
    }
    if (this._wpmSamples.length > 50000) this._wpmSamples = this._wpmSamples.slice(-50000)
    this._wpmChars = trailing
    this._wpmT = now
  }

  _pendingPara() { return this.pending ? this.pending.para : 0 }

  _appendInsert(type, para, offset, text, now, source) {
    const p = this.pending
    const contiguous = p && p.type !== 'delete' && p.source === source && p.para === para &&
      (now - p.tStart) < RUN_MAX_MS && p.text.length < RUN_MAX_CHARS && type !== 'paste'
    if (contiguous) {
      p.text += text
      p.tLast = now
    } else {
      this._flushPending()
      this.pending = { type, para, offset: Math.max(0, offset), text, tStart: now, tLast: now, source }
    }
    if (this.pending.text.length >= RUN_MAX_CHARS) this._flushPending()
  }

  _appendDelete(para, offset, text, size, now, source) {
    const p = this.pending
    const contiguous = p && p.type === 'delete' && p.source === source && p.para === para &&
      (now - p.tStart) < RUN_MAX_MS && (p.length || 0) < RUN_MAX_CHARS
    if (contiguous) {
      // backspacing removes the char just before the previous deletion → prepend text
      p.text = (text || '') + (p.text || '')
      p.length = (p.length || 0) + size
      p.offset = offset
      p.tLast = now
    } else {
      this._flushPending()
      this.pending = { type: 'delete', para, offset: Math.max(0, offset), text: text || '', length: size, tStart: now, tLast: now, source }
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
      source: p.source || 'human',
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
    if (!this.sessionId || (this.buffer.length === 0 && this._wpmSamples.length === 0)) return
    // Same ordering the backend seals with (ORDER BY timestamp, rowid): rows are
    // inserted in this sorted order, so rowid ties break identically.
    const ops = this.buffer.slice().sort((a, b) =>
      (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.seq - b.seq))
    this.buffer = []
    try {
      await this.api.pentimentoFlush({
        project_path: this.projectPath, session_id: this.sessionId,
        chapter_id: this.chapterId, ops,
        // The recorder owns the trace: each flush replaces the stored copy so
        // word offsets always reflect the latest deletions.
        wpm_trace: this._wpmSamples.length ? this._wpmSamples : undefined,
      })
      if (ops.length) this._advanceHead(ops)
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
    this._wpmT = 0
    this._wpmChars = 0
    this._wpmSamples = []
    this._inputHint = null
    if (sid) {
      try { await this.api.pentimentoSessionEnd({ project_path: this.projectPath, session_id: sid }) } catch { /* noop */ }
    }
  }
}
