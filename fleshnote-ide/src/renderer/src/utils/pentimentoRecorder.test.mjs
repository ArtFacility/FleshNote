import test from 'node:test'
import assert from 'node:assert/strict'
import PentimentoRecorder, { FOCUS_MIN_MS, FOCUS_MIN_WORDS } from './pentimentoRecorder.js'

function mockApi() {
  const calls = []
  let seq = 1
  return {
    calls,
    pentimentoSessionStart: async (p) => {
      const id = `sess-${seq++}`
      calls.push(['start', id, p])
      return { session_id: id, session_num: seq - 1, previous_session_hash: null }
    },
    pentimentoFlush: async (p) => {
      calls.push(['flush', p.session_id, p.ops.length, p])
      return { status: 'ok', written: p.ops.length }
    },
    pentimentoSessionEnd: async (p) => {
      calls.push(['end', p.session_id, p])
      return { status: 'ok', session_hash: 'aa'.repeat(32) }
    },
  }
}

test('short Focus Mode peek (<50 words & <5 min) drops focus flag and avoids session split', async () => {
  const api = mockApi()
  const rec = new PentimentoRecorder(api)
  rec._recovered = true

  await rec.start('/proj', '1', true)
  // Simulate pre-focus normal session already started on backend
  rec.s.sessionId = 'sess-pre'
  rec.s.buffer.push({ timestamp: '2026-11-18T10:00:00Z', op_type: 'insert', para_index: 0, char_offset: 0, length: 5, text_content: 'Hello', duration_ms: 100, source: 'human', seq: 0 })

  rec.enterFocus({
    mode: 'zen',
    goal: 400,
    startWordCount: 10,
    startTime: Date.now(),
    preFocusHtml: '<p>Hello</p>',
  })
  // Type 12 words in Focus Mode
  rec.s.buffer.push({ timestamp: '2026-11-18T10:00:10Z', op_type: 'insert', para_index: 0, char_offset: 5, length: 12, text_content: ' test words!', duration_ms: 200, source: 'human', seq: 1 })
  assert.equal(rec.updateFocusProgress(12), false)

  const wasPureFocus = await rec.exitFocus({ completed: false, wordsWritten: 12 })
  assert.equal(wasPureFocus, false)
  assert.equal(rec.s.sessionId, 'sess-pre')
  assert.equal(rec.s.focus, null)
  assert.equal(rec.s.focusHold, null)
  assert.equal(rec.s.buffer.length, 2)
  assert.equal(api.calls.filter(c => c[0] === 'start').length, 0)
  assert.equal(api.calls.filter(c => c[0] === 'end').length, 0)
  rec.stop()
})

test('Focus Mode >=50 words splits pre-focus session with preFocusHtml and seals pure Focus session on completion', async () => {
  const api = mockApi()
  const rec = new PentimentoRecorder(api)
  rec._recovered = true

  await rec.start('/proj', '1', true)
  rec.s.sessionId = 'sess-pre'
  rec.s.buffer.push({ timestamp: '2026-11-18T10:00:00Z', op_type: 'insert', para_index: 0, char_offset: 0, length: 5, text_content: 'Intro', duration_ms: 100, source: 'human', seq: 0 })

  rec.enterFocus({
    mode: 'zen',
    goal: 400,
    startWordCount: 1,
    startTime: Date.now(),
    preFocusHtml: '<p>Intro</p>',
  })
  rec.s.buffer.push({ timestamp: '2026-11-18T10:01:00Z', op_type: 'insert', para_index: 0, char_offset: 5, length: 20, text_content: ' focus burst here...', duration_ms: 300, source: 'human', seq: 1 })

  // Cross 50 words threshold -> promotes cleanly
  const promoted = rec.updateFocusProgress(FOCUS_MIN_WORDS)
  assert.equal(promoted, true)
  assert.equal(rec.s.focus?.mode, 'zen')
  assert.equal(rec.s.focus?.category, 'rewarding')
  assert.equal(rec.s.focus?.goal, 400)
  await rec.s.flushChain

  // Finish Focus Mode successfully
  const sealedFocus = await rec.exitFocus({ completed: true, wordsWritten: 400 })
  assert.equal(sealedFocus, true)

  const preEnd = api.calls.find(c => c[0] === 'end' && c[1] === 'sess-pre')
  assert.equal(preEnd[2].snapshot_html, '<p>Intro</p>')
  const focusStart = api.calls.find(c => c[0] === 'start' && c[2].focus_mode === 'zen')
  assert.ok(focusStart)
  assert.equal(focusStart[2].focus_category, 'rewarding')
  const focusEnd = api.calls.find(c => c[0] === 'end' && c[1] === focusStart[1])
  assert.equal(focusEnd[2].focus_completed, true)
  assert.equal(focusEnd[2].focus_mode, 'zen')
  // Afterwards recorder is back on a lazy normal session
  assert.equal(rec.s.focus, null)
  assert.equal(rec.s.sessionId, null)
  rec.stop()
})

test('Focus Mode >=5 minutes promotes even with fewer than 50 words', async () => {
  const api = mockApi()
  const rec = new PentimentoRecorder(api)
  rec._recovered = true
  try {
    await rec.start('/proj', '1', true)
    rec.enterFocus({
      mode: 'kamikaze',
      goal: 150,
      startWordCount: 0,
      startTime: Date.now() - FOCUS_MIN_MS - 1000,
      preFocusHtml: '<p></p>',
    })
    // 5+ minutes with 0 edits must NOT spawn an empty backend session
    assert.equal(rec.updateFocusProgress(0), false)
    assert.equal(api.calls.filter(c => c[0] === 'start').length, 0)

    // Once at least one edit lands in focus mode, 5+ minutes promotes cleanly
    rec.s.buffer.push({ timestamp: '2026-11-18T10:06:00Z', op_type: 'insert', para_index: 0, char_offset: 0, length: 5, text_content: 'Hello', duration_ms: 100, source: 'human', seq: 0 })
    assert.equal(rec.updateFocusProgress(18), true)
    await rec.s.starting
    await rec.s.flushChain
    const startCall = api.calls.find(c => c[0] === 'start')
    assert.ok(startCall)
    assert.equal(startCall[2].focus_mode, 'kamikaze')
    assert.equal(startCall[2].focus_category, 'punishing')
  } finally {
    await rec.stop()
  }
})
