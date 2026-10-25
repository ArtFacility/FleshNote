// Fuzz check for the Pentimento recorder: random ProseMirror edits go through
// onTransaction, and replaying the recorded ops on the starting text must give
// the final text exactly. Also checks how edits are attributed (typed/pasted/machine).
//
//   node scripts/check_pentimento_recorder.mjs [cases=300] [seed=1]

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { schema } from '@tiptap/pm/schema-basic'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
const mod = await import(pathToFileURL(join(root, 'src/renderer/src/utils/pentimentoRecorder.js')).href)
const { default: PentimentoRecorder, flatInfo } = mod

const CASES = Number(process.argv[2] || 300)
let seed = Number(process.argv[3] || 1)
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (n) => Math.floor(rnd() * n)

let clock = Date.parse('2026-10-01T09:00:00Z')
const realNow = Date.now
Date.now = () => clock

const WORDS = ['the', 'harbor', 'lamp', 'Ilona', 'és', 'ő', 'night', 'wall', 'll', 'a', 'éé', 'quiet']
const para = (t) => schema.nodes.paragraph.create(null, t ? schema.text(t) : null)

// Random text position: inside a random textblock.
function textPos(doc) {
  const blocks = []
  doc.forEach((n, off) => { if (n.isTextblock) blocks.push({ n, off }) })
  const b = pick(blocks)
  return b.off + 1 + int(b.n.content.size + 1)
}

function replay(start, ops) {
  let s = start
  for (const o of ops) {
    if (o.op_type === 'pause') continue
    const lines = s.split('\n')
    if (o.para_index >= lines.length) return { error: `para ${o.para_index} past ${lines.length} lines`, o }
    let base = 0
    for (let i = 0; i < o.para_index; i++) base += lines[i].length + 1
    const at = base + o.char_offset
    if (o.op_type === 'delete') {
      const got = s.slice(at, at + o.length)
      if (got !== o.text_content) return { error: `delete mismatch: have ${JSON.stringify(got)}`, o }
      s = s.slice(0, at) + s.slice(at + o.length)
    } else {
      if (at > s.length) return { error: 'insert past end', o }
      s = s.slice(0, at) + o.text_content + s.slice(at)
    }
  }
  return { text: s }
}

// One edit: returns { tr, hint, appended? } built on `state`.
function randomEdit(state) {
  const doc = state.doc
  const kind = pick(['type', 'type', 'type', 'word', 'split', 'join', 'del', 'delCross', 'overwrite', 'paste', 'pasteParas', 'delSplit', 'heading', 'br', 'appended', 'mention'])
  const tr = state.tr
  switch (kind) {
    case 'type': { const p = textPos(doc); tr.insertText(pick(['a', 'l', ' ', 'é', '.', 'e']), p); return { kind, tr, hint: 'text' } }
    case 'word': { const p = textPos(doc); tr.insertText(pick(WORDS) + ' ', p); return { kind, tr, hint: 'text' } }
    case 'split': { const p = textPos(doc); tr.split(p); return { kind, tr, hint: 'key', expect: 'human' } }
    case 'join': {
      const joins = []
      doc.forEach((n, off, i) => { if (i > 0 && n.isTextblock && doc.child(i - 1).isTextblock) joins.push(off) })
      if (!joins.length) return null
      tr.join(pick(joins)); return { kind, tr, hint: 'key', expect: 'human' }
    }
    case 'del': { const p = textPos(doc); const $p = doc.resolve(p); const end = Math.min(p + 1 + int(6), $p.end()); if (end <= p) return null; tr.delete(p, end); return { kind, tr, hint: 'key', expect: 'human' } }
    case 'delCross': { const a = textPos(doc), b = textPos(doc); if (a === b) return null; tr.delete(Math.min(a, b), Math.max(a, b)); return { kind, tr, hint: 'key' } }
    case 'overwrite': { const a = textPos(doc); const $a = doc.resolve(a); const b = Math.min(a + int(8), $a.end()); tr.insertText(pick(WORDS), a, b); return { kind, tr, hint: 'text' } }
    case 'paste': { const a = textPos(doc); tr.insertText('A long pasted passage that is clearly more than forty characters.', a); return { kind, tr, hint: 'paste', expect: 'paste' } }
    case 'pasteParas': {
      const a = textPos(doc), b = textPos(doc)
      tr.replace(Math.min(a, b), Math.max(a, b), new Slice(Fragment.from([para('first pasted'), para(''), para('third pasted')]), 1, 1))
      return { kind, tr, hint: 'paste', expect: 'paste' }
    }
    case 'delSplit': { const a = textPos(doc); const $a = doc.resolve(a); const b = Math.min(a + int(5), $a.end()); tr.delete(a, b); tr.split(a); return { kind, tr, hint: 'key' } }
    case 'heading': { const p = textPos(doc); const $p = doc.resolve(p); tr.setBlockType($p.before(1), $p.after(1), schema.nodes.heading, { level: 2 }); return { kind, tr, hint: null } }
    case 'br': { const p = textPos(doc); tr.replaceWith(p, p, schema.nodes.hard_break.create()); return { kind, tr, hint: 'key', expect: 'human' } }
    case 'appended': {
      const p = textPos(doc); tr.insertText('x', p)
      const next = state.apply(tr)
      const tr2 = next.tr.insert(next.doc.content.size, para(''))
      return { kind, tr, hint: 'text', appended: [tr2] }
    }
    case 'mention': {
      // Enter picks a suggestion: a key hint, but the inserted name is machine work
      const p = textPos(doc); tr.insertText('Ilona Varga', p); return { kind, tr, hint: 'key', expect: 'machine' }
    }
  }
  return null
}

const api = {
  flushed: [],
  pentimentoSessionStart: async () => ({ session_id: 'S', previous_session_hash: null }),
  pentimentoFlush: async (req) => { api.flushed.push(...(req.ops || [])) },
  pentimentoSessionEnd: async () => ({}),
}

let failures = 0
const attribution = {}
for (let c = 0; c < CASES; c++) {
  api.flushed = []
  store.clear()
  const rec = new PentimentoRecorder(api)
  await rec.start('P', 'C', true)
  let state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [para('Az éjjel csendes volt.'), para(''), para('Nobody came to the wall.')]) })
  const startText = flatInfo(state.doc).flat
  const steps = 5 + int(60)
  const log = []
  for (let k = 0; k < steps; k++) {
    let e
    try { e = randomEdit(state) } catch { e = null }
    if (!e || !e.tr.docChanged) continue
    clock += rnd() < 0.1 ? 3000 + int(20000) : 40 + int(400)
    if (e.hint) rec.hint(e.hint)
    const before = state
    state = state.apply(e.tr)
    let appended = []
    if (e.appended) { appended = e.appended; for (const t of appended) state = state.apply(t) }
    const nOps = rec.s.buffer.length + api.flushed.length
    rec.onTransaction(e.tr, appended)
    log.push(e.kind)
    if (e.expect) {
      const all = [...api.flushed, ...rec.s.buffer]
      const fresh = all.slice(nOps).filter((o) => o.op_type !== 'pause')
      const cur = rec.s.pending ? [{ source: rec.s.pending.source, text_content: rec.s.pending.text }] : []
      const srcs = new Set([...fresh, ...cur].map((o) => o.source))
      const key = `${e.kind}→${e.expect}`
      attribution[key] = attribution[key] || { ok: 0, bad: 0 }
      if (srcs.has(e.expect)) attribution[key].ok++
      else attribution[key].bad++
    }
    void before
  }
  rec._flushPending(rec.s)
  await rec.s.flushChain
  const ops = [...api.flushed, ...rec.s.buffer].sort((a, b) =>
    (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.seq - b.seq))
  const r = replay(startText, ops)
  const want = flatInfo(state.doc).flat
  if (r.error || r.text !== want) {
    failures++
    if (failures <= 5) {
      console.log(`case ${c} FAILED: ${r.error || 'text differs'}`)
      console.log('  edits:', log.join(' '))
      if (r.o) console.log('  op:', JSON.stringify(r.o))
      if (!r.error) console.log('  want:', JSON.stringify(want), '\n  got: ', JSON.stringify(r.text))
    }
  }
}
// Switching chapters: the old session is sealed only after its chapter is saved,
// and typing in the new chapter goes to a session of its own.
const calls = []
let nextId = 0
const api2 = {
  pentimentoSessionStart: async (r) => { calls.push(`start ${r.chapter_id}`); return { session_id: `S${++nextId}` } },
  pentimentoFlush: async (r) => { calls.push(`flush ${r.session_id} ${r.ops.filter((o) => o.op_type !== 'pause').map((o) => o.text_content).join('')}`) },
  pentimentoSessionEnd: async (r) => { calls.push(`end ${r.session_id}`) },
}
store.clear()
const rec2 = new PentimentoRecorder(api2)
rec2.start('P', 'A', true)
let st2 = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [para('')]) })
const typeInto = (text) => { for (const ch of text) { clock += 100; rec2.hint('text'); const tr = st2.tr.insertText(ch, st2.doc.content.size - 1); st2 = st2.apply(tr); rec2.onTransaction(tr) } }
typeInto('abc')
await new Promise((r) => setTimeout(r, 0))
let saved
const saving = new Promise((r) => { saved = r })
rec2.start('P', 'B', true, { beforeSeal: saving.then(() => calls.push('saved A')) })
st2 = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [para('')]) })
typeInto('xyz')
await new Promise((r) => setTimeout(r, 5))
saved()
await rec2.stop({ beforeSeal: Promise.resolve().then(() => calls.push('saved B')) })
const order = calls.join(' | ')
const at = (c) => calls.indexOf(c)
const before = (a, b) => at(a) >= 0 && at(b) >= 0 && at(a) < at(b)
const switchOk = before('start A', 'flush S1 abc') && before('flush S1 abc', 'end S1') &&
  before('saved A', 'end S1') && before('end S1', 'start B') &&
  before('start B', 'flush S2 xyz') && before('flush S2 xyz', 'end S2') && before('saved B', 'end S2') &&
  calls.length === 8
console.log(`chapter switch: ${switchOk ? 'ok' : 'WRONG'} (${order})`)
if (!switchOk) failures++

// Typing speed: a steady 200 ms per character is 60 WPM.
store.clear()
const rec3 = new PentimentoRecorder(api)
rec3.start('P', 'W', true)
let st3 = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [para('')]) })
for (const ch of 'The harbor was quiet that night and the lamps burned low. ') {
  clock += 200
  rec3.hint('text')
  const tr = st3.tr.insertText(ch, st3.doc.content.size - 1)
  st3 = st3.apply(tr)
  rec3.onTransaction(tr)
}
const speeds = rec3.s.wpmSamples.slice(1).map((t) => t[2])
const wpmOk = speeds.length >= 9 && speeds.every((w) => w >= 57 && w <= 63)
console.log(`typing speed: ${wpmOk ? 'ok' : 'WRONG'} (${speeds.join(' ')} wpm for a steady 60)`)
if (!wpmOk) failures++

Date.now = realNow
console.log(`${CASES - failures}/${CASES} sessions reconstruct exactly`)
console.log('attribution:', JSON.stringify(attribution))
const badAttr = Object.values(attribution).reduce((n, a) => n + a.bad, 0)
process.exit(failures || badAttr ? 1 : 0)
