// Run with: node --test src/renderer/src/components/sketchboard/canvasFile.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { fromJsonCanvas, toJsonCanvas } from './canvasFile.js'
import { EDGE_FIELDS, NODE_FIELDS } from './patch.js'

const node = (id, extra = {}) => ({
  id,
  name: id,
  description: '',
  shape: 'card',
  color_token: 'neutral',
  pos_x: 10.4,
  pos_y: 20,
  size_x: 160,
  size_y: 64,
  props: [],
  ...extra
})
const nodes = [
  node('a', {
    name: 'Ember',
    description: 'A spark.',
    color_token: 'red',
    props: [['Cost', 'a memory']]
  }),
  node('f', { name: 'School', shape: 'frame', size_x: 400, size_y: 300 }),
  node('b', { entity_name: 'Sophia', name: 'old', shape: 'text' })
]
const edges = [
  {
    id: 'e',
    item_start_id: 'a',
    item_end_id: 'b',
    from_side: 'right',
    to_side: 'auto',
    start_marker: 'none',
    end_marker: 'dot',
    color_token: 'blue',
    title: 'fuels'
  },
  { id: 'gone', item_start_id: 'a', item_end_id: 'x' }
]

test('a board becomes JSON Canvas: groups first, text cards, sides and arrows', () => {
  const doc = JSON.parse(toJsonCanvas(nodes, edges))
  assert.deepEqual(
    doc.nodes.map((n) => [n.id, n.type]),
    [
      ['f', 'group'],
      ['a', 'text'],
      ['b', 'text']
    ]
  )
  const a = doc.nodes.find((n) => n.id === 'a')
  assert.equal(a.text, '**Ember**\n\nA spark.\n\n- Cost: a memory')
  assert.deepEqual([a.x, a.color], [10, '1'])
  assert.equal(doc.nodes.find((n) => n.id === 'b').text, 'Sophia')
  assert.equal(doc.nodes.find((n) => n.id === 'f').label, 'School')
  assert.deepEqual(doc.edges, [
    {
      id: 'e',
      fromNode: 'a',
      fromSide: 'right',
      fromEnd: 'none',
      toNode: 'b',
      toEnd: 'arrow',
      color: '5',
      label: 'fuels'
    }
  ])
})

test('and back: a valid batch with new ids, names from the first line', () => {
  let n = 0
  const ops = fromJsonCanvas(toJsonCanvas(nodes, edges), () => `id${++n}`)
  const put = (kind) => ops.filter((o) => o.op === kind)
  assert.equal(put('put_node').length, 3)
  assert.equal(put('put_edge').length, 1)
  for (const o of ops)
    for (const f of Object.keys(o.fields))
      assert.ok((o.op === 'put_node' ? NODE_FIELDS : EDGE_FIELDS).includes(f), f)
  const ember = put('put_node').find((o) => o.fields.name === 'Ember')
  assert.equal(ember.fields.description, 'A spark.\n\n- Cost: a memory')
  assert.equal(ember.fields.color_token, 'red')
  assert.equal(put('put_node').find((o) => o.fields.name === 'School').fields.shape, 'frame')
  const e = put('put_edge')[0].fields
  assert.equal(e.item_start_id, ember.id)
  assert.deepEqual(
    [e.from_side, e.to_side, e.end_marker, e.title],
    ['right', 'auto', 'arrow', 'fuels']
  )
  // Nodes go in before the connections that use them.
  assert.ok(
    ops.findIndex((o) => o.op === 'put_edge') > ops.findLastIndex((o) => o.op === 'put_node')
  )
})

test('files from elsewhere: headings, file and link cards, odd values', () => {
  const doc = {
    nodes: [
      { id: '1', type: 'text', text: '# Heading\nbody', x: 0, y: 0, width: 100, height: 50 },
      { id: '2', type: 'file', file: 'notes/Ash Rite.md', x: 'x', y: 0, width: 1e9, height: 5 },
      {
        id: '3',
        type: 'link',
        url: 'https://example.com',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: '#ff0000'
      }
    ],
    edges: [
      { id: 'a', fromNode: '1', toNode: '1' },
      { id: 'b', fromNode: '1', toNode: '9' },
      { id: 'c', fromNode: '1', toNode: '2', toEnd: 'none' }
    ]
  }
  let n = 0
  const ops = fromJsonCanvas(JSON.stringify(doc), () => `id${++n}`)
  const names = ops.filter((o) => o.op === 'put_node').map((o) => o.fields.name)
  assert.deepEqual(names, ['Heading', 'Ash Rite', 'https://example.com'])
  const file = ops[1].fields
  assert.deepEqual([file.pos_x, file.size_x, file.size_y], [-1e6, 4000, 20])
  assert.equal(ops[2].fields.color_token, 'neutral')
  const edgesOut = ops.filter((o) => o.op === 'put_edge')
  assert.equal(edgesOut.length, 1)
  assert.equal(edgesOut[0].fields.end_marker, 'none')
  assert.throws(() => fromJsonCanvas('{"foo": 1}', () => 'x'))
  assert.throws(() => fromJsonCanvas('not json', () => 'x'))
})

test('an unlabelled line of a legend type is labelled with the type name', () => {
  const typed = [
    { ...edges[0], id: 't', title: '', type_id: 'ty' },
    { ...edges[0], id: 'own', title: 'mine', type_id: 'ty' }
  ]
  const doc = JSON.parse(toJsonCanvas(nodes, typed, [{ id: 'ty', name: 'Trade' }]))
  assert.deepEqual(
    doc.edges.map((e) => e.label),
    ['Trade', 'mine']
  )
})
