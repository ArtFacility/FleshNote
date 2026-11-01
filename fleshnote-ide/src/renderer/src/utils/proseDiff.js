// Shared prose helpers for comparing two chapter versions (sync merge + history rollback).

// Turn stored markdown ({{char:id|Sophia}}, <span>…</span>) into the readable text a
// writer actually sees in the editor — no ids, no raw markup.
export function cleanProse(md) {
  if (!md) return ''
  let text = md
  if (/<p>|<div|<li|<h[1-6]|<blockquote/i.test(text)) {
    text = text
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<\/blockquote>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
  }
  return text
    .replace(/\{\{[a-z_]+:[^|}]+\|([^}]*)\}\}/gi, '$1') // entity/twist/note markers → their text
    .replace(/<[^>]+>/g, '')                            // stray html
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

// Minimal LCS line diff → [{ type: 'same'|'add'|'del', text }].
// 'del' = only in aText (left/mine), 'add' = only in bText (right/theirs).
export function diffLines(aText, bText) {
  const a = cleanProse(aText).split('\n')
  const b = cleanProse(bText).split('\n')
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++ }
    else { out.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i++ }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j++ }
  return out
}

// ── Fine-grained diff for the Pentimento replay ──────────────────────────────
// The replay is anchored on full-text session snapshots. To animate an *edited*
// paragraph as an in-place edit (not an erase-and-retype of the whole line), we
// need (a) which paragraphs were modified vs added/removed, and (b) the minimal
// character edits inside a modified paragraph. cleanProse is applied by callers.

// Word counts of a paragraph, ignoring case and punctuation.
function wordBag(s) {
  const bag = new Map()
  for (const w of s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) bag.set(w, (bag.get(w) || 0) + 1)
  return bag
}

function bagSize(bag) {
  let n = 0
  for (const c of bag.values()) n += c
  return n
}

// How alike two paragraphs are, or 0 when one isn't an edit of the other: at least
// half the shorter one's words survive (so continuing a paragraph still counts), or
// at least half the text is untouched at its two ends (so does fixing a short line).
function paragraphSimilarity(a, b) {
  const { prefix, suffix } = commonTrim(a, b)
  const ends = (prefix.length + suffix.length) / Math.max(a.length, b.length, 1)
  const bagA = wordBag(a), bagB = wordBag(b)
  const sizeA = bagSize(bagA), sizeB = bagSize(bagB)
  let shared = 0
  for (const [w, c] of bagA) shared += Math.min(c, bagB.get(w) || 0)
  if (shared / Math.max(Math.min(sizeA, sizeB), 1) < 0.5 && ends < 0.5) return 0
  return Math.max(ends, (2 * shared) / Math.max(sizeA + sizeB, 1))
}

const MAX_ALIGNED_PAIRS = 40000 // a region this big is a rewrite: don't compare every pair

// Lines up a change region's old and new paragraphs in document order, keeping the
// most alike pairs as edits. Unpaired old ones come out as dels, new ones as adds.
function alignChanged(dels, adds) {
  const n = dels.length, m = adds.length
  const out = []
  const aligned = n * m <= MAX_ALIGNED_PAIRS
  const sim = (i, j) => (aligned ? paragraphSimilarity(dels[i], adds[j]) : 0)
  const scores = Array.from({ length: n }, (_, i) => adds.map((_a, j) => sim(i, j)))
  const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      best[i][j] = Math.max(
        best[i + 1][j], best[i][j + 1],
        scores[i][j] > 0 ? scores[i][j] + best[i + 1][j + 1] : 0)
  let i = 0, j = 0
  while (i < n && j < m) {
    if (scores[i][j] > 0 && best[i][j] === scores[i][j] + best[i + 1][j + 1]) {
      out.push({ type: 'mod', before: dels[i], after: adds[j] }); i++; j++
    } else if (best[i][j] === best[i + 1][j]) { out.push({ type: 'del', text: dels[i] }); i++ }
    else { out.push({ type: 'add', text: adds[j] }); j++ }
  }
  while (i < n) { out.push({ type: 'del', text: dels[i] }); i++ }
  while (j < m) { out.push({ type: 'add', text: adds[j] }); j++ }
  return out
}

// Paragraph-level diff that turns a changed paragraph into a single
// { type: 'mod', before, after } chunk, when its old and new text are alike. The chunks
// are in document order, so a caller walking them with a running paragraph index
// (increment on same/mod/add, not on del) patches a live paragraph array correctly.
export function diffParagraphs(aText, bText) {
  const raw = diffLines(aText, bText)
  const out = []
  let i = 0
  while (i < raw.length) {
    if (raw[i].type === 'same') { out.push(raw[i]); i++; continue }
    const dels = [], adds = []
    while (i < raw.length && raw[i].type !== 'same') {
      if (raw[i].type === 'del') dels.push(raw[i].text)
      else adds.push(raw[i].text)
      i++
    }
    out.push(...alignChanged(dels, adds))
  }
  return out
}

// Split a string into tokens = runs of whitespace or runs of non-whitespace, so
// concatenating the tokens reproduces the string exactly.
function tokenize(s) { return (s || '').match(/\s+|\S+/gu) || [] }

// Push text onto a segment list, coalescing consecutive same-type runs.
function pushSeg(out, type, text) {
  const last = out[out.length - 1]
  if (last && last.type === type) last.text += text
  else out.push({ type, text })
}

// LCS diff over two token arrays → [{ type: 'keep'|'del'|'ins', text }].
function tokenDiff(before, after) {
  const a = tokenize(before), b = tokenize(after)
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { pushSeg(out, 'keep', a[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { pushSeg(out, 'del', a[i]); i++ }
    else { pushSeg(out, 'ins', b[j]); j++ }
  }
  while (i < n) { pushSeg(out, 'del', a[i]); i++ }
  while (j < m) { pushSeg(out, 'ins', b[j]); j++ }
  return out
}

// Common char prefix/suffix of two strings → the differing cores.
function commonTrim(a, b) {
  let p = 0
  const min = Math.min(a.length, b.length)
  while (p < min && a[p] === b[p]) p++
  let s = 0
  while (s < min - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return {
    prefix: a.slice(0, p),
    aMid: a.slice(p, a.length - s),
    bMid: b.slice(p, b.length - s),
    suffix: a.slice(a.length - s),
  }
}

// A del token-run immediately followed by an ins token-run is a *changed* word/
// region — char-trim it so "quick"→"quickly" becomes keep "quick" + ins "ly"
// instead of rewriting the whole token.
function refineSegments(segs) {
  const out = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s.type === 'del' && i + 1 < segs.length && segs[i + 1].type === 'ins') {
      const { prefix, aMid, bMid, suffix } = commonTrim(s.text, segs[i + 1].text)
      if (prefix) pushSeg(out, 'keep', prefix)
      if (aMid) pushSeg(out, 'del', aMid)
      if (bMid) pushSeg(out, 'ins', bMid)
      if (suffix) pushSeg(out, 'keep', suffix)
      i++ // consumed the ins run
    } else pushSeg(out, s.type, s.text)
  }
  return out
}

// Ordered atomic character edits transforming `before` into `after` in place,
// plus the raw removed/added text. Applying `edits` left-to-right to `before`
// yields `after` exactly (verified byte-for-byte in the scratchpad test).
// `del` at a fixed pos repeatedly (removed chars shift the next into place);
// `ins` advances pos as each char lands. `addedText` is used to pace the typing
// against captured writing ops; `removedText` feeds the deleted-words stat.
export function inlineChange(before, after) {
  const segs = refineSegments(tokenDiff(before, after))
  const edits = []
  let addedText = '', removedText = ''
  let pos = 0
  for (const seg of segs) {
    if (seg.type === 'keep') pos += seg.text.length
    else if (seg.type === 'del') {
      removedText += seg.text
      for (let k = 0; k < seg.text.length; k++) edits.push({ type: 'del', pos })
    } else {
      addedText += seg.text
      for (let k = 0; k < seg.text.length; k++) { edits.push({ type: 'ins', pos, ch: seg.text[k] }); pos++ }
    }
  }
  return { edits, addedText, removedText }
}

// Convenience: just the atomic edits (see inlineChange).
export function inlineEdits(before, after) {
  return inlineChange(before, after).edits
}
