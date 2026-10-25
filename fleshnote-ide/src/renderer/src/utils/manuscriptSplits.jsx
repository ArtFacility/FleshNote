import React from 'react'

/*
 * Chapter splits proposed by the manuscript import, and the edits the review
 * screen makes to them. A split is
 *   { id, title, paragraphs: [markup], word_count, flag: null | 'front' | 'back' | 'empty', source }
 * Paragraph markup: **bold**, *italic*, _italic_, \* and \_ for literal
 * characters, "### Title" for a sub-heading and "* * *" for a scene break.
 * Every edit returns a new array; nothing is mutated.
 */

export const SCENE_BREAK = '* * *'

let nextId = 1
export const withIds = (splits) => splits.map((s) => ({ ...s, id: s.id ?? `split_${nextId++}` }))

export function plainText(markup) {
  return String(markup || '')
    .replace(/^###\s+/, '')
    .replace(/\\([*_\\])/g, '$1')
    .replace(/(\*\*|\*|_)(?=\S)(.+?)(?<=\S)\1/g, '$2')
}

export function countWords(paragraphs) {
  return paragraphs.reduce((n, p) => {
    if (p === SCENE_BREAK) return n
    const words = plainText(p).trim()
    return n + (words ? words.split(/\s+/).length : 0)
  }, 0)
}

const refresh = (split) => {
  const word_count = countWords(split.paragraphs)
  const flag = split.flag === 'front' || split.flag === 'back' ? split.flag : word_count === 0 ? 'empty' : null
  return { ...split, word_count, flag }
}

/** A short line without sentence punctuation can stand in as a chapter title. */
export function looksLikeTitle(markup) {
  const text = plainText(markup).trim()
  return text.length > 0 && text.length <= 80 && !/[.!?…"”»]$/.test(text) && markup !== SCENE_BREAK
}

export function moveSplit(splits, from, to) {
  if (from === to || to < 0 || to >= splits.length) return splits
  const next = [...splits]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export const renameSplit = (splits, index, title) =>
  splits.map((s, i) => (i === index ? { ...s, title } : s))

export const removeSplit = (splits, index) => splits.filter((_, i) => i !== index)

export const removeFlagged = (splits) => splits.filter((s) => !s.flag)

/** Joins a chapter onto the end of the one before it. */
export function joinWithPrevious(splits, index) {
  if (index <= 0 || index >= splits.length) return splits
  const prev = splits[index - 1]
  const cur = splits[index]
  const merged = refresh({ ...prev, flag: null, paragraphs: [...prev.paragraphs, ...cur.paragraphs] })
  const next = [...splits]
  next.splice(index - 1, 2, merged)
  return next
}

/**
 * Starts a new chapter at paragraph `at`. When that paragraph reads like a
 * title it becomes the new chapter's title instead of staying in the text.
 */
export function splitAt(splits, index, at, untitled = 'Untitled chapter') {
  const cur = splits[index]
  if (!cur || at <= 0 || at >= cur.paragraphs.length) return splits
  const head = cur.paragraphs.slice(0, at)
  let tail = cur.paragraphs.slice(at)
  let title = untitled
  if (looksLikeTitle(tail[0]) && tail.length > 1) {
    title = plainText(tail[0]).trim()
    tail = tail.slice(1)
  }
  const first = refresh({ ...cur, flag: cur.flag === 'front' ? 'front' : null, paragraphs: head })
  const second = refresh({ ...cur, id: `split_${nextId++}`, title, flag: null, paragraphs: tail })
  const next = [...splits]
  next.splice(index, 1, first, second)
  return next
}

/** Moves a chapter's first paragraph into its title. */
export function useFirstParagraphAsTitle(splits, index) {
  const cur = splits[index]
  if (!cur || cur.paragraphs.length === 0) return splits
  return splits.map((s, i) =>
    i === index ? refresh({ ...s, title: plainText(s.paragraphs[0]).trim(), paragraphs: s.paragraphs.slice(1) }) : s
  )
}

/** The shape the backend's confirm-splits endpoint takes. */
export const toPayload = (splits) => splits.map((s) => ({ title: s.title, paragraphs: s.paragraphs }))

/** The shape the entity extractor takes. */
export const toChapterTexts = (splits) =>
  splits.map((s, i) => ({ index: i, title: s.title, content: s.paragraphs.map(plainText).join('\n\n') }))

// ── Rendering markup ──────────────────────────────────────────────────────────

const INLINE = /(\\[*_\\])|\*\*(?=\S)(.+?)(?<=\S)\*\*|(?<![\\*])\*(?=[^\s*])(.+?)(?<=[^\s\\])\*|(?<![\w\\])_(?=\S)(.+?)(?<=[^\s\\])_(?!\w)/g

/** Markup → React nodes (no HTML strings, so imported text can't inject markup). */
export function renderInline(markup, keyPrefix = 'm') {
  const text = String(markup || '')
  const out = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyPrefix}${n++}`
    if (m[1]) out.push(m[1].slice(1))
    else if (m[2] !== undefined) out.push(<strong key={key}>{renderInline(m[2], key)}</strong>)
    else out.push(<em key={key}>{renderInline(m[3] ?? m[4], key)}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * A rough guess at the manuscript's language from letters only some languages
 * use. Returns 'en' | 'hu' | 'pl' | 'ar' | null (null: no strong signal, keep the choice).
 */
export function guessLanguage(splits) {
  const sample = splits
    .flatMap((s) => s.paragraphs)
    .join(' ')
    .slice(0, 60000)
  if (!sample) return null
  const count = (re) => (sample.match(re) || []).length
  const letters = count(/\p{L}/gu) || 1
  if (count(/\p{Script=Arabic}/gu) / letters > 0.3) return 'ar'
  const hu = count(/[őűŐŰ]/g)
  const pl = count(/[ąęłńśźżĄĘŁŃŚŹŻ]/g)
  if (pl / letters > 0.004 && pl > hu) return 'pl'
  if (hu / letters > 0.002 && hu >= pl) return 'hu'
  // Plain Latin text with practically none of those letters reads as English,
  // the only other language the app offers.
  if (count(/[A-Za-z]/g) / letters > 0.9 && hu / letters < 0.0003 && pl / letters < 0.0003) return 'en'
  return null
}
