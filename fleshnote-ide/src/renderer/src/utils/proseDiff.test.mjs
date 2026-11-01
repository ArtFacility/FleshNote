// node --test src/renderer/src/utils/proseDiff.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanProse, diffParagraphs, inlineChange } from './proseDiff.js'

const kinds = (a, b) => diffParagraphs(a, b).map((c) => c.type)

// What the replay does with the chunks: patch a live paragraph array by running index.
function play(a, b) {
  const paras = cleanProse(a).split('\n')
  let idx = 0
  for (const ch of diffParagraphs(a, b)) {
    if (ch.type === 'same') idx++
    else if (ch.type === 'del') paras.splice(idx, 1)
    else if (ch.type === 'add') paras.splice(idx++, 0, ch.text)
    else {
      assert.equal(paras[idx], ch.before)
      paras[idx++] = ch.after
    }
  }
  return paras.join('\n')
}

test('a line written above an existing line that also changed does not overwrite it', () => {
  const chunks = diffParagraphs('First.\nThe old line.', 'First.\nA new line.\nThe old line, edited.')
  assert.deepEqual(chunks, [
    { type: 'same', text: 'First.' },
    { type: 'add', text: 'A new line.' },
    { type: 'mod', before: 'The old line.', after: 'The old line, edited.' }
  ])
})

test('a line written above an unchanged line is just added', () => {
  assert.deepEqual(kinds('The old line.', 'A new line.\nThe old line.'), ['add', 'same'])
})

test('a line written below an edited one is added after it', () => {
  assert.deepEqual(kinds('The old line.', 'The old line, edited.\nA new line.'), ['mod', 'add'])
})

test('continuing a paragraph at length is still an edit', () => {
  assert.deepEqual(
    kinds('The cat sat.', 'The cat sat. Then it got up and walked away over the far hill.'),
    ['mod'])
})

test('fixing a typo in a one-word line is still an edit', () => {
  assert.deepEqual(kinds('Helo', 'Hello'), ['mod'])
})

test('a removed line before an edited one is removed, not overwritten', () => {
  assert.deepEqual(kinds('Gone for good now.\nThe old line.', 'The old line, edited.'), ['del', 'mod'])
})

test('a line replaced by something unrelated is erased, then written', () => {
  assert.deepEqual(kinds('The storm broke at dawn.', 'Nobody answered her letters.'), ['del', 'add'])
})

test('edited lines keep their own partners when lines are added between them', () => {
  const a = 'The storm broke at dawn.\nNobody answered her letters.'
  const b = 'The storm broke at dawn, loud.\nA whole new thought here.\nNobody answered her many letters.'
  assert.deepEqual(kinds(a, b), ['mod', 'add', 'mod'])
})

test('the chunks always rebuild the new text', () => {
  const cases = [
    ['A one.\nB two.\nC three.', 'X new.\nC three, more.\nY new.\nA one.'],
    ['', 'Only line.'],
    ['Only line.', ''],
    ['One.\n\nTwo.', 'One.\nFresh line.\n\nTwo, changed.'],
    ['a b c\nd e f\ng h i', 'g h i x\nd e f y\na b c z']
  ]
  for (const [a, b] of cases) assert.equal(play(a, b), cleanProse(b), JSON.stringify([a, b]))
})

test('a very large rewrite skips the pairing and still rebuilds the text', () => {
  const lines = (tag) => Array.from({ length: 300 }, (_, i) => `${tag} line number ${i}`).join('\n')
  assert.equal(play(lines('old'), lines('new')), cleanProse(lines('new')))
})

test('in-place edits of a pair still reproduce the new text', () => {
  const [ch] = diffParagraphs('The old line.', 'The old line, edited.')
  let s = ch.before
  for (const e of inlineChange(ch.before, ch.after).edits) {
    s = e.type === 'ins' ? s.slice(0, e.pos) + e.ch + s.slice(e.pos) : s.slice(0, e.pos) + s.slice(e.pos + 1)
  }
  assert.equal(s, ch.after)
})
