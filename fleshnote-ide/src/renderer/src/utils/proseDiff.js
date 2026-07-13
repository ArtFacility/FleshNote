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
