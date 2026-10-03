// Story Pulse gutter: matching the editor's live paragraphs to the scores the
// backend computed from the saved chapter (routes/story_pulse.py).
//
// Matching is by content, never by position: the live document drifts from the
// saved file while the writer types, and headings and short lines aren't
// scored. paragraphKey must stay identical to story_pulse.paragraph_key — same
// whitespace class, NFC, sha1 over UTF-8 bytes (Rovás glyphs are astral, so
// anything built on UTF-16 code units would diverge). Plain module, no React,
// so `node` can import it to check the shared test vector.

const KEY_SPACE_RE = /[ \t\n\r\f\v\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g
// janitor_paragraphs._TODO_RE: the backend drops #TODO notes before scoring
const TODO_RE = /#TODO[^\u200b\n]*\u200b?/g
const MIN_WORDS = 4 // story_pulse.MIN_WORDS

export async function paragraphKey(text) {
  const norm = text.normalize('NFC').replace(KEY_SPACE_RE, ' ').trim()
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(norm))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20)
}

/**
 * The text blocks the backend scores, from a ProseMirror doc: every non-heading
 * textblock, split at hard breaks like the backend's block splitter, with
 * #TODO notes removed and blocks under MIN_WORDS dropped.
 * Returns [{ pos, segments: [text, ...] }]; pos is the textblock's position.
 */
export function gutterBlocks(doc) {
  const out = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (node.type.name === 'heading') return false
    const parts = ['']
    node.forEach((child) => {
      if (child.isText) parts[parts.length - 1] += child.text
      else if (child.type.name === 'hardBreak') parts.push('')
    })
    const segments = parts
      .map((p) => p.replace(TODO_RE, ''))
      .filter((p) => p.trim().split(/\s+/).filter(Boolean).length >= MIN_WORDS)
    if (segments.length) out.push({ pos, segments })
    return false
  })
  return out
}

/** One bar's values from the scored segments of its block (most blocks have one). */
export function combineSegments(paras) {
  const scored = paras.filter((p) => p && p.intensity !== undefined)
  if (!scored.length) return null
  if (scored.length === 1) return scored[0]
  const words = scored.reduce((n, p) => n + p.words, 0)
  const avg = (k) => scored.reduce((s, p) => s + (p[k] ?? 0) * p.words, 0) / words
  const peak = scored.reduce((a, b) => (b.intensity > a.intensity ? b : a))
  return {
    ...peak,
    intensity: avg('intensity'),
    valence: avg('valence'),
    words,
    evidence: scored.flatMap((p) => p.evidence || []),
  }
}
