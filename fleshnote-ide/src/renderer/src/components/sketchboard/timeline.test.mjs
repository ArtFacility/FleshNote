// Run with: node --test src/renderer/src/components/sketchboard/timeline.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  chapterPoint,
  dayPoint,
  itemSpan,
  joinSpans,
  makeTimeContext,
  startMarks,
  timeState,
  worldRange
} from './timeline.js'

// World dates in these tests are plain day numbers.
const parseDay = (text) => (/^\d+$/.test(text) ? Number(text) : null)
const chapters = [
  { id: 'c3', chapter_number: 3, title: 'Three', world_time: '300' },
  { id: 'c1', chapter_number: 1, title: 'One', world_time: '100' },
  { id: 'c2', chapter_number: 2, title: 'Two', world_time: '' },
  { id: 'c4', chapter_number: 4, title: 'Four', world_time: 'Spring, year of ash' }
]
const ctx = makeTimeContext(chapters, parseDay)
const item = (fields = {}) => ({
  appears_chapter_id: null,
  ends_chapter_id: null,
  appears_world_time: null,
  ends_world_time: null,
  appears_auto: false,
  first_chapter_id: null,
  ...fields
})
const at = (chapterId, axis = 'reading') => chapterPoint(ctx, axis, chapterId)

test('chapters are read in order, with their dates when readable', () => {
  assert.deepEqual(
    ctx.stops.map((s) => [s.id, s.index, s.day]),
    [
      ['c1', 0, 100],
      ['c2', 1, null],
      ['c3', 2, 300],
      ['c4', 3, null]
    ]
  )
})

test('reading order: not yet, appears here, there, ended', () => {
  const span = itemSpan(item({ appears_chapter_id: 'c2', ends_chapter_id: 'c4' }), 'reading', ctx)
  assert.deepEqual(span, { start: 1, end: 3 })
  assert.deepEqual(
    ['c1', 'c2', 'c3', 'c4'].map((c) => timeState(span, at(c))),
    ['future', 'new', 'present', 'ended']
  )
})

test('nothing set, or no point chosen, draws as usual', () => {
  assert.equal(timeState(itemSpan(item(), 'reading', ctx), at('c2')), 'always')
  assert.equal(timeState({ start: 1, end: null }, null), 'always')
})

test('first mention: follows the entity, and waits while it is never mentioned', () => {
  const met = item({ appears_auto: true, first_chapter_id: 'c3', appears_chapter_id: 'c1' })
  assert.equal(itemSpan(met, 'reading', ctx).start, 2)
  assert.equal(itemSpan(met, 'world', ctx).start, 300)
  const unmet = item({ appears_auto: true })
  assert.equal(timeState(itemSpan(unmet, 'reading', ctx), at('c4')), 'future')
})

test('world time: own date first, else the chapter date', () => {
  assert.deepEqual(itemSpan(item({ appears_world_time: '150' }), 'world', ctx), {
    start: 150,
    end: null
  })
  assert.deepEqual(
    itemSpan(item({ appears_chapter_id: 'c3', ends_world_time: 'soon' }), 'world', ctx),
    { start: 300, end: null }
  )
})

test('world time follows the open chapter, and undated chapters use the date before', () => {
  assert.deepEqual(at('c3', 'world'), { at: 300, prev: 100 })
  assert.deepEqual(at('c2', 'world'), { at: 100, prev: 99 })
  assert.deepEqual(at('c4', 'world'), { at: 300, prev: 100 })
  const span = itemSpan(item({ appears_world_time: '200' }), 'world', ctx)
  assert.equal(timeState(span, at('c1', 'world')), 'future')
  assert.equal(timeState(span, at('c3', 'world')), 'new')
  assert.equal(timeState(span, dayPoint(ctx, 250)), 'new')
  assert.equal(timeState(span, dayPoint(ctx, 500)), 'present')
})

test('a connection is there only while both ends are', () => {
  const a = { start: 0, end: null }
  const b = { start: 2, end: 3 }
  const own = { start: null, end: null }
  const span = joinSpans(own, a, b)
  assert.deepEqual(span, { start: 2, end: 3 })
  assert.equal(timeState(span, at('c2')), 'future')
  assert.equal(timeState(joinSpans(own, own, own), at('c2')), 'always')
})

test('the ruler covers every date, padded when they bunch up', () => {
  assert.deepEqual(worldRange(ctx, [{ start: 50, end: Infinity }]), [50, 300])
  assert.deepEqual(worldRange(makeTimeContext([], parseDay), [{ start: 10, end: null }]), [-20, 40])
  assert.equal(worldRange(makeTimeContext([], parseDay), []), null)
  assert.deepEqual([...startMarks([{ start: 1 }, { start: 1 }, { start: Infinity }])], [[1, 2]])
})
