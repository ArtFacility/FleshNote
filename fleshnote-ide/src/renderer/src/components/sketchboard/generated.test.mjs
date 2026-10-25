// Run with: node --test src/renderer/src/components/sketchboard/generated.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  genLayout,
  genNodeId,
  membershipState,
  nodeStateFrom,
  relationState,
  relationshipEdges,
  relStyle
} from './generated.js'
import { chapterPoint, makeTimeContext } from './timeline.js'

const parseDay = (text) => (/^\d+$/.test(text) ? Number(text) : null)
const ctx = makeTimeContext(
  [
    { id: 'ch-1', chapter_number: 1, world_time: '100' },
    { id: 'ch-2', chapter_number: 2, world_time: '200' },
    { id: 'ch-3', chapter_number: 3, world_time: '' }
  ],
  parseDay
)
const at = (id, axis = 'reading') => chapterPoint(ctx, axis, id)

// The same turning points as the backend's parity test (test_boards.py).
const r1 = { id: 'r1', rel_type: 'friendship', mutual: false, chapter_number: null, day: null }
const r3 = { id: 'r3', rel_type: 'love', mutual: true, chapter_number: 1, day: 100 }
const r2 = { id: 'r2', rel_type: 'hate', mutual: false, chapter_number: 2, day: 200 }
const pairs = [
  { from: 'A', to: 'B', history: [r1, r3, r2] },
  { from: 'B', to: 'A', history: [r3] }
]

test('node ids are the same everywhere, valid row ids, and per board', () => {
  const id = genNodeId('board-1', 'character', 'A')
  assert.equal(id, genNodeId('board-1', 'character', 'A'))
  assert.match(id, /^g[0-9a-f]{16}$/)
  assert.notEqual(id, genNodeId('board-2', 'character', 'A'))
  assert.notEqual(id, genNodeId('board-1', 'group', 'A'))
})

test('a direction reads the latest turning point not past the chapter', () => {
  const h = pairs[0].history
  assert.deepEqual(relationState(h, 'reading', at('ch-1'), ctx), { row: r3, state: 'new' })
  assert.deepEqual(relationState(h, 'reading', at('ch-2'), ctx), { row: r2, state: 'new' })
  assert.deepEqual(relationState(h, 'reading', at('ch-3'), ctx), { row: r2, state: 'present' })
  assert.deepEqual(relationState(h, 'reading', null, ctx), { row: r2, state: 'always' })
  assert.deepEqual(relationState([r2], 'reading', at('ch-1'), ctx), { row: r2, state: 'future' })
})

test('on world time, undated turning points always count', () => {
  const h = pairs[0].history
  assert.equal(relationState(h, 'world', at('ch-1', 'world'), ctx).row.id, 'r3')
  assert.equal(relationState(h, 'world', { at: 50, prev: 49 }, ctx).row.id, 'r1')
  assert.equal(relationState([r2], 'world', { at: 150, prev: 100 }, ctx).state, 'future')
})

test('a shared mutual turning point is one line with two arrowheads', () => {
  const ch1 = relationshipEdges(pairs, 'reading', at('ch-1'), ctx)
  assert.deepEqual(
    ch1.map((e) => [e.key, e.row.id, e.mutual]),
    [['A>B', 'r3', true]]
  )
  const ch2 = relationshipEdges(pairs, 'reading', at('ch-2'), ctx)
  assert.deepEqual(
    ch2.map((e) => [e.key, e.row.id, e.mutual]),
    [
      ['A>B', 'r2', false],
      ['B>A', 'r3', false]
    ]
  )
})

test('memberships follow world dates; reading order uses the chapter date', () => {
  const link = { joined_day: 150, left_day: 250, joined_date: 'x', left_date: 'y' }
  assert.equal(membershipState(link, 'reading', at('ch-1'), ctx), 'future')
  assert.equal(membershipState(link, 'reading', at('ch-2'), ctx), 'new')
  // Chapter 3 has no date of its own: it reads as chapter 2's.
  assert.equal(membershipState(link, 'reading', at('ch-3'), ctx), 'new')
  assert.equal(membershipState(link, 'world', { at: 300, prev: 200 }, ctx), 'ended')
  assert.equal(membershipState(link, 'world', null, ctx), 'ended')
  assert.equal(membershipState({ joined_day: null, left_day: null }, 'world', null, ctx), 'always')
})

test('layout, looks and node states', () => {
  const layout = genLayout('relationships', [
    { type: 'character', id: 'A' },
    { type: 'character', id: 'B' }
  ])
  assert.notDeepEqual(layout.get('character:A'), layout.get('character:B'))
  assert.deepEqual(relStyle('Love'), { color_token: 'red', conn_type: 'solid' })
  assert.deepEqual(relStyle('rivals'), { color_token: 'neutral', conn_type: 'solid' })
  assert.equal(nodeStateFrom(['future', 'future']), 'future')
  assert.equal(nodeStateFrom(['future', 'present']), 'always')
})
