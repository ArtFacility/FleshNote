/**
 * PentimentoRecorder — turns TipTap/ProseMirror transactions into COALESCED writing
 * ops (runs), not raw keystrokes, and batches them to the backend. This is what keeps a
 * full novel's process history in the low tens of MB.
 *
 * Op types: 'insert' | 'paste' | 'delete' | 'pause'.
 * A "run" is a stretch of same-type edits at one place with no long pause between
 * them; we only flush the run (with its accumulated text + wall-clock duration) when the
 * writer moves elsewhere, the edit type flips, a pause happens, or it grows too long.
 *
 * Coordinates use a flat text model of the chapter: top-level blocks joined with '\n',
 * inline leaf nodes (hard breaks, images) as U+FFFC. An op's (para_index, char_offset)
 * is where it starts in that text, its text_content is exactly what was inserted or
 * removed ('\n' = a paragraph break), and length is the text's length. Applying a
 * session's ops in order to the text it started from reproduces the text it ended with.
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
const HINT_TTL_MS = 500      // an input hint only explains a transaction that follows it closely
const STASH_KEY = 'fn_pentimento_stash'
const STASH_EVERY_MS = 1000  // unsent ops are backed up at most this often
const STASH_MAX_TRIES = 3    // give up on a crash stash the backend keeps refusing

export const LEAF_CHAR = '￼'

// Same fingerprint format the backend seals with (pentimento.py) so a verifier can
// recompute every rolling head from the stored ops.
function opFingerprint(op) {
  return `${op.op_type}|${op.para_index}|${op.char_offset}|${op.length}|${op.text_content || ''}|${op.timestamp}`
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function clamp(pos, size) { return Math.max(0, Math.min(pos, size)) }

// ── Flat text model ─────────────────────────────────────────────────────────
// Docs and their unchanged blocks are shared between transactions, so both caches
// make a keystroke cost one block's text plus a join.
const blockTextCache = new WeakMap()
function blockText(node) {
  let s = blockTextCache.get(node)
  if (s === undefined) {
    s = node.textBetween(0, node.content.size, '', LEAF_CHAR)
    blockTextCache.set(node, s)
  }
  return s
}

const flatCache = new WeakMap()
export function flatInfo(doc) {
  let f = flatCache.get(doc)
  if (f) return f
  const texts = []
  const starts = []
  let n = 0
  doc.forEach((child) => {
    const t = blockText(child)
    starts.push(n)
    texts.push(t)
    n += t.length + 1
  })
  f = { texts, starts, flat: texts.join('\n') }
  flatCache.set(doc, f)
  return f
}

// Flat offset of a doc position (where a step starts). Positions between blocks map
// to the separator before the next block.
function flatHint(doc, info, pos) {
  try {
    const $p = doc.resolve(clamp(pos, doc.content.size))
    const i = $p.index(0)
    if ($p.depth === 0) return i < info.starts.length ? Math.max(0, info.starts[i] - 1) : info.flat.length
    return info.starts[i] + doc.child(i).textBetween(0, pos - $p.start(1), '', LEAF_CHAR).length
  } catch {
    return 0
  }
}

// The single change turning a into b, starting no later than `hint` (which decides
// where a typed letter went when it repeats its neighbour).
export function flatDiff(a, b, hint) {
  const maxS = Math.min(hint, a.length, b.length)
  let s = 0
  while (s < maxS && a.charCodeAt(s) === b.charCodeAt(s)) s++
  const maxE = Math.min(a.length, b.length) - s
  let e = 0
  while (e < maxE && a.charCodeAt(a.length - 1 - e) === b.charCodeAt(b.length - 1 - e)) e++
  return { s, del: a.slice(s, a.length - e), ins: b.slice(s, b.length - e) }
}

// Paragraph index + in-paragraph offset of a flat offset.
export function flatLocate(info, s) {
  let lo = 0
  let hi = info.starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (info.starts[mid] <= s) lo = mid
    else hi = mid - 1
  }
  return { para: Math.max(0, lo), offset: Math.max(0, s - (info.starts[lo] || 0)) }
}

// ── Crash backup ────────────────────────────────────────────────────────────
// Ops not yet confirmed by the backend, per session: { [sessionId]: { project_path,
// chapter_id, ops, tries } }. The main process keeps it on disk; localStorage is the
// fallback when that bridge is missing.
async function readStash(api) {
  try {
    if (api?.pentimentoStashRead) return (await api.pentimentoStashRead()) || {}
    return JSON.parse(localStorage.getItem(STASH_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

// Everything one recording session accumulates. A session that is being sealed
// keeps its own state while new typing already goes to the next one.
function newSession(projectPath, chapterId, enabled) {
  return {
    projectPath, chapterId, enabled: !!enabled,
    sessionId: null, starting: null, closed: false,
    pending: null,           // { type, flat, para, offset, text, tStart, tLast, source }
    buffer: [],              // ops awaiting flush
    inflight: [],            // ops sent but not yet confirmed
    seq: 0,                  // insertion order for deterministic op ordering
    flushChain: Promise.resolve(),
    lastEventTime: 0,
    lastDoc: null,           // doc after the last recorded transaction
    // Sealed Pentimento
    headChain: Promise.resolve(''), // rolling head, updated after each flush
    lastAnchorTime: Date.now(),
    lastAnchorHash: null,
    headDirty: false,        // ops flushed since the last anchor
    // Per-word typing-speed trace (replay pacing): [para, wordOffset, wpm] triples.
    // para/wordOffset are computed live from the doc at typing time, so a deletion
    // mid-sentence needs no bookkeeping — the next word's offset simply self-corrects.
    // wpmT anchors the current word's clock (last completion or flow start);
    // wpmChars counts chars since it.
    wpmT: 0,
    wpmChars: 0,
    wpmSamples: [],          // authoritative trace; resent whole on every flush
    wpmDirty: false,
  }
}

export default class PentimentoRecorder {
  constructor(api) {
    this.api = api
    this.s = newSession(null, null, false)
    this._flushTimer = null
    this._sealing = Promise.resolve()   // sessions being closed, one after another
    this._stash = {}
    this._recovering = null
    this._recovered = false
    this._lastStash = 0
    // Input provenance hint, set by the editor just before the transaction lands:
    // 'text' = hardware keyboard/IME, 'paste' = paste/drop, 'undo' = undo/redo,
    // 'spell' = spellcheck/autocomplete, 'key' = Enter/Backspace/Delete pressed.
    // Absent hint + inserted text = programmatic insert (entity chips, AI, IDE
    // features) → 'machine'.
    this._inputHint = null
  }

  _verificationOn() {
    try { return localStorage.getItem('fn_pentimento_verification') === 'true' } catch { return false }
  }

  // Record into `chapterId` from now on. The session being left is sealed in the
  // background once `beforeSeal` (the editor saving that chapter) has settled, so
  // its closing snapshot holds the last keystrokes.
  start(projectPath, chapterId, enabled, { beforeSeal } = {}) {
    const done = this._detach(beforeSeal)
    this.s = newSession(projectPath, chapterId, enabled)
    // A previous run that crashed or was killed may have left unsent ops behind;
    // deliver and seal them before this run opens a session of its own.
    if (!this._recovered && !this._recovering) {
      this._recovering = this._recoverStash().finally(() => { this._recovering = null; this._recovered = true })
    }
    if (enabled) this._armFlush()
    else this._disarmFlush()
    // NOTE: the backend session is created lazily on the first real op (see
    // _ensureSession), so merely opening a chapter never spawns an empty session.
    return done
  }

  // Seal the current session (after `beforeSeal` settles) and record nothing more.
  stop({ beforeSeal } = {}) {
    this._disarmFlush()
    const done = this._detach(beforeSeal)
    this.s = newSession(null, null, false)
    return done
  }

  _detach(beforeSeal) {
    const st = this.s
    st.closed = true
    this._flushPending(st)
    if (st.sessionId || st.starting) {
      this._sealing = this._sealing.then(() => this._seal(st, beforeSeal)).catch(() => {})
    }
    return this._sealing
  }

  async _seal(st, beforeSeal) {
    if (st.starting) { try { await st.starting } catch { /* noop */ } }
    if (!st.sessionId) return
    await this._flush(st)
    try { await beforeSeal } catch { /* a failed save still gets its session sealed */ }
    // If the last flush failed, the stash still holds those ops: leave the session
    // open so the next start delivers them and seals it then.
    if (st.buffer.length) return
    try {
      await this.api.pentimentoSessionEnd({ project_path: st.projectPath, session_id: st.sessionId })
      this._dropStash(st.sessionId)
    } catch { /* noop: the backend seals a dangling session when the next one starts */ }
  }

  async _recoverStash() {
    const found = await readStash(this.api)
    for (const [sid, e] of Object.entries(found)) {
      if (!e?.project_path) continue
      try {
        if (e.ops?.length) {
          await this.api.pentimentoFlush({
            project_path: e.project_path, session_id: sid,
            chapter_id: e.chapter_id, ops: e.ops, recovery: true,
          })
        }
        await this.api.pentimentoSessionEnd({ project_path: e.project_path, session_id: sid })
      } catch {
        // Unknown or already sealed session → nothing left to save. Otherwise retry
        // on a later start, a few times at most.
        const tries = (e.tries || 0) + 1
        if (tries < STASH_MAX_TRIES) this._stash[sid] = { ...e, tries }
      }
    }
    this._saveStash()
  }

  // Create the backend session on demand — only once there's something to record.
  _ensureSession(st) {
    if (st.sessionId || !st.enabled || st.starting || !st.chapterId || st.closed) return
    st.starting = Promise.all([this._recovering, this._sealing])
      .then(() => this.api.pentimentoSessionStart({ project_path: st.projectPath, chapter_id: st.chapterId }))
      .then(res => {
        st.sessionId = res?.session_id || null
        // seed the rolling head with the previous session's chain hash
        st.headChain = Promise.resolve(res?.previous_session_hash || '')
      })
      .catch(() => { st.sessionId = null })
      .finally(() => { st.starting = null })
  }

  // Called from the editor's beforeinput/keydown handlers with how the next
  // transaction is being typed (see sourceForInputType).
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

  hint(source) { this._inputHint = { source, t: Date.now() } }

  // Classify one transaction's provenance. 'key' is resolved per change: a pressed
  // Enter/Backspace/Delete only explains breaks (paragraph or Shift+Enter) and
  // deletions, so a suggestion
  // menu inserting a name on Enter still counts as machine-assisted.
  _resolveSource(transaction) {
    const h = this._inputHint
    this._inputHint = null
    const hint = h && Date.now() - h.t <= HINT_TTL_MS ? h.source : null
    if (hint === 'text' || hint === 'undo') return 'human'
    if (hint === 'paste') return 'paste'
    if (hint === 'spell') return 'machine'
    try {
      if (transaction.getMeta && transaction.getMeta('history$') !== undefined) return 'human'
      const uiEvent = transaction.getMeta && transaction.getMeta('uiEvent')
      if (uiEvent === 'paste' || uiEvent === 'drop') return 'paste'
      if (uiEvent === 'cut') return 'human'
    } catch { /* noop */ }
    return hint === 'key' ? 'key' : 'machine'
  }

  // Called from the editor's onUpdate for every doc-changing transaction, with the
  // transactions plugins appended to it.
  onTransaction(transaction, appendedTransactions = []) {
    const st = this.s
    if (!st.enabled || st.closed || !transaction?.docChanged) return
    this._ensureSession(st)
    const source = this._resolveSource(transaction)
    const now = Date.now()

    // Something changed the text without reaching onUpdate (a reload from disk,
    // a plugin dispatching silently): record that change too, as machine work,
    // so the session's ops still lead from its first text to its last.
    if (st.lastDoc && transaction.before !== st.lastDoc) {
      this._flushPending(st)
      const A = flatInfo(st.lastDoc)
      const B = flatInfo(transaction.before)
      if (A.flat !== B.flat) {
        const { s, del, ins } = flatDiff(A.flat, B.flat, A.flat.length)
        if (typeof window !== 'undefined' && window.__pentiDebug) console.warn('[pentimento] unrecorded change', JSON.stringify({ s, del: del.slice(0, 60), ins: ins.slice(0, 60) }))
        if (del) this._appendDelete(st, s, flatLocate(A, s), del, now, 'machine')
        if (ins) this._appendInsert(st, ins.length > PASTE_CHARS ? 'paste' : 'insert', s, flatLocate(B, s), ins, now, 'machine')
        this._flushPending(st)
      }
    }

    if (!st.lastEventTime) {
      // first edit of this recording: the word clock starts now, not at chapter open
      st.wpmChars = 0
      st.wpmT = now
    }
    const gap = st.lastEventTime ? now - st.lastEventTime : 0
    if (gap > PAUSE_MS) {
      const where = st.pending ? st.pending.para : 0
      this._flushPending(st)
      st.buffer.push({
        timestamp: new Date(now).toISOString(), op_type: 'pause',
        para_index: where, char_offset: 0, length: 0, text_content: null,
        duration_ms: Math.min(gap, PAUSE_CAP_MS),
        source: 'human',
        seq: st.seq++,
      })
      // idle time must not deflate the next words' WPM — restart the word clock
      st.wpmChars = 0
      st.wpmT = now
    }
    st.lastEventTime = now

    const chunks = []   // { flat, text, paste } per insertion, for WPM sampling
    let hadDelete = false
    let wpmChars = 0
    const trs = [transaction, ...(appendedTransactions || [])]
    for (let t = 0; t < trs.length; t++) {
      const tr = trs[t]
      if (!tr?.docChanged) continue
      const trSource = t === 0 ? source : 'machine'
      for (let i = 0; i < tr.steps.length; i++) {
        const docB = tr.docs[i]
        const docA = i + 1 < tr.docs.length ? tr.docs[i + 1] : tr.doc
        if (!docB || docA === docB) continue
        const A = flatInfo(docB)
        const B = flatInfo(docA)
        if (A.flat === B.flat) continue // marks, attributes, wrapping: no text changed
        const { s, del, ins } = flatDiff(A.flat, B.flat, flatHint(docB, A, tr.steps[i].from ?? 0))
        const src = trSource === 'key' ? (!ins || /^[\n￼]+$/.test(ins) ? 'human' : 'machine') : trSource
        if (del) {
          this._appendDelete(st, s, flatLocate(A, s), del, now, src)
          hadDelete = true
        }
        if (ins) {
          const type = ins.length > PASTE_CHARS ? 'paste' : 'insert'
          // a paste is a paste regardless of how the DOM delivered it
          this._appendInsert(st, type, s, flatLocate(B, s), ins, now, type === 'paste' ? 'paste' : src)
          chunks.push({ flat: s, text: ins, paste: type === 'paste' })
          wpmChars += ins.length
        }
      }
    }
    const finalDoc = trs[trs.length - 1]?.doc || transaction.doc
    st.lastDoc = finalDoc

    this._sampleWpm(st, flatInfo(finalDoc), chunks, wpmChars, hadDelete, now)

    if (st.buffer.length >= FLUSH_COUNT) this._flush(st)
    else if (now - this._lastStash >= STASH_EVERY_MS) this._writeStash(st)
  }

  // Per-word typing-speed sampling: one [para, wordOffset, wpm] triple per completed
  // word, where the offset is the word's index within its paragraph as of typing time
  // (read from the live doc, so later deletions never require fixing up old samples).
  // Deletions and pauses restart the clock so their dead time never pollutes the next
  // word's speed; pastes emit cap-speed samples (still word-aligned). The whole trace
  // is resent on every flush, making the recorder authoritative over what's stored.
  _sampleWpm(st, info, chunks, totalChars, hadDelete, now) {
    if (hadDelete) {
      st.wpmChars = 0
      st.wpmT = now
    }
    if (!chunks.length) return

    // A chunk spanning paragraph breaks becomes one segment per paragraph.
    const segs = []
    for (const c of chunks) {
      const loc = flatLocate(info, c.flat)
      c.text.split('\n').forEach((text, k) => {
        segs.push({ para: loc.para + k, start: k === 0 ? loc.offset : 0, text, paste: c.paste, brk: k > 0 })
      })
    }

    // Words completed in this transaction = tokens terminated by whitespace (or a
    // paragraph break) inside the inserted text. A token may start before the
    // chunk (continuation). Pasted chunks emit one cap-speed sample per token
    // regardless of trailing ws.
    const words = []   // { para, ws: word-start index within the paragraph, cap? }
    const paraText = (p) => info.texts[p] || ''
    for (let k = 0; k < segs.length; k++) {
      const c = segs[k]
      if (c.paste) {
        const tokRe = /\S+/g
        let t
        while ((t = tokRe.exec(c.text)) !== null) words.push({ para: c.para, ws: c.start + t.index, cap: true })
        continue
      }
      const ends = []
      const re = /\s+/g
      let m
      while ((m = re.exec(c.text)) !== null) ends.push(c.start + m.index)
      // the break that ends this segment completes its last word
      if (k + 1 < segs.length && segs[k + 1].brk) ends.push(c.start + c.text.length)
      const txt = paraText(c.para)
      for (const endPara of ends) {
        if (endPara === 0) continue
        let ts = endPara - 1
        if (/\s/.test(txt[ts] || ' ')) continue
        while (ts > 0 && !/\s/.test(txt[ts - 1] || ' ')) ts--
        words.push({ para: c.para, ws: ts })
      }
    }
    if (!words.length) {
      st.wpmChars += totalChars // the word in progress
      return
    }

    const completed = words.length
    const last = segs[segs.length - 1]
    const trailing = (() => {
      const m = last.text.match(/(\s+)(\S*)$/)
      return m ? m[2].length : (segs.length > 1 ? last.text.length : 0)
    })()
    // chars of the completed words, each with the space or break that ended it;
    // five of them make one "word" of WPM
    const doneChars = Math.max(1, st.wpmChars + totalChars - trailing)
    const minutes = Math.max(1, now - (st.wpmT || now)) / 60000
    const wpm = Math.max(10, Math.min(300, Math.round(doneChars / 5 / minutes)))

    for (const w of words) {
      const txt = paraText(w.para)
      let idx = (txt.slice(0, w.ws).match(/\S+/g) || []).length
      // a pasted token glued to the word before it continues that word
      if (w.ws > 0 && !/\s/.test(txt[w.ws - 1] || ' ')) idx -= 1
      st.wpmSamples.push([w.para, Math.max(0, idx), w.cap ? 300 : wpm])
    }
    if (st.wpmSamples.length > 50000) st.wpmSamples = st.wpmSamples.slice(-50000)
    st.wpmDirty = true
    st.wpmChars = trailing
    st.wpmT = now
  }

  _appendInsert(st, type, s, loc, text, now, source) {
    const p = st.pending
    const contiguous = p && p.type === 'insert' && type === 'insert' && p.source === source &&
      s === p.flat + p.text.length &&
      (now - p.tStart) < RUN_MAX_MS && p.text.length < RUN_MAX_CHARS
    if (contiguous) {
      p.text += text
      p.tLast = now
    } else {
      this._flushPending(st)
      st.pending = { type, flat: s, para: loc.para, offset: loc.offset, text, tStart: now, tLast: now, source }
    }
    if (st.pending.text.length >= RUN_MAX_CHARS) this._flushPending(st)
  }

  _appendDelete(st, s, loc, text, now, source) {
    const p = st.pending
    const canJoin = p && p.type === 'delete' && p.source === source &&
      (now - p.tStart) < RUN_MAX_MS && p.text.length < RUN_MAX_CHARS
    if (canJoin && s + text.length === p.flat) {
      // backspacing removes the text just before the previous deletion
      p.text = text + p.text
      p.flat = s
      p.para = loc.para
      p.offset = loc.offset
      p.tLast = now
    } else if (canJoin && s === p.flat) {
      // forward-deleting removes the text just after it
      p.text += text
      p.tLast = now
    } else {
      this._flushPending(st)
      st.pending = { type: 'delete', flat: s, para: loc.para, offset: loc.offset, text, tStart: now, tLast: now, source }
    }
    if (st.pending.text.length >= RUN_MAX_CHARS) this._flushPending(st)
  }

  _pendingOp(p) {
    return {
      timestamp: new Date(p.tLast).toISOString(), op_type: p.type,
      para_index: p.para, char_offset: p.offset,
      length: p.text.length, text_content: p.text,
      duration_ms: Math.max(0, p.tLast - p.tStart),
      source: p.source || 'human',
    }
  }

  _flushPending(st) {
    const p = st.pending
    st.pending = null
    if (!p || !p.text) return
    st.buffer.push({ ...this._pendingOp(p), seq: st.seq++ })
  }

  // Mirror everything not yet confirmed by the backend, so a crash or a killed
  // process loses about STASH_EVERY_MS of writing.
  _writeStash(st) {
    this._lastStash = Date.now()
    if (!st.sessionId) return
    const ops = [...st.inflight, ...st.buffer]
    if (st.pending?.text) ops.push(this._pendingOp(st.pending))
    if (ops.length) this._stash[st.sessionId] = { project_path: st.projectPath, chapter_id: st.chapterId, ops }
    else if (this._stash[st.sessionId]) delete this._stash[st.sessionId]
    else return
    this._saveStash()
  }

  _dropStash(sessionId) {
    if (!this._stash[sessionId]) return
    delete this._stash[sessionId]
    this._saveStash()
  }

  _saveStash() {
    try {
      const json = JSON.stringify(this._stash)
      if (this.api?.pentimentoStashWrite) this.api.pentimentoStashWrite(json)
      else if (json === '{}') localStorage.removeItem(STASH_KEY)
      else localStorage.setItem(STASH_KEY, json)
    } catch { /* the stash is a best-effort backup */ }
  }

  _armFlush() {
    if (this._flushTimer) return
    this._flushTimer = setInterval(() => {
      this._flush(this.s)
      this._maybeAnchorHead(this.s)
    }, FLUSH_MS)
  }

  _disarmFlush() {
    if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null }
  }

  // Flushes of one session run one at a time, in order.
  _flush(st = this.s) {
    this._flushPending(st)
    st.flushChain = st.flushChain.then(() => this._flushNow(st)).catch(() => {})
    return st.flushChain
  }

  async _flushNow(st) {
    if (st.starting) { try { await st.starting } catch { /* noop */ } }
    const sid = st.sessionId
    if (!sid || (st.buffer.length === 0 && !st.wpmDirty)) return
    // Same ordering the backend seals with (ORDER BY timestamp, rowid): rows are
    // inserted in this sorted order, so rowid ties break identically.
    const ops = st.buffer.slice().sort((a, b) =>
      (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.seq - b.seq))
    st.buffer = []
    st.inflight = ops
    const sentWpm = st.wpmDirty
    st.wpmDirty = false
    try {
      await this.api.pentimentoFlush({
        project_path: st.projectPath, session_id: sid,
        chapter_id: st.chapterId, ops,
        // The recorder owns the trace: each flush replaces the stored copy so
        // word offsets always reflect the latest deletions.
        wpm_trace: sentWpm && st.wpmSamples.length ? st.wpmSamples : undefined,
      })
      st.inflight = []
      if (ops.length) this._advanceHead(st, ops)
    } catch {
      // put them back so a transient failure doesn't lose the run
      st.inflight = []
      st.buffer = ops.concat(st.buffer)
      if (sentWpm) st.wpmDirty = true
    }
    this._writeStash(st)
  }

  // Rolling head = SHA256(prev chain state + flushed fingerprints). Advanced only
  // after a confirmed flush so head hashes always correspond to persisted ops.
  _advanceHead(st, ops) {
    if (!this._verificationOn() || !ops.length) return
    const fps = ops.map(opFingerprint).join('')
    st.headChain = st.headChain
      .then(prev => sha256Hex((prev || '') + fps))
      .then(head => { st.headDirty = true; return head })
      .catch(() => '')
  }

  // Called on the flush interval: every 10 min of active typing, anchor the
  // current rolling head so fake sessions appended after an honest seal break.
  async _maybeAnchorHead(st) {
    if (!this._verificationOn() || !st.sessionId) return
    const now = Date.now()
    if (now - st.lastAnchorTime < ANCHOR_EVERY_MS) return
    if (!st.headDirty) return
    st.lastAnchorTime = now
    st.headDirty = false
    try {
      const head = await st.headChain
      if (!head || !st.sessionId) return
      const res = await this.api.pentimentoAnchorHead({
        project_path: st.projectPath, session_id: st.sessionId,
        chapter_id: st.chapterId, rolling_head: head,
        previous_hash: st.lastAnchorHash,
      })
      if (res?.status === 'ok') {
        st.lastAnchorHash = head
        st.lastAnchorTime = Date.now()
      } else if (res?.status === 'disabled') {
        // project opted out — stop asking until the next session
        st.headDirty = false
        st.lastAnchorTime = now + ANCHOR_EVERY_MS
      }
    } catch { /* TSA down → receipt simply isn't created this round */ }
  }
}
