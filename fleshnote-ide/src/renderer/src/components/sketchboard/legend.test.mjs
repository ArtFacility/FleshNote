// Run with: node --test src/renderer/src/components/sketchboard/legend.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignPatch,
  entryNamed,
  isCustom,
  labelPatch,
  localiseRefs,
  removeEntryPatch,
  saveAsEntryPatch,
  updateEntryPatch
} from './legend.js'
import { applyPatch, patchToOps } from './patch.js'

const type = {
  id: 't1',
  name: 'Fuels',
  color_token: 'red',
  conn_type: 'dashed',
  start_marker: 'none',
  end_marker: 'arrow',
  sort_order: 0
}
const edge = (id, extra = {}) => ({
  id,
  item_start_id: 'a',
  item_end_id: 'b',
  color_token: 'neutral',
  conn_type: 'solid',
  start_marker: 'none',
  end_marker: 'arrow',
  title: '',
  type_id: null,
  ...extra
})
const typed = (id, extra = {}) =>
  edge(id, { color_token: 'red', conn_type: 'dashed', type_id: 't1', ...extra })

test('assigning a type copies its look', () => {
  const p = assignPatch('types', [edge('e1')], type)
  assert.deepEqual(
    [p.edges.e1.color_token, p.edges.e1.conn_type, p.edges.e1.type_id],
    ['red', 'dashed', 't1']
  )
})

test('restyling a type moves only the edges still wearing its look', () => {
  const edges = [typed('e1'), typed('e2', { color_token: 'blue' }), edge('e3')]
  const p = updateEntryPatch('types', type, { color_token: 'green' }, edges)
  assert.equal(p.types.t1.color_token, 'green')
  assert.deepEqual(Object.keys(p.edges), ['e1'])
  assert.equal(p.edges.e1.color_token, 'green')
  assert.equal(p.edges.e1.conn_type, 'dashed')
})

test('undoing a restyle restores the type and its edges', () => {
  const state = { types: [type], edges: [typed('e1'), typed('e2', { color_token: 'blue' })] }
  const after = updateEntryPatch('types', type, { conn_type: 'dotted' }, state.edges)
  const before = {
    types: { t1: type },
    edges: Object.fromEntries(
      Object.keys(after.edges).map((id) => [id, state.edges.find((e) => e.id === id)])
    )
  }
  const restyled = {
    types: applyPatch(state.types, after.types),
    edges: applyPatch(state.edges, after.edges)
  }
  assert.equal(restyled.edges[0].conn_type, 'dotted')
  const undone = {
    types: applyPatch(restyled.types, before.types),
    edges: applyPatch(restyled.edges, before.edges)
  }
  assert.deepEqual(undone, state)
  // The undo saves the type and the one restyled edge, type first.
  assert.deepEqual(
    patchToOps(after, before).map((o) => [o.op, o.id, o.fields]),
    [
      ['put_type', 't1', { conn_type: 'dashed' }],
      ['put_edge', 'e1', { conn_type: 'dashed' }]
    ]
  )
})

test('renaming a type renames labels that were its old name', () => {
  const edges = [typed('e1', { title: 'fuels' }), typed('e2', { title: 'burns slowly' })]
  const p = updateEntryPatch('types', type, { name: 'Feeds' }, edges)
  assert.deepEqual(Object.keys(p.edges), ['e1'])
  assert.equal(p.edges.e1.title, 'Feeds')
})

test('deleting a type keeps the look and drops the link; legend deletes go last', () => {
  const edges = [typed('e1'), edge('e2')]
  const p = removeEntryPatch('types', type, edges)
  assert.equal(p.types.t1, null)
  assert.deepEqual(Object.keys(p.edges), ['e1'])
  assert.deepEqual([p.edges.e1.type_id, p.edges.e1.color_token], [null, 'red'])
  const before = { types: { t1: type }, edges: { e1: edges[0] } }
  assert.deepEqual(
    patchToOps(before, p).map((o) => o.op),
    ['put_edge', 'del_type']
  )
  // Undo brings the type back before the edge points at it again.
  assert.deepEqual(
    patchToOps(p, before).map((o) => o.op),
    ['put_type', 'put_edge']
  )
})

test('a label naming a type assigns it; any other label keeps the type', () => {
  const types = [type]
  assert.equal(labelPatch(edge('e1'), '  FUELS ', types).edges.e1.type_id, 't1')
  assert.equal(labelPatch(edge('e1'), '  FUELS ', types).edges.e1.color_token, 'red')
  const kept = labelPatch(typed('e1', { color_token: 'blue' }), 'only at night', types).edges.e1
  assert.deepEqual([kept.type_id, kept.color_token, kept.title], ['t1', 'blue', 'only at night'])
  // Re-typing the same type's name does not reset a hand-styled edge.
  assert.equal(
    labelPatch(typed('e1', { color_token: 'blue' }), 'Fuels', types).edges.e1.color_token,
    'blue'
  )
})

test('save as type creates the entry and gives it to the other edges with that label', () => {
  const src = edge('e1', { title: 'Counters', color_token: 'purple' })
  const twin = edge('e2', { title: 'counters' })
  const p = saveAsEntryPatch('types', 't9', ' Counters ', src, 3, [twin])
  assert.deepEqual(p.types.t9, {
    id: 't9',
    name: 'Counters',
    color_token: 'purple',
    conn_type: 'solid',
    start_marker: 'none',
    end_marker: 'arrow',
    sort_order: 3
  })
  assert.deepEqual(
    [p.edges.e1.type_id, p.edges.e2.type_id, p.edges.e2.color_token],
    ['t9', 't9', 'purple']
  )
  assert.deepEqual(
    patchToOps({ types: { t9: null }, edges: { e1: src, e2: twin } }, p).map((o) => o.op),
    ['put_type', 'put_edge', 'put_edge']
  )
})

test('kinds style nodes by shape and colour', () => {
  const kind = { id: 'k1', name: 'Source', shape: 'diamond', color_token: 'amber' }
  const nodes = [
    { id: 'n1', shape: 'diamond', color_token: 'amber', kind_id: 'k1' },
    { id: 'n2', shape: 'card', color_token: 'amber', kind_id: 'k1' }
  ]
  const p = updateEntryPatch('kinds', kind, { shape: 'hex' }, nodes)
  assert.deepEqual(Object.keys(p.nodes), ['n1'])
  assert.equal(p.nodes.n1.shape, 'hex')
  assert.equal(isCustom(nodes[1], kind, 'kinds'), true)
  assert.equal(isCustom(nodes[0], kind, 'kinds'), false)
})

test('names match ignoring case and spaces; empty never matches', () => {
  assert.equal(entryNamed([type], 'fuels')?.id, 't1')
  assert.equal(entryNamed([type, { ...type, id: 't2', name: '' }], '  '), null)
})

test('pasting onto another board drops legend links it does not have', () => {
  assert.equal(localiseRefs(typed('e1'), [], []).type_id, null)
  assert.equal(localiseRefs(typed('e1'), [type], []).type_id, 't1')
  assert.equal(localiseRefs({ id: 'n', kind_id: 'k1' }, [], []).kind_id, null)
})
