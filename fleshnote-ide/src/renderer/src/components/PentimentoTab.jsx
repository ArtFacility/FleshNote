import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { diffParagraphs, inlineChange, cleanProse } from '../utils/proseDiff'

// Continuous effort palette (no watercolor, no hard buckets). Churn slides teal→amber→red;
// night blends toward violet; heat (time) drives the fill intensity.
const CLEAN = [63, 160, 147], REWORK = [217, 151, 63], FOUGHT = [196, 84, 74], NIGHT = [138, 111, 208]
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))]
const clamp01 = v => Math.max(0, Math.min(1, v || 0))

function heatColor(p) {
  const c = clamp01(p.churn)
  let base = c < 0.5 ? mix(CLEAN, REWORK, c * 2) : mix(REWORK, FOUGHT, (c - 0.5) * 2)
  const n = clamp01(p.night_ratio)
  if (n > 0) base = mix(base, NIGHT, n * 0.65)
  return { rgb: base.join(','), alpha: Math.min(0.55, 0.05 + clamp01(p.heat) * 0.5) }
}

function htmlToParagraphs(html) {
  try {
    const doc = new DOMParser().parseFromString(html || '', 'text/html')
    return Array.from(doc.body.querySelectorAll('p, h1, h2, h3, h4, blockquote, pre')).map(b => b.textContent || '')
  } catch { return [] }
}

function fmtDuration(ms) {
  const s = Math.round((ms || 0) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

const countWords = (s) => { const t = (s || '').trim(); return t ? t.split(/\s+/).filter(Boolean).length : 0 }
const NBSP = / /g

// Stable per-device accent color from the device id (multi-device process view).
function deviceColor(id) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h}, 55%, 62%)`
}

function deviceLabel(id, currentDevice, t) {
  if (id === 'unknown') return t('pentimento.deviceUnknown', 'Unknown device')
  if (id && id === currentDevice) return t('pentimento.thisDevice', 'This device')
  return t('pentimento.deviceLabel', 'Device {{id}}', { id: (id || '').slice(0, 8) })
}

// Apply a full inlineChange edit list to a string (used for timeline scrubbing).
function applyEdits(str, edits) {
  let s = str
  for (const e of edits) {
    if (e.type === 'ins') s = s.slice(0, e.pos) + e.ch + s.slice(e.pos)
    else s = s.slice(0, e.pos) + s.slice(e.pos + 1)
  }
  return s
}

// Turn a writing session's captured ops into a per-inserted-char delay stream (ms),
// so a matched edit is typed with the writer's real cadence/pauses. Returns null
// when the ops don't reasonably match the text added in this transition — the
// caller then falls back to synthetic pacing (content is snapshot-driven either way).
function buildCadence(ops, insCount, addedText) {
  if (!ops || !ops.length || !insCount) return null
  const stream = []
  let opsText = ''
  for (const o of ops) {
    if (o.op_type !== 'insert' && o.op_type !== 'paste') continue
    const txt = (o.text_content || '').replace(NBSP, '')
    if (!txt.length) continue
    opsText += txt
    const per = Math.max(6, Math.min(180, Math.round((o.duration_ms || 0) / txt.length)))
    for (let k = 0; k < txt.length; k++) stream.push(per)
  }
  if (!stream.length) return null
  const A = addedText.replace(/\s+/g, '').length
  const O = opsText.replace(/\s+/g, '').length
  if (A > 0) { const r = O / A; if (r < 0.5 || r > 2) return null } // volumes too different → synthetic
  const out = new Array(insCount)
  for (let i = 0; i < insCount; i++) out[i] = i < stream.length ? stream[i] : 40
  return out
}

// Per-word typing-speed pacing from a session's `wpm_trace` — [para, wordOffset, wpm]
// triples recorded by the editor (offsets computed live at typing time, so mid-session
// deletions self-correct). Each inserted char is matched to its (paragraph, word) in
// the end-state text; chars with no sample (or past the trace) play at a default
// 40 WPM. Returns null when the trace clearly doesn't belong to this transition —
// the caller then falls back to ops cadence, then synthetic pacing.
const clampWpm = (w) => Math.max(10, Math.min(300, Math.round(w) || 40))
export function buildWpmCadence(trace, insKeys, insCount) {
  if (!trace || !trace.length || !insCount || !insKeys || insKeys.length !== insCount) return null
  const byKey = new Map()
  for (const t of trace) {
    if (!Array.isArray(t) || t.length < 3) return null
    byKey.set(`${t[0]}:${t[1]}`, clampWpm(t[2])) // later samples (retypes) win
  }
  let matched = 0
  const out = new Array(insCount)
  for (let i = 0; i < insCount; i++) {
    const w = byKey.get(insKeys[i])
    if (w != null) { out[i] = 12000 / w; matched++ }
    else out[i] = 300 // 40 WPM default
  }
  if (matched / insCount < 0.15) return null
  return out
}

// Word index (whitespace-token ordinal) of every char position in a paragraph.
export function wordIndexArray(text) {
  const out = new Array(text.length)
  let w = -1
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) { inWord = false; out[i] = Math.max(0, w) }
    else {
      if (!inWord) { w++; inWord = true }
      out[i] = w
    }
  }
  return out
}

// Final index (in the end-state paragraph) of each ins char, in edit order.
// inlineChange edits can be non-contiguous (swapped words), so positions must be
// simulated, not assumed — cheap at paragraph scale.
export function insCharFinalPositions(before, edits) {
  const live = []
  for (const ch of (before || '')) live.push({ ch })
  const marked = []
  for (const e of edits) {
    if (e.type === 'del') { if (e.pos >= 0 && e.pos < live.length) live.splice(e.pos, 1) }
    else { const o = { slot: marked.length }; marked.push(o); live.splice(e.pos, 0, o) }
  }
  const out = new Array(marked.length).fill(0)
  let idx = 0
  for (const o of live) { if (o.slot !== undefined) out[o.slot] = idx; idx++ }
  return out
}

// Provenance runes: walk the steps up to the current playback position,
// maintaining each paragraph's source mix ({ h, p, m } char counts). add/del
// steps shift paragraph indices exactly like the playback's splices do.
export function deriveSrcTallies(simSteps, currentStepIndex) {
  const map = {}
  if (!simSteps) return map
  const shiftFrom = (from, delta) => {
    const shifted = {}
    for (const k of Object.keys(map)) {
      const n = parseInt(k, 10)
      if (delta < 0 && n === from) continue
      shifted[n >= from ? n + delta : n] = map[k]
    }
    for (const k of Object.keys(map)) delete map[k]
    Object.assign(map, shifted)
  }
  const end = Math.min(currentStepIndex, simSteps.length - 1)
  for (let i = 0; i <= end; i++) {
    const st = simSteps[i]
    if (st.type === 'set') {
      for (const k of Object.keys(map)) delete map[k]
    } else if (st.type === 'edit') {
      if (st.kind === 'del') {
        shiftFrom(st.index, -1)
      } else {
        if (st.kind === 'add') shiftFrom(st.index, 1)
        // mods without op data keep the paragraph's existing story
        if (st._tally || st.kind === 'add') map[st.index] = st._tally || null
      }
    }
  }
  return map
}

export default function PentimentoTab({ projectPath, chapters, projectConfig, activeChapter }) {
  const { t } = useTranslation()
  const [showcase, setShowcase] = useState(false)
  const chapterId = activeChapter?.id || null

  // Multi-device: a project cloned to (or synced with) another machine carries that
  // device's sessions too — filter the heatmap + replay by the recording device.
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [hudDevice, setHudDevice] = useState(null)

  const [paras, setParas] = useState([])
  const [proseParas, setProseParas] = useState([])
  const [summary, setSummary] = useState(null)
  const [hover, setHover] = useState(null)
  const [loading, setLoading] = useState(false)

  const [simMode, setSimMode] = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const [simSteps, setSimSteps] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(3)
  const [simParas, setSimParas] = useState([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentOpCharIndex, setCurrentOpCharIndex] = useState(0)
  const [simWords, setSimWords] = useState(0)
  const [simDeleted, setSimDeleted] = useState(0)
  const [hudSess, setHudSess] = useState('1')
  const [eventText, setEventText] = useState('')
  const [caretPara, setCaretPara] = useState(null)
  const [caretOffset, setCaretOffset] = useState(0)

  const simTimerRef = useRef(null)
  const activeParaRef = useRef(null)

  const rebuildTextUpTo = useCallback((stepsList, targetIdx) => {
    let nextParas = []
    let deletedWords = 0
    let lastSessionLabel = '1'
    let lastSessionDevice = null
    
    for (let i = 0; i < targetIdx; i++) {
      const step = stepsList[i]
      if (step.type === 'session') {
        lastSessionLabel = step.label
        lastSessionDevice = step.deviceId || null
      } else if (step.type === 'set') {
        nextParas = [...step.paras]
      } else if (step.type === 'edit') {
        if (step.kind === 'add') {
          nextParas.splice(step.index, 0, applyEdits('', step.edits))
        } else if (step.kind === 'mod') {
          nextParas[step.index] = applyEdits(nextParas[step.index] || '', step.edits)
          deletedWords += step.deletedWords || 0
        } else if (step.kind === 'del') {
          nextParas.splice(step.index, 1)
          deletedWords += step.deletedWords || 0
        }
      }
    }

    setSimParas(nextParas)
    setSimDeleted(deletedWords)
    setHudSess(String(lastSessionLabel))
    setHudDevice(lastSessionDevice)
    setCaretPara(null)
  }, [])

  const startSimulation = useCallback(async () => {
    if (!projectPath || !chapterId) return
    setSimLoading(true)
    setIsPlaying(false)
    try {
      const [list, content, opsRes] = await Promise.all([
        window.api.chapterHistoryList({ project_path: projectPath, chapter_id: chapterId }),
        window.api.loadChapterContent(projectPath, chapterId),
        window.api.pentimentoOps({
          project_path: projectPath, chapter_id: chapterId,
          device_id: deviceFilter !== 'all' ? deviceFilter : undefined,
        }).catch(() => ({ ops: [] })),
      ])

      const snaps = list?.snapshots || []
      // Device filter: keep snapshots recorded by the chosen device (manual pins,
      // which have no session, always stay visible — they belong to the author).
      const visibleSnaps = deviceFilter === 'all'
        ? snaps
        : snaps.filter(s => !s.device_id || s.device_id === deviceFilter)
      // Group captured writing ops by their session for the pacing overlay.
      const opsBySession = new Map()
      for (const o of (opsRes?.ops || [])) {
        if (!opsBySession.has(o.session_id)) opsBySession.set(o.session_id, [])
        opsBySession.get(o.session_id).push(o)
      }
      // Per-word typing-speed traces, keyed by session (recorder `wpm_trace`).
      const wpmBySession = new Map(Object.entries(opsRes?.wpm_by_session || {}))

      // list is newest-first; replay oldest→newest, then the live chapter as the final frame.
      const sortedSnaps = [...visibleSnaps].reverse()
      const states = []
      for (const s of sortedSnaps) {
        const res = await window.api.chapterHistoryPreview({ project_path: projectPath, snapshot_id: s.id })
        states.push({ html: res?.content_html || '', session_num: s.session_num, session_id: s.session_id })
      }
      states.push({ html: content?.content || '', session_num: null, session_id: null, isLive: true })

      // A session-start baseline snapshot shares its session_id with the end snapshot
      // that follows it — label it as the session's starting state, not a duplicate.
      const labelFor = (snap, ordinal, isStart) => {
        if (snap?.isLive) return t('pentimento.finalState', 'Final state')
        const n = (typeof snap?.session_num === 'number' ? snap.session_num : ordinal)
        return isStart
          ? t('pentimento.sessionStart', 'Session {{n}} — start', { n })
          : t('history.session', 'Session {{n}}', { n })
      }
      const isStartFrame = (snap, next) =>
        !snap?.isLive && next && !next.isLive && snap.session_id && snap.session_id === next.session_id

      // Per-paragraph provenance tallies per session: para -> { h, p, m } inserted
      // chars by source (human keyboard, paste, machine-assisted).
      const srcTallyBySession = new Map()
      for (const [sid2, ops] of opsBySession) {
        const tally = {}
        for (const o of ops) {
          if (o.op_type !== 'insert' && o.op_type !== 'paste') continue
          const n = (o.text_content || '').length || o.length || 0
          if (!n) continue
          const s = o.source === 'paste' ? 'p' : o.source === 'machine' ? 'm' : 'h'
          const para = o.para_index || 0
          if (!tally[para]) tally[para] = { h: 0, p: 0, m: 0 }
          tally[para][s] += n
        }
        if (Object.keys(tally).length) srcTallyBySession.set(sid2, tally)
      }
      const tallyFor = (sessionId, para) => srcTallyBySession.get(sessionId)?.[para] || null

      const steps = []
      if (states.length > 0) {
        const firstParas = cleanProse(states[0].html).split('\n')
        steps.push({ type: 'session', label: labelFor(states[0], 1, isStartFrame(states[0], states[1])), deviceId: visibleSnaps[0]?.device_id || null })
        steps.push({ type: 'set', paras: firstParas })
        let currentParas = [...firstParas]

        for (let i = 1; i < states.length; i++) {
          const snap = states[i]
          steps.push({ type: 'session', label: labelFor(snap, i + 1, isStartFrame(snap, states[i + 1])), deviceId: snap.device_id || null })

          // Snapshot-anchored: diff full paragraph text, patch only what changed.
          const chunks = diffParagraphs(currentParas.join('\n'), cleanProse(snap.html))
          const txSteps = []
          const nextParas = []
          let idx = 0
          for (const ch of chunks) {
            if (ch.type === 'same') { nextParas.push(ch.text); idx++ }
            else if (ch.type === 'mod') {
              const { edits, addedText, removedText } = inlineChange(ch.before, ch.after)
              txSteps.push({ type: 'edit', kind: 'mod', index: idx, edits, deletedWords: countWords(removedText), _added: addedText, _before: ch.before, _tally: tallyFor(snap.session_id, idx) })
              nextParas.push(ch.after); idx++
            }
            else if (ch.type === 'add') {
              const { edits, addedText } = inlineChange('', ch.text)
              txSteps.push({ type: 'edit', kind: 'add', index: idx, edits, deletedWords: 0, _added: addedText, _tally: tallyFor(snap.session_id, idx) })
              nextParas.push(ch.text); idx++
            }
            else if (ch.type === 'del') {
              const { edits } = inlineChange(ch.text, '')
              txSteps.push({ type: 'edit', kind: 'del', index: idx, edits, deletedWords: countWords(ch.text) })
              // paragraph removed — idx stays, nothing pushed
            }
          }

          // Pacing overlay: type this transition's added chars with the session's
          // per-word speeds when available, else its real op cadence, else synthetic.
          const insRefs = []
          const insKeys = []
          let addedAll = ''
          const wordIdCache = new Map()
          for (const st of txSteps) {
            addedAll += (st._added || '')
            if (!st.edits.some(e => e.type === 'ins')) continue
            let wordIds = wordIdCache.get(st.index)
            if (!wordIds) {
              wordIds = wordIndexArray(nextParas[st.index] || '')
              wordIdCache.set(st.index, wordIds)
            }
            const finals = insCharFinalPositions(st._before || '', st.edits)
            let k = 0
            for (const e of st.edits) {
              if (e.type !== 'ins') continue
              insRefs.push(e)
              insKeys.push(`${st.index}:${wordIds[finals[k++]] ?? 0}`)
            }
          }
          const cadence = buildWpmCadence(wpmBySession.get(snap.session_id), insKeys, insRefs.length)
            || buildCadence(opsBySession.get(snap.session_id), insRefs.length, addedAll)
          if (cadence) insRefs.forEach((e, k) => { e.delay = cadence[k] })

          for (const st of txSteps) steps.push(st)
          currentParas = nextParas
        }
      }

      setSimSteps(steps)
      setCurrentStepIndex(0)
      setCurrentOpCharIndex(0)
      setSimDeleted(0)
      setEventText('')
      setCaretPara(null)
      setCaretOffset(0)
      setSimMode(true)

      setTimeout(() => {
        setIsPlaying(true)
      }, 300)
    } catch (err) {
      console.error('Failed to load history simulation:', err)
    } finally {
      setSimLoading(false)
    }
  }, [projectPath, chapterId, t])

  const handleDeviceChange = useCallback((id) => {
    setDeviceFilter(id)
    // a filter change invalidates the running replay — exit to the heatmap view
    setSimMode(false)
    setSimSteps([])
    setSimParas([])
  }, [])

  const exitSimulation = useCallback(() => {
    setIsPlaying(false)
    setSimMode(false)
    setSimSteps([])
    setSimParas([])
  }, [])

  const restartSimulation = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
    setCurrentOpCharIndex(0)
    setSimParas([])
    setSimDeleted(0)
    setHudSess('1')
    setHudDevice(null)
    setEventText('')
    setCaretPara(null)
    setCaretOffset(0)

    setTimeout(() => {
      setIsPlaying(true)
    }, 100)
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  const progressPercent = useMemo(() => {
    if (!simSteps || simSteps.length === 0) return 0
    return (currentStepIndex / simSteps.length) * 100
  }, [currentStepIndex, simSteps])

  // Provenance runes (see deriveSrcTallies).
  const srcTallies = useMemo(
    () => deriveSrcTallies(simSteps, currentStepIndex),
    [simSteps, currentStepIndex])

  const renderSrcRunes = (tally) => {
    if (!tally) return null
    const total = tally.h + tally.p + tally.m
    if (!total) return null
    const defs = [
      { key: 'h', glyph: '\u{10C80}', color: 'var(--accent-amber)', label: t('pentimento.srcHuman', 'Typed') },
      { key: 'p', glyph: '\u{10C82}', color: 'var(--accent-blue)', label: t('pentimento.srcPaste', 'Pasted') },
      { key: 'm', glyph: '\u{10C85}', color: 'var(--accent-purple)', label: t('pentimento.srcMachine', 'Assisted') },
    ].filter(d => tally[d.key] > 0)
    if (!defs.length) return null
    const dom = Math.max(...defs.map(d => tally[d.key]))
    return (
      <span
        style={{
          position: 'absolute', insetInlineEnd: -8, top: '50%',
          transform: 'translateY(-50%)', display: 'inline-flex', gap: 4,
        }}
      >
        {defs.map(d => (
          <span
            key={d.key}
            title={`${d.label} — ${Math.round((tally[d.key] / total) * 100)}%`}
            style={{
              fontFamily: 'var(--font-runes)', fontSize: 13, lineHeight: 1,
              color: d.color, opacity: tally[d.key] === dom ? 0.9 : 0.45,
            }}
          >
            {d.glyph}
          </span>
        ))}
      </span>
    )
  }

  const handleTimelineScrub = useCallback((e) => {
    if (!simSteps || simSteps.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
    const targetIdx = Math.floor((percent / 100) * simSteps.length)
    
    setCurrentStepIndex(targetIdx)
    setCurrentOpCharIndex(0)
    rebuildTextUpTo(simSteps, targetIdx)
  }, [simSteps, rebuildTextUpTo])

  useEffect(() => {
    const text = simParas.join(' ').trim()
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    setSimWords(words)
  }, [simParas])

  // Keep the manuscript scrolled to wherever the edit is happening — the writing
  // jumps around across paragraphs, so follow the caret automatically.
  useEffect(() => {
    if (caretPara != null && activeParaRef.current) {
      activeParaRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [caretPara])

  useEffect(() => {
    if (simTimerRef.current) clearTimeout(simTimerRef.current)
    if (!isPlaying || !simSteps || simSteps.length === 0 || currentStepIndex >= simSteps.length) {
      if (currentStepIndex >= simSteps.length && simSteps.length > 0) {
        setIsPlaying(false)
      }
      return
    }

    const step = simSteps[currentStepIndex]

    if (step.type === 'session') {
      setEventText(step.label)
      setHudSess(step.label)
      setHudDevice(step.deviceId || null)
      setCaretPara(null)
      simTimerRef.current = setTimeout(() => {
        setEventText('')
        setCurrentStepIndex(prev => prev + 1)
        setCurrentOpCharIndex(0)
      }, 1000 / speedMultiplier)
      return
    }

    if (step.type === 'set') {
      setSimParas([...step.paras])
      setCaretPara(null)
      setCurrentStepIndex(prev => prev + 1)
      setCurrentOpCharIndex(0)
      return
    }

    // edit step (add / mod / del) — walk atomic char edits in place
    const edits = step.edits || []
    const k = currentOpCharIndex

    if (k >= edits.length) {
      simTimerRef.current = setTimeout(() => {
        if (step.kind === 'add' && edits.length === 0) {
          setSimParas(prev => { const next = [...prev]; next.splice(step.index, 0, ''); return next })
        } else if (step.kind === 'del') {
          setSimParas(prev => { const next = [...prev]; next.splice(step.index, 1); return next })
        }
        if (step.deletedWords) setSimDeleted(prev => prev + step.deletedWords)
        setCaretPara(null)
        setCurrentStepIndex(prev => prev + 1)
        setCurrentOpCharIndex(0)
      }, 60 / speedMultiplier)
      return
    }

    const e = edits[k]
    const base = e.delay != null ? e.delay : (e.type === 'ins' ? 42 : 22)
    const delay = Math.max(1, base / speedMultiplier)

    simTimerRef.current = setTimeout(() => {
      setSimParas(prev => {
        const next = [...prev]
        let cur
        if (step.kind === 'add' && k === 0) { next.splice(step.index, 0, ''); cur = '' }
        else cur = next[step.index] || ''
        if (e.type === 'ins') next[step.index] = cur.slice(0, e.pos) + e.ch + cur.slice(e.pos)
        else next[step.index] = cur.slice(0, e.pos) + cur.slice(e.pos + 1)
        return next
      })
      setCaretPara(step.index)
      setCaretOffset(e.type === 'ins' ? e.pos + 1 : e.pos)
      setCurrentOpCharIndex(prev => prev + 1)
    }, delay)

    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current)
    }
  }, [isPlaying, currentStepIndex, currentOpCharIndex, simSteps, speedMultiplier])

  useEffect(() => {
    if (!projectPath) return
    window.api.pentimentoSummary({ project_path: projectPath }).then(setSummary).catch(() => setSummary(null))
  }, [projectPath])

  useEffect(() => {
    if (!projectPath || !chapterId) { setParas([]); setProseParas([]); return }
    let cancelled = false
    setLoading(true); setHover(null)
    Promise.all([
      window.api.pentimentoHeatmap({
        project_path: projectPath, chapter_id: chapterId,
        device_id: deviceFilter !== 'all' ? deviceFilter : undefined,
      }),
      window.api.loadChapterContent(projectPath, chapterId),
    ]).then(([hm, content]) => {
      if (cancelled) return
      setParas(hm?.paragraphs || [])
      setProseParas(htmlToParagraphs(content?.content))
    }).catch(() => { if (!cancelled) { setParas([]); setProseParas([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectPath, chapterId, deviceFilter])

  const byIndex = useMemo(() => new Map(paras.map(p => [p.para_index, p])), [paras])
  const hasData = paras.some(p => p.time_ms > 0)
  const hovered = hover != null ? byIndex.get(hover) : null
  const S = summary || {}

  return (
    <div style={{ display: 'flex', gap: 20, padding: 24, height: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Loading Overlay */}
      {simLoading && (
        <div className="settings-modal-overlay" style={{ zIndex: 10001 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 24, textAlign: 'center', width: 260 }}>
            <div style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 12 }}>
              {t('pentimento.compiling', 'COMPILING LOGS…')}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {t('pentimento.simPrep', 'Preparing writing simulation...')}
            </div>
          </div>
        </div>
      )}

      {simMode ? (
        <>
          {/* Left: Simulation paper screen */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text-primary)' }}>
                {activeChapter ? activeChapter.title : ''} ({t('pentimento.replay', 'Replay')})
              </div>
              <DeviceFilterChips summary={summary} deviceFilter={deviceFilter} onChange={handleDeviceChange} />
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <DeviceDot deviceId={deviceFilter !== 'all' ? deviceFilter : hudDevice} />
                {hudSess}
              </span>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: 24,
              fontFamily: 'var(--font-serif)',
              fontSize: 16,
              lineHeight: 1.8,
              color: 'var(--text-primary)',
              position: 'relative',
              whiteSpace: 'pre-wrap',
            }}>
              {eventText && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(138, 111, 208, 0.15)',
                  border: '1px solid rgba(138, 111, 208, 0.4)',
                  color: '#b49ae6',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '6px 12px',
                  borderRadius: 4,
                  zIndex: 5,
                  animation: 'fadeIn 0.2s ease',
                }}>
                  {eventText}
                </div>
              )}

              {simParas.map((paraText, idx) => {
                const caret = (
                  <span style={{
                    display: 'inline-block',
                    width: 2,
                    height: '1.15em',
                    background: 'var(--accent-amber)',
                    verticalAlign: '-2px',
                    margin: '0 1px',
                    animation: isPlaying ? 'none' : 'blink 1s steps(1) infinite',
                  }} />
                )
                const runes = renderSrcRunes(srcTallies[idx])
                if (caretPara === idx) {
                  const off = Math.max(0, Math.min(caretOffset, paraText.length))
                  return (
                    <p key={idx} ref={activeParaRef} style={{ position: 'relative', marginBottom: 12 }}>
                      {paraText.slice(0, off)}{caret}{paraText.slice(off)}
                      {runes}
                    </p>
                  )
                }
                return (
                  <p key={idx} style={{ position: 'relative', marginBottom: 12 }}>
                    {paraText || <span style={{ opacity: 0.3 }}>·</span>}
                    {/* idle caret trails the last paragraph when nothing is being typed */}
                    {caretPara === null && idx === simParas.length - 1 ? caret : null}
                    {runes}
                  </p>
                )
              })}
            </div>
          </div>

          {/* Right: Simulation controls */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 16 }}>
              <SectionLabel>{t('pentimento.simStats', 'Live Stats')}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 12px' }}>
                <Stat label={t('pentimento.wordsWritten', 'words written')} value={simWords} />
                <Stat label={t('pentimento.wordsDeleted', 'words deleted')} value={simDeleted} />
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionLabel>{t('pentimento.simControls', 'Playback Controls')}</SectionLabel>

              <button onClick={togglePlay}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--accent-amber)', color: '#1a1508', border: 'none', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer' }}>
                {isPlaying ? '⏸ ' + t('pentimento.pause', 'Pause') : '▶ ' + t('pentimento.play', 'Play')}
              </button>

              <button onClick={restartSimulation}
                style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer' }}>
                {t('pentimento.restart', 'Restart')}
              </button>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{t('pentimento.speed', 'Speed')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-amber)' }}>{speedMultiplier}x</span>
                </div>
                <input type="range" min="1" max="100" value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseInt(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-amber)' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{t('pentimento.timeline', 'Timeline')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--line-soft, #1b2030)', borderRadius: 3, position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={handleTimelineScrub}>
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: 'var(--accent-amber)', width: `${progressPercent}%`, transition: 'width 0.1s linear' }} />
                </div>
              </div>

              <button onClick={exitSimulation}
                style={{ marginTop: 8, width: '100%', padding: '9px 12px', background: 'rgba(196, 84, 74, 0.15)', border: '1px solid rgba(196, 84, 74, 0.4)', color: '#c4544a', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer' }}>
                {t('pentimento.exitSim', 'Exit Simulation')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Left: painted manuscript */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text-primary)' }}>
                {activeChapter ? (activeChapter.title || t('pentimento.untitled', 'Untitled')) : ''}
              </div>
              <DeviceFilterChips summary={summary} deviceFilter={deviceFilter} onChange={handleDeviceChange} />
              <span style={{ flex: 1 }} />
              {/* continuous legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                <span>{t('pentimento.legend.clean', 'clean')}</span>
                <span style={{ width: 130, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, rgb(63,160,147), rgb(217,151,63), rgb(196,84,74))' }} />
                <span>{t('pentimento.legend.fought', 'fought')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgb(138,111,208)' }} />
                  {t('pentimento.legend.night', 'after midnight')}
                </span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {!activeChapter && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 20 }}>
                  {t('pentimento.pickChapter', 'Select a chapter from the timeline bar to see how it was written.')}
                </div>
              )}
              {activeChapter && loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('pentimento.loading', 'Loading writing history…')}</div>}
              {activeChapter && !loading && !hasData && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 460, marginTop: 20 }}>
                  {t('pentimento.empty', 'No writing history for this chapter yet. Keep writing with process capture on, and the effort behind each paragraph will paint in here.')}
                </div>
              )}
              {activeChapter && !loading && hasData && proseParas.map((text, i) => {
                const p = byIndex.get(i)
                const { rgb, alpha } = p ? heatColor(p) : { rgb: '128,128,128', alpha: 0 }
                const active = hover === i
                return (
                  <div key={i} onMouseEnter={() => setHover(i)}
                    style={{
                      position: 'relative', background: `rgba(${rgb},${active ? Math.min(0.62, alpha + 0.12) : alpha})`,
                      padding: '8px 12px', marginBottom: 6,
                      transition: 'background .14s ease, transform .14s ease', transform: active ? 'translateX(2px)' : 'none',
                    }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                      {text.trim() || <span style={{ opacity: 0.3 }}>·</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: inspector + totals */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderLeft: '2px solid var(--accent-amber)', borderRadius: 4, padding: 16, minHeight: 150 }}>
              <SectionLabel>{t('pentimento.inspector', 'Paragraph Inspector')}</SectionLabel>
              {hovered ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                  <Stat label={t('pentimento.timeHere', 'time here')} value={fmtDuration(hovered.time_ms)} />
                  <Stat label={t('pentimento.reworked', 'reworked')} value={`${Math.round(hovered.churn * 100)}%`} />
                  <Stat label={t('pentimento.revisions', 'revisions')} value={hovered.revisions} />
                  <Stat label={t('pentimento.night', 'after midnight')} value={`${Math.round(hovered.night_ratio * 100)}%`} />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {t('pentimento.hoverHint', 'Hover a paragraph to read its biography.')}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 16 }}>
              <SectionLabel>{t('pentimento.projectTotals', 'Project Totals')}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 12px' }}>
                <Stat label={t('pentimento.wordsKept', 'words kept')} value={(S.kept_words || 0).toLocaleString()} big />
                <Stat label={t('pentimento.wordsDeleted', 'words deleted')} value={(S.deleted_words || 0).toLocaleString()} big />
                <Stat label={t('pentimento.timeSpent', 'time writing')} value={fmtDuration(S.total_time_ms)} big />
                <Stat label={t('pentimento.sessions', 'sessions')} value={S.sessions || 0} big />
              </div>
              {S.chain_head_hash && (
                <div style={{ marginTop: 12, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
                  {t('pentimento.receipt', 'receipt')}: {S.chain_head_hash.slice(0, 12)}…
                </div>
              )}
              {Object.keys(S.devices || {}).length > 1 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <SectionLabel>{t('pentimento.byDevice', 'By device')}</SectionLabel>
                  {Object.entries(S.devices).sort((a, b) => (b[1].time_ms || 0) - (a[1].time_ms || 0)).map(([id, d]) => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: deviceColor(id), flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deviceLabel(id, S.current_device, t)}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{d.sessions} · {fmtDuration(d.time_ms)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowcase(true)} disabled={!summary || !S.sessions}
                style={{ marginTop: 14, width: '100%', padding: '9px 12px', background: 'var(--accent-amber)', color: '#1a1508', border: 'none', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: (summary && S.sessions) ? 'pointer' : 'not-allowed', opacity: (summary && S.sessions) ? 1 : 0.5 }}>
                {t('pentimento.saveShowcase', 'Save Showcase Image')}
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 16 }}>
              <SectionLabel>{t('pentimento.simulation', 'Simulation')}</SectionLabel>
              <button onClick={startSimulation} disabled={!activeChapter || loading}
                style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', cursor: (activeChapter && !loading) ? 'pointer' : 'not-allowed', opacity: (activeChapter && !loading) ? 1 : 0.5 }}>
                {t('pentimento.simulate', 'Replay Writing')}
              </button>
            </div>
          </div>
        </>
      )}

      {showcase && (
        <ShowcaseModal onClose={() => setShowcase(false)}
          projectName={projectConfig?.project_name || 'FleshNote'}
          chapterTitle={activeChapter?.title || ''} paras={paras} summary={S} />
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>{children}</div>
}

function DeviceDot({ deviceId }) {
  if (!deviceId) return null
  return <span style={{ width: 8, height: 8, borderRadius: 2, background: deviceColor(deviceId), display: 'inline-block', flexShrink: 0 }} />
}

// Filter chips: All devices / This device / Device xxxx… (only when the project
// actually contains writing from more than one device).
function DeviceFilterChips({ summary, deviceFilter, onChange }) {
  const { t } = useTranslation()
  const devices = summary?.devices || {}
  const ids = Object.keys(devices).sort((a, b) => (devices[b].time_ms || 0) - (devices[a].time_ms || 0))
  if (ids.length < 2) return null
  const chips = ['all', ...ids]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {chips.map(id => {
        const active = deviceFilter === id
        const label = id === 'all'
          ? t('pentimento.allDevices', 'All devices')
          : deviceLabel(id, summary?.current_device, t)
        return (
          <button key={id} onClick={() => onChange(id)} title={id === 'all' ? null : id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              background: active ? 'var(--accent-amber)' : 'var(--bg-surface)',
              border: `1px solid ${active ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
              color: active ? '#1a1508' : 'var(--text-secondary)',
              borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            }}>
            {id !== 'all' && <span style={{ width: 8, height: 8, borderRadius: 2, background: deviceColor(id) }} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
function Stat({ label, value, big }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: big ? 18 : 14, color: 'var(--accent-amber)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

function ShowcaseModal({ onClose, projectName, chapterTitle, paras, summary }) {
  const { t } = useTranslation()
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleSave = useCallback(async () => {
    if (!cardRef.current) return
    setSaving(true); setMsg(null)
    const r = cardRef.current.getBoundingClientRect()
    try {
      const res = await window.api.captureShowcase({
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        defaultName: `${(projectName || 'fleshnote').replace(/[^\w-]+/g, '_')}_process.png`,
      })
      setMsg(res?.saved ? t('pentimento.saved', 'Saved ✓') : t('pentimento.saveCancelled', 'Not saved'))
    } catch { setMsg(t('pentimento.saveFailed', 'Could not save image')) }
    finally { setSaving(false) }
  }, [projectName, t])

  const maxHeat = Math.max(...paras.map(p => p.heat || 0), 0.001)

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div ref={cardRef} style={{ width: 900, height: 506, background: 'linear-gradient(160deg,#12151d,#0d1016)', position: 'relative', padding: 44, boxSizing: 'border-box', color: '#e7e1d4', overflow: 'hidden', fontFamily: 'var(--font-serif)', border: '1px solid #232838' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.24em', color: '#d9973f' }}>◈ FLESHNOTE · PENTIMENTO</div>
              <div style={{ fontSize: 34, fontWeight: 600, marginTop: 10, color: '#fff' }}>{projectName}</div>
              {chapterTitle && <div style={{ fontSize: 15, color: '#8b92a3', marginTop: 2 }}>{chapterTitle}</div>}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#565e70' }}>
              {fmtDate(summary.first_session)} → {fmtDate(summary.last_session)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, marginTop: 34 }}>
            {paras.map((p, i) => {
              const { rgb } = heatColor(p)
              return <div key={i} style={{ flex: 1, minWidth: 2, height: `${20 + (p.heat / maxHeat) * 100}%`, background: `rgb(${rgb})`, opacity: 0.5 + clamp01(p.heat) * 0.5 }} />
            })}
          </div>
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            <CardStat n={(summary.kept_words || 0).toLocaleString()} l={t('pentimento.wordsKept', 'words kept')} />
            <CardStat n={(summary.deleted_words || 0).toLocaleString()} l={t('pentimento.wordsDeleted', 'words deleted')} />
            <CardStat n={fmtDuration(summary.total_time_ms)} l={t('pentimento.timeSpent', 'time writing')} />
            <CardStat n={summary.sessions || 0} l={t('pentimento.sessions', 'sessions')} />
          </div>
          {summary.chain_head_hash && (
            <div style={{ position: 'absolute', bottom: 20, right: 44, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#3fa093' }}>
              sealed · {summary.chain_head_hash.slice(0, 16)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
          <button className="import-btn secondary" onClick={onClose}>{t('pentimento.close', 'Close')}</button>
          <button className="import-btn" onClick={handleSave} disabled={saving}>
            {saving ? t('pentimento.saving', 'Saving…') : t('pentimento.savePng', 'Save PNG')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CardStat({ n, l }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: '#d9973f' }}>{n}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8b92a3', marginTop: 4 }}>{l}</div>
    </div>
  )
}
