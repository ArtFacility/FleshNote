import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPersonalDefaults } from '../utils/personalDefaults'
import { daysLeft, fmtExpiry } from '../utils/reviewProblems'

export const NOTE_CATEGORIES = ['typo', 'rewrite', 'remove', 'praise', 'question', 'comment']
const SCORE_KEYS = ['pacing', 'prose', 'dialogue', 'characters', 'plot', 'engagement', 'overall']

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `n-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function flattenEntities(entities) {
  if (!entities) return []
  const out = []
  for (const list of [entities.characters, entities.locations, entities.lore, entities.groups]) {
    for (const e of list || []) out.push(e)
  }
  return out
}

function entityIndexMap(entities) {
  const idx = new Map()
  for (const e of flattenEntities(entities)) idx.set(e.id, e)
  return idx
}

const DECODE_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: '\u00a0' }
function decodeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m, g) => DECODE_MAP[g] ?? m)
}

const TAG_RE = /^<(\/?)(p|h[1-6]|strong|b|em|i|u|s|br|ul|ol|li)(?:\s[^>]*)?>/i
const MARKER_RE = /^\{\{([a-z]+):([^|]+)\|([\s\S]+?)\}\}/
const ENTITY_SHORT = new Set(['char', 'loc', 'item', 'lore', 'group', 'quicknote', 'annotation'])
const LINK_SHORT = new Set(['twist', 'foreshadow', 'knowledge', 'relationship', 'milestone', 'time'])
const MD_ATOM = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\{\{(?:char|loc|item|lore|group|quicknote|annotation|twist|foreshadow|knowledge|relationship|milestone|time):[^|]+\|[^}]+}})/g

// Tokenizes TipTap HTML into blocks of leaves that carry RAW offsets into the
// original text_md string, so note anchors (UTF-16 offsets incl. tag chars)
// stay valid. Unknown tags are treated as plain text.
function tokenizeHtml(raw) {
  const blocks = []
  let cur = null
  let listTag = null
  const styleStack = []
  let i = 0
  let runStart = 0
  const curStyles = () => {
    const s = {}
    for (const st of styleStack) s[st] = true
    return s
  }
  const ensureBlock = (tag) => {
    if (!cur) {
      cur = { tag: tag || 'p', list: listTag, runs: [] }
      blocks.push(cur)
    }
  }
  const pushLeaf = (leaf) => {
    ensureBlock()
    cur.runs.push(leaf)
  }
  const flushText = (end) => {
    if (end > runStart) pushLeaf({ rawStart: runStart, rawLen: end - runStart, ...curStyles() })
  }
  while (i < raw.length) {
    if (raw.startsWith('{{', i)) {
      const m = MARKER_RE.exec(raw.slice(i, i + 600))
      if (m && (ENTITY_SHORT.has(m[1]) || LINK_SHORT.has(m[1]))) {
        flushText(i)
        pushLeaf({ rawStart: i + m[0].indexOf('|') + 1, rawLen: m[3].length, chipType: m[1], refId: m[2] })
        i += m[0].length
        runStart = i
        continue
      }
    }
    if (raw[i] === '<') {
      const m = TAG_RE.exec(raw.slice(i, i + 80))
      if (m) {
        flushText(i)
        const closing = m[1] === '/'
        const tag = m[2].toLowerCase()
        i += m[0].length
        runStart = i
        const isBlock = tag === 'p' || tag === 'li' || /^h[1-6]$/.test(tag)
        if (tag === 'br') {
          pushLeaf({ br: true, rawStart: runStart - m[0].length, rawLen: m[0].length })
        } else if (!closing) {
          if (isBlock) {
            cur = null
            ensureBlock(tag === 'li' ? 'li' : tag)
          } else if (tag === 'ul' || tag === 'ol') {
            listTag = tag
          } else {
            styleStack.push(tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag)
          }
        } else {
          if (tag === 'ul' || tag === 'ol') listTag = null
          else if (!isBlock && styleStack.length) styleStack.pop()
          if (isBlock) cur = null
        }
        continue
      }
    }
    i++
  }
  flushText(raw.length)
  return blocks
}

// Fallback for chapters stored as plain text (pre-import files): blank-line
// paragraphs + markdown atoms (bold/italic/entity markers).
function tokenizePlain(raw) {
  const blocks = []
  let cursor = 0
  for (const para of (raw || '').split(/\n{2,}/)) {
    if (!para.trim()) continue
    const at = raw.indexOf(para, cursor)
    const start = at >= 0 ? at : cursor
    cursor = start + para.length
    const runs = []
    let last = 0
    let m
    MD_ATOM.lastIndex = 0
    while ((m = MD_ATOM.exec(para)) !== null) {
      if (m.index > last) runs.push({ rawStart: start + last, rawLen: m.index - last })
      const tok = m[0]
      if (tok.startsWith('{{')) {
        const pipe = tok.indexOf('|')
        runs.push({
          rawStart: start + m.index + pipe + 1,
          rawLen: tok.length - pipe - 2,
          chipType: tok.slice(2, tok.indexOf(':')),
          refId: tok.slice(tok.indexOf(':') + 1, pipe),
        })
      } else if (tok.startsWith('**')) {
        runs.push({ rawStart: start + m.index + 2, rawLen: tok.length - 4, strong: true })
      } else {
        runs.push({ rawStart: start + m.index + 1, rawLen: tok.length - 2, em: true })
      }
      last = m.index + tok.length
    }
    if (last < para.length) runs.push({ rawStart: start + last, rawLen: para.length - last })
    blocks.push({ tag: 'p', runs })
  }
  return blocks
}

function cutLeaf(leaf, ranges, raw) {
  if (leaf.br) return [{ ...leaf, mark: null, noteId: null }]
  const cuts = [leaf.rawStart]
  const leafEnd = leaf.rawStart + leaf.rawLen
  for (const r of ranges) {
    for (const p of [r.start, r.end]) {
      if (p > leaf.rawStart && p < leafEnd) cuts.push(p)
    }
  }
  cuts.sort((a, b) => a - b)
  const pieces = []
  for (let k = 0; k < cuts.length; k++) {
    const from = cuts[k]
    const to = k + 1 < cuts.length ? cuts[k + 1] : leafEnd
    if (to <= from) continue
    const covering = ranges.find((r) => from >= r.start && to <= r.end)
    pieces.push({
      rawStart: from,
      rawLen: to - from,
      text: (raw || '').slice(from, to),
      strong: leaf.strong,
      em: leaf.em,
      u: leaf.u,
      s: leaf.s,
      chipType: leaf.chipType,
      refId: leaf.refId,
      mark: covering ? covering.cat : null,
      noteId: covering ? covering.id : null,
    })
  }
  return pieces
}

// Maps a DOM selection back onto raw text_md offsets. Leaf spans carry
// data-s (raw start) and data-l (raw length); when HTML entities were
// decoded the text is shorter than the raw slice, so interior offsets are
// interpolated. Selections inside an entity chip snap to the whole label.
function selectionOffsets(proseEl) {
  if (!proseEl) return null
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!proseEl.contains(range.startContainer) || !proseEl.contains(range.endContainer)) return null
  const snap = (node, off) => {
    const span = node.nodeType === 1
      ? (node.getAttribute?.('data-s') != null ? node : node.closest?.('[data-s]'))
      : node.parentElement?.closest?.('[data-s]')
    if (!span) return null
    const base = parseInt(span.dataset.s, 10)
    const rawLen = parseInt(span.dataset.l || '0', 10)
    if (span.dataset.chip !== undefined || rawLen === 0) return { a: base, b: base + rawLen }
    const L = span.textContent.length
    if (L === rawLen) {
      const v = base + off
      return { a: v, b: v }
    }
    const v = base + Math.max(0, Math.min(rawLen, Math.round((off / L) * rawLen)))
    return { a: v, b: v }
  }
  const a = snap(range.startContainer, range.startOffset)
  const b = snap(range.endContainer, range.endOffset)
  if (!a || !b) return null
  const start = Math.min(a.a, b.a)
  const end = Math.max(a.b, b.b)
  if (end - start < 1) return null
  const raw = proseEl.dataset.text || ''
  return { start, end, quote: raw.slice(start, end) }
}

const STYLE_ORDER = ['strong', 'em', 'u', 's']
const STYLE_TAG = { strong: 'strong', em: 'em', u: 'u', s: 's' }

function NoteProse({ raw, chapterId, notes, activeNote, entityIndex, onEntityClick, onSelection, proseRef, readOnly }) {
  const blocks = useMemo(() => {
    const text = raw || ''
    return text.includes('<') ? tokenizeHtml(text) : tokenizePlain(text)
  }, [raw])
  const ranges = useMemo(
    () => (notes || [])
      .filter((n) => n.chapter_id === chapterId && n.anchor_end > n.anchor_start)
      .map((n) => ({ start: n.anchor_start, end: n.anchor_end, cat: n.category, id: n.id })),
    [notes, chapterId]
  )
  const rawText = raw || ''

  const renderPiece = (piece, key) => {
    let inner = (
      <span key={key} data-s={piece.rawStart} data-l={piece.rawLen}>{piece.text}</span>
    )
    for (const st of STYLE_ORDER) {
      if (piece[st]) {
        const Tag = STYLE_TAG[st]
        inner = <Tag key={`${key}:${st}`}>{inner}</Tag>
      }
    }
    if (piece.mark) {
      const cls = `review-note-mark cat-${piece.mark}${piece.noteId && piece.noteId === activeNote ? ' active' : ''}`
      inner = <mark key={`${key}:mark`} className={cls}>{inner}</mark>
    }
    if (piece.chipType && ENTITY_SHORT.has(piece.chipType)) {
      if (entityIndex?.has(piece.refId)) {
        return (
          <button
            key={key}
            type="button"
            className="reviewer-entity-chip"
            data-s={piece.rawStart}
            data-l={piece.rawLen}
            data-chip="1"
            onClick={() => onEntityClick?.(piece.refId, piece.chipType)}
          >
            {piece.text}
          </button>
        )
      }
      return <span key={key}>{inner}</span>
    }
    if (piece.chipType && LINK_SHORT.has(piece.chipType)) {
      return <span key={key} className="reviewer-inline-link">{inner}</span>
    }
    return inner
  }

  const renderBlock = (block, bi) => {
    const content = block.runs.flatMap((leaf, li) => cutLeaf(leaf, ranges, rawText).map((piece, pi) => renderPiece(piece, `${bi}-${li}-${pi}`)))
    if (block.tag === 'li') return <li key={bi}>{content}</li>
    if (/^h[1-6]$/.test(block.tag)) {
      const H = block.tag
      return <H key={bi}>{content}</H>
    }
    return <p key={bi}>{content}</p>
  }

  // Group consecutive <li> blocks into a single list wrapper.
  const rendered = []
  let listBuffer = []
  const flushList = (key) => {
    if (!listBuffer.length) return
    const Tag = listBuffer[0].list === 'ol' ? 'ol' : 'ul'
    rendered.push(<Tag key={key}>{listBuffer.map((b) => renderBlock(b, b.key))}</Tag>)
    listBuffer = []
  }
  blocks.forEach((block, bi) => {
    if (block.tag === 'li') {
      listBuffer.push({ ...block, key: bi })
    } else {
      flushList(`list-${bi}`)
      rendered.push(renderBlock(block, bi))
    }
  })
  flushList('list-end')

  return (
    <div
      className="reviewer-prose"
      dir="auto"
      ref={proseRef}
      data-text={rawText}
      onMouseUp={() => {
        if (readOnly) return
        const off = selectionOffsets(proseRef.current)
        if (!off) {
          onSelection?.(null)
          return
        }
        const sel = window.getSelection()
        let rect = null
        try {
          const r = sel.getRangeAt(0).getBoundingClientRect()
          rect = { x: r.left + r.width / 2, y: r.bottom, above: r.bottom > window.innerHeight - 240 }
        } catch { rect = null }
        onSelection?.({ ...off, rect })
      }}
    >
      {rendered}
    </div>
  )
}

// A raw quote (TipTap HTML with entity markers) as the words the reader saw
function editorPlain(raw) {
  return decodeHtml((raw || '')
    .replace(/\{\{[a-z]+:[^|]+\|([^}]+)\}\}/g, '$1')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

const SUGGEST_CATEGORIES = new Set(['typo', 'rewrite'])

// Note editor, used for a new note (after picking its kind) and for editing one.
// Typos and rewrites get a "suggested text" box, pre-filled with the passage.
function NoteEditor({ t, initial, quotePlain, busy, onSave, onCancel }) {
  const [category, setCategory] = useState(initial.category)
  const [body, setBody] = useState(initial.body || '')
  const [suggestion, setSuggestion] = useState(initial.suggestion ?? '')
  const wantsSuggestion = SUGGEST_CATEGORIES.has(category)
  useEffect(() => {
    if (wantsSuggestion && !suggestion && quotePlain) setSuggestion(quotePlain)
  }, [wantsSuggestion])
  const canSave = !busy && (body.trim() || (wantsSuggestion && suggestion.trim() && suggestion.trim() !== (quotePlain || '').trim()) || category === 'remove')
  const save = () => canSave && onSave({ category, body: body.trim(), suggestion: wantsSuggestion ? suggestion.trim() : '' })
  return (
    <>
      <div className="cat-picker">
        {NOTE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`review-chip cat-${c} ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
            {t(`review.cat.${c}`, c)}
          </button>
        ))}
      </div>
      {wantsSuggestion && (
        <label className="note-field">
          <span>{t('review.suggestionLabel', 'Suggested text')}</span>
          <textarea className="note-body note-suggestion" rows={2} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
        </label>
      )}
      <textarea
        className="note-body"
        rows={3}
        autoFocus={!wantsSuggestion}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={category === 'praise'
          ? t('review.praisePlaceholder', 'What worked for you here?')
          : t('review.composerPlaceholder', 'Leave a note for the author…')}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save() }}
      />
      <div className="note-editor-actions">
        <button type="button" className="picker-ghost-btn" onClick={onCancel}>{t('review.cancel', 'Cancel')}</button>
        <button type="button" className="picker-primary" disabled={!canSave} onClick={save}>{t('review.saveNote', 'Save note')}</button>
      </div>
    </>
  )
}

function ScoreBlock({ t, chapter, scores, onChange }) {
  if (!chapter) return null
  const current = scores.find((s) => s.chapter_id === chapter.id) || { chapter_id: chapter.id }
  return (
    <div className="score-block">
      <span className="picker-kicker">{t('review.scores', 'Chapter scores')}</span>
      <span className="score-hint">{t('review.scoresHint', 'Optional. 1 = weak, 5 = strong.')}</span>
      {SCORE_KEYS.map((key) => (
        <div key={key} className="score-row">
          <span>{t(`review.score.${key}`, key)}</span>
          <div className="score-pips">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${t(`review.score.${key}`, key)} ${n}`}
                className={`score-pip ${(current[key] || 0) >= n ? 'on' : ''}`}
                onClick={() => onChange({ ...current, chapter_id: chapter.id, [key]: current[key] === n ? 0 : n })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const TYPE_KEYS = {
  char: 'character',
  loc: 'location',
  item: 'item',
  lore: 'lore',
  group: 'group',
  quicknote: 'quicknote',
  annotation: 'annotation',
}

/**
 * The reviewer's side of a review: reads the chapters the author sent, leaves
 * notes on selected passages and scores chapters. Everything saves to the
 * working copy as it changes; "Send back to author" writes the copy that goes
 * back. session: { path (working copy), pkg, resumed }.
 */
export default function ReviewerIDE({ session, onClose }) {
  const { t } = useTranslation()
  const pkg = session?.pkg
  const snapshot = pkg?.snapshot
  const [notes, setNotes] = useState(() => pkg?.notes || [])
  const [scores, setScores] = useState(() => pkg?.scores || [])
  const [label, setLabel] = useState(pkg?.reviewer_label || '')
  const [chapterIdx, setChapterIdx] = useState(0)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [popup, setPopup] = useState(null)
  const [activeNote, setActiveNote] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saveState, setSaveState] = useState('saved') // saved | saving | error | expired
  const [showIntro, setShowIntro] = useState(() => !session?.resumed)
  const [finished, setFinished] = useState(null) // path of the copy sent back
  const proseRef = useRef(null)
  const popupRef = useRef(null)
  const latest = useRef({ notes, scores, label })
  latest.current = { notes, scores, label }

  // Pre-fill the reviewer name from personal defaults when the package has none
  useEffect(() => {
    if ((pkg?.reviewer_label || '').trim()) return
    let cancelled = false
    getPersonalDefaults().then((d) => {
      if (cancelled || !d.reviewer_name) return
      setLabel((prev) => prev || d.reviewer_name)
    }).catch(() => { })
    return () => { cancelled = true }
  }, [pkg?.reviewer_label])

  const chapters = snapshot?.chapters || []
  const chapter = chapters[chapterIdx] || null
  const entities = snapshot?.entities
  const idx = useMemo(() => entityIndexMap(entities), [entities])
  const inspected = selectedEntity ? idx.get(selectedEntity) : null
  const chapterNotes = notes
    .filter((n) => chapter && n.chapter_id === chapter.id)
    .sort((a, b) => a.anchor_start - b.anchor_start)
  const title = snapshot?.project?.title || t('review.untitled', 'Untitled')
  const author = pkg?.author_label || ''
  // a locked copy stops opening on this date, for the reviewer's notes too
  const expiresAt = pkg?.crypto?.expires_at || ''
  const left = daysLeft(expiresAt)
  const notesIn = (id) => notes.filter((n) => n.chapter_id === id).length

  useEffect(() => {
    setPopup(null)
    setSelectedEntity(null)
    setEditingId(null)
  }, [chapterIdx])

  useEffect(() => {
    if (!popup && !inspected) return
    const onDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) setPopup(null)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPopup(null)
        setSelectedEntity(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popup, inspected])

  // Every change is written to the working copy straight away
  const persist = async (patch = {}) => {
    if (!session?.path) return false
    const next = { ...latest.current, ...patch }
    setSaveState('saving')
    try {
      const res = await window.api.saveReviewPackage({
        path: session.path,
        package: { reviewer_label: next.label, notes: next.notes, scores: next.scores },
      })
      if (res?.status === 'expired') {
        setSaveState('expired')
        return false
      }
      if (res?.status !== 'ok') throw new Error(res?.message || 'Save failed')
      setSaveState('saved')
      return true
    } catch (err) {
      console.error(err)
      setSaveState('error')
      return false
    }
  }

  const addNote = async ({ category, body, suggestion }) => {
    if (!popup || !chapter) return
    const now = new Date().toISOString()
    const note = {
      id: newId(),
      chapter_id: chapter.id,
      category,
      body,
      suggestion,
      anchor_start: popup.start,
      anchor_end: popup.end,
      anchor_quote: popup.quote,
      created_at: now,
      updated_at: now,
    }
    const next = [...notes, note]
    setNotes(next)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
    await persist({ notes: next })
  }

  const updateNote = async (id, patch) => {
    const next = notes.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))
    setNotes(next)
    setEditingId(null)
    await persist({ notes: next })
  }

  const removeNote = async (id) => {
    const next = notes.filter((n) => n.id !== id)
    setNotes(next)
    setActiveNote(null)
    setEditingId(null)
    await persist({ notes: next })
  }

  const changeScore = async (nextScore) => {
    const next = scores.filter((s) => s.chapter_id !== nextScore.chapter_id).concat(nextScore)
    setScores(next)
    await persist({ scores: next })
  }

  const sendBack = async () => {
    if (saveState === 'error' && !(await persist())) return
    const name = label.trim()
    const res = await window.api.finishReview({
      path: session.path,
      defaultName: name ? `${title} - review by ${name}` : `${title} - review`,
    })
    if (res?.status === 'ok') setFinished(res.path)
    else if (res?.status === 'expired') setSaveState('expired')
    else if (res?.status !== 'cancelled') setSaveState('error')
  }

  const popupStyle = popup?.rect
    ? {
        left: Math.max(8, Math.min(popup.rect.x - 160, window.innerWidth - 336)),
        top: popup.rect.above ? popup.rect.y - 8 : popup.rect.y + 8,
        transform: popup.rect.above ? 'translateY(-100%)' : undefined,
      }
    : undefined

  return (
    <div className="reviewer-shell">
      <div className="reviewer-bar">
        <div className="reviewer-bar-title">
          {t('review.reviewing', 'Reviewing')} <strong>{title}</strong>
          {author && <span className="reviewer-bar-author">{t('review.fromAuthor', 'for {{author}}', { author })}</span>}
          {expiresAt && (
            <span className={`reviewer-bar-expiry ${left !== null && left <= 2 ? 'is-soon' : ''}`}>
              {left !== null && left <= 2
                ? t('review.expiresSoon', 'Stops opening {{date}}: send it back soon', { date: fmtExpiry(expiresAt) })
                : t('review.readableUntil', 'Readable until {{date}}', { date: fmtExpiry(expiresAt) })}
            </span>
          )}
        </div>
        <div className="reviewer-bar-actions">
          <span className={`reviewer-save-state is-${saveState}`}>
            {saveState === 'saving' && t('review.saving', 'Saving…')}
            {saveState === 'saved' && t('review.savedAll', 'Saved')}
            {saveState === 'error' && t('review.saveFailed', 'Not saved')}
            {saveState === 'expired' && t('review.copyExpired', 'This copy has expired')}
          </span>
          {saveState === 'error' && (
            <button type="button" className="picker-ghost-btn" onClick={() => persist()}>{t('review.retry', 'Retry')}</button>
          )}
          <input
            className="picker-workspace-path reviewer-name"
            value={label}
            maxLength={120}
            placeholder={t('review.yourName', 'Your name')}
            aria-label={t('review.yourName', 'Your name')}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => persist()}
          />
          <button type="button" className="picker-primary reviewer-send" onClick={sendBack}>
            {t('review.sendBack', 'Send back to author')}
          </button>
          <button type="button" className="picker-ghost-btn" onClick={onClose}>
            {t('review.close', 'Close')}
          </button>
        </div>
      </div>

      <div className="reviewer-layout">
        <aside className="reviewer-chapter-list">
          <span className="picker-kicker">{t('review.chapters', 'Chapters')}</span>
          <div className="reviewer-chapter-items">
            {chapters.map((ch, i) => (
              <div
                key={ch.id}
                className={`chapter-list-item ${i === chapterIdx ? 'active' : ''}`}
                onClick={() => setChapterIdx(i)}
              >
                <div className="chapter-num">{String(ch.number).padStart(2, '0')}</div>
                <div className="chapter-info">
                  <div className="chapter-title">{ch.title || t('review.untitledChapter', 'Untitled')}</div>
                  <div className="chapter-meta">
                    {(ch.word_count || 0).toLocaleString()} {t('ide.words', 'words')}
                    {notesIn(ch.id) > 0 && <> · {t('review.noteCount', '{{n}} notes', { n: notesIn(ch.id) })}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="reviewer-main">
          {showIntro && (
            <div className="reviewer-intro">
              <div className="reviewer-intro-title">
                {author
                  ? t('review.introFrom', '{{author}} asked you to read {{title}}', { author, title })
                  : t('review.introNoAuthor', 'You were asked to read {{title}}', { title })}
              </div>
              {pkg?.message && <blockquote className="reviewer-intro-message">{pkg.message}</blockquote>}
              {expiresAt && (
                <div className="reviewer-intro-expiry">
                  {t('review.introExpiry', 'This copy stops opening on {{date}}, and your notes with it. Send them back before then.', { date: fmtExpiry(expiresAt) })}
                </div>
              )}
              <ul className="reviewer-intro-steps">
                <li>{t('review.introSelect', 'Select any passage to leave a note: a typo, a better wording, a question, or what you liked.')}</li>
                <li>{t('review.introSaves', 'Your notes save as you go. You can close FleshNote and pick up later from the Reviewer screen.')}</li>
                <li>{t('review.introFinish', 'When you are done, press "Send back to author" and send them the file it saves.')}</li>
              </ul>
              <button type="button" className="picker-primary" onClick={() => setShowIntro(false)}>
                {t('review.introStart', 'Start reading')}
              </button>
            </div>
          )}
          {chapter ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <h2 className="reviewer-chapter-title">{chapter.number}. {chapter.title || t('review.untitledChapter', 'Untitled')}</h2>
              </div>
              <NoteProse
                raw={chapter.text_md}
                chapterId={chapter.id}
                notes={notes}
                activeNote={activeNote}
                entityIndex={idx}
                onEntityClick={(id) => { if (idx.has(id)) setSelectedEntity(id) }}
                onSelection={(off) => setPopup(off
                  ? { step: 'type', ...off, plain: String(window.getSelection() || '').replace(/\s+/g, ' ').trim() }
                  : null)}
                proseRef={proseRef}
              />
              <div className="reviewer-scores-end">
                <ScoreBlock t={t} chapter={chapter} scores={scores} onChange={changeScore} />
                {chapterIdx < chapters.length - 1 && (
                  <button type="button" className="picker-ghost-btn" onClick={() => { setChapterIdx(chapterIdx + 1); proseRef.current?.closest('.reviewer-main')?.scrollTo?.(0, 0) }}>
                    {t('review.nextChapter', 'Next chapter')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="picker-empty">{t('review.empty', 'No chapters in this package.')}</div>
          )}

          {inspected && (
            <>
              <div className="reviewer-inspector-backdrop" onClick={() => setSelectedEntity(null)} />
              <div className="reviewer-inspector">
                <div className="reviewer-inspector-head">
                  <span className="picker-kicker">
                    {t(`review.type.${TYPE_KEYS[inspected.type] || 'lore'}`, inspected.type || '')}
                  </span>
                  <button type="button" className="picker-ghost-btn" onClick={() => setSelectedEntity(null)}>×</button>
                </div>
                <h3 className="reviewer-inspector-name">{inspected.name}</h3>
                {inspected.aliases?.length > 0 && (
                  <div className="reviewer-inspector-alias">{inspected.aliases.join(' · ')}</div>
                )}
                {Object.keys(inspected.fields || {}).length > 0 ? (
                  <dl className="reviewer-detail">
                    {Object.entries(inspected.fields).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k.replace(/_/g, ' ')}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="picker-empty">{t('review.noDetails', 'No details in this package.')}</div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="reviewer-rail">
          <span className="picker-kicker">{t('review.notesRail', 'Notes')}</span>
          {popup && (
            <div className="reviewer-selection-popup" ref={popupRef} style={popupStyle}>
              {popup.quote && (
                <blockquote className="note-quote">
                  {popup.plain.length > 120 ? popup.plain.slice(0, 120) + '…' : popup.plain}
                </blockquote>
              )}
              {popup.step === 'type' ? (
                <>
                  <span className="note-step-hint">{t('review.pickKind', 'What kind of note?')}</span>
                  <div className="cat-picker">
                    {NOTE_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`review-chip cat-${c}`}
                        onClick={() => setPopup((p) => ({ ...p, step: 'body', category: c }))}
                      >
                        {t(`review.cat.${c}`, c)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <NoteEditor
                  t={t}
                  initial={{ category: popup.category }}
                  quotePlain={popup.plain}
                  busy={saveState === 'saving'}
                  onSave={addNote}
                  onCancel={() => setPopup(null)}
                />
              )}
            </div>
          )}
          {chapterNotes.length === 0 && !popup && (
            <div className="reviewer-rail-empty">
              {t('review.railEmpty', 'Select a passage in the chapter to leave a note.')}
            </div>
          )}
          {chapterNotes.map((n) => (
            editingId === n.id ? (
              <div key={n.id} className={`note-card cat-${n.category} note-card-editing`}>
                <NoteEditor
                  t={t}
                  initial={n}
                  quotePlain={editorPlain(n.anchor_quote)}
                  busy={saveState === 'saving'}
                  onSave={(patch) => updateNote(n.id, patch)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div
                key={n.id}
                className={`note-card cat-${n.category} ${activeNote === n.id ? 'active' : ''}`}
                onClick={() => setActiveNote(n.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className={`review-chip cat-${n.category} on`}>{t(`review.cat.${n.category}`, n.category)}</span>
                </div>
                <div className="note-card-quote">“{(() => { const q = editorPlain(n.anchor_quote); return q.length > 90 ? q.slice(0, 90) + '…' : q })()}”</div>
                {n.suggestion && (
                  <div className="note-card-suggestion">
                    <span>{t('review.suggestionLabel', 'Suggested text')}</span>
                    {n.suggestion}
                  </div>
                )}
                {n.body && <div className="note-card-body">{n.body}</div>}
                <div className="note-card-actions">
                  <button type="button" className="picker-ghost-btn" onClick={(e) => { e.stopPropagation(); setEditingId(n.id) }}>
                    {t('review.editNote', 'Edit')}
                  </button>
                  <button type="button" className="picker-ghost-btn" onClick={(e) => { e.stopPropagation(); removeNote(n.id) }}>
                    {t('review.deleteNote', 'Delete')}
                  </button>
                </div>
              </div>
            )
          ))}
        </aside>
      </div>

      {finished && (
        <div className="popup-overlay" style={{ zIndex: 9999 }}>
          <div className="popup-panel reviewer-finished" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('review.finishedTitle', 'Your review is ready to send')}</span>
              <button className="popup-close" onClick={() => setFinished(null)}>&times;</button>
            </div>
            <div className="reviewer-finished-body">
              <p>
                {author
                  ? t('review.finishedSendTo', 'Send this file to {{author}}, for example as a reply to the message the review came with:', { author })
                  : t('review.finishedSend', 'Send this file back to the author, for example as a reply to the message the review came with:')}
              </p>
              <div className="reviewer-finished-path">{finished}</div>
              <p className="reviewer-finished-note">
                {t('review.finishedKeep', 'Your notes stay on this computer too. You can reopen the review later and send an updated copy.')}
              </p>
              <div className="reviewer-finished-actions">
                <button type="button" className="picker-ghost-btn" onClick={() => window.api.showItemInFolder(finished)}>
                  {t('review.showInFolder', 'Show in folder')}
                </button>
                <button type="button" className="picker-primary" onClick={onClose}>
                  {t('review.finishedDone', 'Done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
