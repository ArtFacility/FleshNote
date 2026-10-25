// Run with: node --test src/renderer/src/components/sketchboard/templates.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { boardTemplates, templateOps } from './templates.js'
import { EDGE_FIELDS, KIND_FIELDS, NODE_FIELDS, TYPE_FIELDS } from './patch.js'

const t = (key, fallback, vars = {}) => fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k])
let n = 0
const uid = () => `id-${++n}`
const ALLOWED = {
  put_type: TYPE_FIELDS,
  put_kind: KIND_FIELDS,
  put_node: NODE_FIELDS,
  put_edge: EDGE_FIELDS
}
const ORDER = ['put_type', 'put_kind', 'put_node', 'put_edge']

for (const tpl of boardTemplates(t)) {
  test(`template ${tpl.id} is one valid batch`, () => {
    const ops = templateOps(tpl, uid)
    const seen = new Set()
    let last = 0
    for (const op of ops) {
      // Legend first, then nodes, then connections: every reference points back.
      const rank = ORDER.indexOf(op.op)
      assert.ok(rank >= last, `${op.op} after ${ORDER[last]}`)
      last = rank
      for (const f of Object.keys(op.fields)) assert.ok(ALLOWED[op.op].includes(f), `${op.op}.${f}`)
      for (const ref of ['kind_id', 'type_id', 'item_start_id', 'item_end_id'])
        if (op.fields[ref]) assert.ok(seen.has(op.fields[ref]), `${op.op}.${ref} points ahead`)
      if (op.op === 'put_type' || op.op === 'put_kind') assert.ok(op.fields.name.trim())
      if (op.op === 'put_edge') assert.notEqual(op.fields.item_start_id, op.fields.item_end_id)
      assert.ok(!seen.has(op.id), 'ids are unique')
      seen.add(op.id)
    }
    // Nodes of a kind wear its look; connections of a type wear theirs.
    const byId = Object.fromEntries(ops.map((o) => [o.id, o.fields]))
    for (const op of ops) {
      if (op.op === 'put_node' && op.fields.kind_id)
        assert.equal(op.fields.color_token, byId[op.fields.kind_id].color_token)
      if (op.op === 'put_edge') assert.equal(op.fields.conn_type, byId[op.fields.type_id].conn_type)
    }
  })
}

test('frames hold the nodes drawn inside them', () => {
  const tpl = boardTemplates(t).find((x) => x.id === 'tech_tree')
  const ops = templateOps(tpl, uid).filter((o) => o.op === 'put_node')
  const frames = ops.filter((o) => o.fields.shape === 'frame').map((o) => o.fields)
  for (const { fields: f } of ops.filter((o) => o.fields.shape !== 'frame')) {
    const inside = frames.some(
      (fr) =>
        f.pos_x >= fr.pos_x &&
        f.pos_y >= fr.pos_y &&
        f.pos_x + f.size_x <= fr.pos_x + fr.size_x &&
        f.pos_y + f.size_y <= fr.pos_y + fr.size_y
    )
    assert.ok(inside, `${f.name} sits in a tier`)
  }
})
