import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { paragraphKey, gutterBlocks, combineSegments } from '../utils/pulseGutter'
import { NEUTRAL_BAND, columnColor } from '../utils/pulseColors'

/*
 * Story Pulse gutter.
 *
 * Sits on the inline-end side of the text column (the left in Arabic) and
 * shows each paragraph's intensity as a gently moving line, colored by its
 * emotion like the planner's columns. It never touches the document and never
 * makes the backend parse: scores come from the paragraph cache the Janitor
 * fills (cache_only), refetched after a Janitor run. Paragraphs are matched by
 * content key, so the one being typed simply goes quiet until it's scored
 * again — no stale colors.
 *
 * Corrections: press and hold a bar and a small pad opens under the cursor
 * with the current value's dot right there; drag (up/down intensity,
 * left/right mood) and release to save. Near the screen edge the drag speeds
 * up in that direction so the edge never stops it. A plain click leaves the
 * pad open (click or drag inside it, "Reset to measured"). Every press keeps
 * the writer's caret: nothing here takes focus from the editor.
 */

const WINDOW_MARGIN = 600 // px above and below the viewport that still get bars
const WINDOW_STEP = 300
const BAR_W = 12
const PAD_W = 156 // plot area of the correction pad
const PAD_H = 132
const PAD_INSET = 12 // pad padding: the plot's offset inside the pad
const PAD_TOTAL_W = PAD_W + 2 * PAD_INSET
const PAD_TOTAL_H = 232
const CLICK_SLOP = 3 // px of movement below which a press counts as a click
// the drag glides on while the cursor is pinned at a window edge
const EDGE_ZONE = 3
const EDGE_STALL_MS = 100
const EDGE_SPEED = PAD_W / 1.3 // px per second: the full mood range in 1.3 s

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function usePulseScores(projectPath, language, chapterId, refreshKey) {
  // { map: key -> paragraph, coverage, stale: [corrections without a paragraph], seq }
  const [state, setState] = useState(null)
  const [nudge, setNudge] = useState(0)
  const seq = useRef(0)
  useEffect(() => {
    if (!projectPath || chapterId == null) return
    const mine = ++seq.current
    window.api.storyPulse({ project_path: projectPath, language, cache_only: true })
      .then((res) => {
        if (mine !== seq.current || res?.status !== 'ok') return
        const ch = (res.chapters || []).find((c) => String(c.chapter_id) === String(chapterId))
        const map = new Map()
        for (const p of ch?.paragraphs || []) if (p.key && p.intensity !== undefined) map.set(p.key, p)
        setState({ map, coverage: res.coverage || null, stale: ch?.stale_corrections || [], seq: mine })
      })
      .catch(() => { /* the gutter stays quiet; writing must never notice */ })
  }, [projectPath, language, chapterId, refreshKey, nudge])
  useEffect(() => { setState(null) }, [chapterId])
  // Ask again now (after a correction); returns the seq that answer will carry
  const refetch = useCallback(() => { setNudge((n) => n + 1); return seq.current + 1 }, [])
  return [state, refetch]
}

// A vertical wave from y = -wl to h + wl (room to slide one period up).
function wavePath(h, amp, wl, cx) {
  let d = `M ${cx} ${-wl}`
  for (let y = -wl, s = 1; y < h + wl; y += wl / 2, s = -s) d += ` q ${(s * 2 * amp).toFixed(2)} ${wl / 4} 0 ${wl / 2}`
  return d
}

function PulseBar({ top, height, value, onEnter, onLeave, onPointerDown }) {
  const h = Math.max(8, height)
  if (!value) {
    return (
      <div className="pulse-gutter-bar pending" style={{ top, height: h }}
        onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={onPointerDown}>
        <span className="pulse-gutter-rest" />
      </div>
    )
  }
  const x = clamp(value.intensity, 0, 1)
  const amp = 0.6 + 3.4 * x
  const wl = Math.round(18 - 8 * x) // px per period: a one-line paragraph still shows a full wave
  const color = columnColor(value.valence, value.emotions)
  return (
    <div className={`pulse-gutter-bar${value.corrected ? ' corrected' : ''}`} style={{ top, height: h }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onPointerDown={onPointerDown}>
      <svg width={BAR_W} height={h} aria-hidden="true">
        <rect width={BAR_W} height={h} rx={3} fill={color} opacity={0.07} />
        <path
          className="pulse-gutter-wave"
          d={wavePath(h, amp, wl, BAR_W / 2)}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinecap="round"
          opacity={0.45 + 0.5 * x}
          style={{ '--wl': `${wl}px`, '--dur': `${(7 - 4.5 * x).toFixed(1)}s` }}
        />
      </svg>
    </div>
  )
}

function useMoodLabel() {
  const { t } = useTranslation()
  return (v) => (v >= NEUTRAL_BAND ? t('storyPulse.moodPositive', 'brighter')
    : v <= -NEUTRAL_BAND ? t('storyPulse.moodNegative', 'darker') : t('storyPulse.moodNeutral', 'neutral'))
}

function GutterTooltip({ tip }) {
  const { t } = useTranslation()
  const moodLabel = useMoodLabel()
  const v = tip.value
  const hint = <div className="pulse-tip-hint">{t('storyPulse.gutterDragHint', 'Press and drag to correct · click for options')}</div>
  if (!v) {
    return (
      <div className="pulse-tooltip pulse-gutter-tip" style={{ top: tip.top }}>
        <div className="pulse-tip-row">{t('storyPulse.notAnalyzed', 'Not analyzed yet')}</div>
        <div className="pulse-tip-row pulse-tip-dim">{t('storyPulse.gutterPendingHint', 'Scored a few seconds after you stop typing.')}</div>
        {hint}
      </div>
    )
  }
  const emotions = Object.entries(v.emotions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k]) => t(`storyPulse.emotion.${k}`, k)).join(', ')
  const words = [...new Set((v.evidence || []).map(([, w]) => w))].slice(0, 6)
  const measured = v.measured?.intensity
  return (
    <div className="pulse-tooltip pulse-gutter-tip" style={{ top: tip.top }}>
      <div className="pulse-tip-row">{t('storyPulse.intensity', 'Intensity')}: {Math.round(v.intensity * 100)}%</div>
      <div className="pulse-tip-row">{t('storyPulse.mood', 'Mood')}: {moodLabel(v.valence)}{emotions ? ` · ${emotions}` : ''}</div>
      {v.corrected ? (
        <div className="pulse-tip-row pulse-tip-dim">
          {t('storyPulse.correctedByYou', 'Corrected by you')}
          {measured != null ? ` · ${t('storyPulse.measuredValue', 'measured {{value}}%', { value: Math.round(measured * 100) })}` : ''}
        </div>
      ) : (
        <div className="pulse-tip-row pulse-tip-dim">
          {t('storyPulse.evidence', 'Words behind it')}: {words.length ? words.join(', ') : t('storyPulse.noEvidence', 'none (length and dialogue only)')}
        </div>
      )}
      <div className="pulse-tip-hint">
        {/* intensity is normalized over the scored paragraphs only (cache_only):
            say so while part of the book hasn't been analyzed */}
        {tip.coverage && tip.coverage.scored < tip.coverage.total
          ? t('storyPulse.gutterPartial', 'Relative to the analyzed part of your book ({{scored}} of {{total}} paragraphs)', tip.coverage)
          : t('storyPulse.relative', 'Relative to the rest of your book')}
      </div>
      {hint}
    </div>
  )
}

// Where a value sits in the pad's plot: intensity up (like every other Story
// Pulse chart), mood across, brighter toward the inline end.
function dotPos(v, rtl) {
  const f = (clamp(v.valence, -1, 1) + 1) / 2
  return { x: (rtl ? 1 - f : f) * PAD_W, y: (1 - clamp(v.intensity, 0, 1)) * PAD_H }
}

// The pad explains its own axes: hue runs cold blue (darker) → neutral → warm
// gold (brighter); intensity is saturation (washed out at the bottom) and line
// density (lines crowd together toward the top).
const MOOD_COLD = [79, 127, 208]
const MOOD_NEUTRAL = [138, 135, 127]
const MOOD_WARM = [217, 164, 65]
const PAD_WASH = [69, 69, 75]
const PAD_WASH_MAX = 0.8 // how washed out "calm" gets
const DENSITY_LINES = Array.from({ length: 13 }, (_, k) => 1 - Math.sqrt((k + 1) / 14)) // y fractions, denser near the top

const mix = (a, b, f) => a.map((c, i) => c + (b[i] - c) * f)
function padColor(v) {
  const f = (clamp(v.valence, -1, 1) + 1) / 2
  const hue = f < 0.5 ? mix(MOOD_COLD, MOOD_NEUTRAL, f * 2) : mix(MOOD_NEUTRAL, MOOD_WARM, (f - 0.5) * 2)
  const [r, g, b] = mix(hue, PAD_WASH, PAD_WASH_MAX * (1 - clamp(v.intensity, 0, 1)))
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function PadField({ rtl }) {
  const rgb = (c) => `rgb(${c.join(', ')})`
  return (
    <svg className="pulse-pad-field" width={PAD_W} height={PAD_H} aria-hidden="true">
      <defs>
        <linearGradient id="pulse-pad-hue" x1={rtl ? 1 : 0} x2={rtl ? 0 : 1} y1="0" y2="0">
          <stop offset="0" stopColor={rgb(MOOD_COLD)} />
          <stop offset="0.5" stopColor={rgb(MOOD_NEUTRAL)} />
          <stop offset="1" stopColor={rgb(MOOD_WARM)} />
        </linearGradient>
        <linearGradient id="pulse-pad-wash" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={rgb(PAD_WASH)} stopOpacity="0" />
          <stop offset="1" stopColor={rgb(PAD_WASH)} stopOpacity={PAD_WASH_MAX} />
        </linearGradient>
      </defs>
      <rect width={PAD_W} height={PAD_H} fill="url(#pulse-pad-hue)" opacity="0.85" />
      <rect width={PAD_W} height={PAD_H} fill="url(#pulse-pad-wash)" />
      {DENSITY_LINES.map((f) => (
        <line key={f} x1="0" x2={PAD_W} y1={f * PAD_H} y2={f * PAD_H} stroke="rgba(255, 255, 255, 0.13)" strokeWidth="1" />
      ))}
      <line x1={PAD_W / 2} x2={PAD_W / 2} y1="0" y2={PAD_H} stroke="rgba(255, 255, 255, 0.18)" strokeDasharray="2 3" />
    </svg>
  )
}

function CorrectionPad({ pad, padElRef, onPlotSet, onPlotCommit, onReset }) {
  const { t } = useTranslation()
  const moodLabel = useMoodLabel()
  const plotRef = useRef(null)
  const d = pad.draft
  const dot = dotPos(d, pad.rtl)
  const ring = pad.measured ? dotPos(pad.measured, pad.rtl) : null
  const color = padColor(d)

  // Sticky pad: click or drag inside the plot sets the value directly
  const fromEvent = (e) => {
    const r = plotRef.current.getBoundingClientRect()
    const fx = clamp((e.clientX - r.left) / PAD_W, 0, 1)
    return { intensity: clamp(1 - (e.clientY - r.top) / PAD_H, 0, 1), valence: 2 * (pad.rtl ? 1 - fx : fx) - 1 }
  }
  const onPlotDown = (e) => {
    if (!pad.sticky || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    onPlotSet(fromEvent(e))
  }
  const onPlotMove = (e) => {
    if (pad.sticky && e.currentTarget.hasPointerCapture?.(e.pointerId)) onPlotSet(fromEvent(e))
  }
  const onPlotUp = (e) => {
    if (pad.sticky && e.currentTarget.hasPointerCapture?.(e.pointerId)) onPlotCommit(fromEvent(e))
  }

  return createPortal(
    <div
      ref={padElRef}
      className={`pulse-pad${pad.sticky ? ' sticky' : ''}`}
      style={{ left: pad.left, top: pad.top, width: PAD_TOTAL_W }}
      // keep the writer's caret: nothing in the pad takes focus
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        ref={plotRef}
        className="pulse-pad-plot"
        style={{ width: PAD_W, height: PAD_H }}
        onPointerDown={onPlotDown}
        onPointerMove={onPlotMove}
        onPointerUp={onPlotUp}
      >
        <PadField rtl={pad.rtl} />
        <span className="pulse-pad-label top">{t('storyPulse.padIntense', 'intense')}</span>
        <span className="pulse-pad-label bottom">{t('storyPulse.padCalm', 'calm')}</span>
        {ring && <span className="pulse-pad-ring" style={{ left: ring.x, top: ring.y }} title={t('storyPulse.measured', 'measured')} />}
        <span className="pulse-pad-dot" style={{ left: dot.x, top: dot.y, background: color }} />
      </div>
      <div className="pulse-pad-xaxis">
        <span className="cold">{t('storyPulse.moodNegative', 'darker')}</span>
        <span className="warm">{t('storyPulse.moodPositive', 'brighter')}</span>
      </div>
      <div className="pulse-pad-readout">
        {t('storyPulse.intensity', 'Intensity')} {Math.round(d.intensity * 100)}% · {moodLabel(d.valence)}
      </div>
      {pad.sticky ? (
        <div className="pulse-pad-actions">
          {pad.corrected && (
            <button type="button" className="pulse-text-btn" onClick={onReset}>
              {t('storyPulse.resetMeasured', 'Reset to measured')}
            </button>
          )}
          <span className="pulse-pad-hint">{t('storyPulse.padStickyHint', 'Click or drag in the square')}</span>
        </div>
      ) : (
        <div className="pulse-pad-hint">{t('storyPulse.padHint', 'Release to save · Esc cancels')}</div>
      )}
    </div>,
    document.body,
  )
}

export default function PulseGutter({ editor, projectPath, language, chapterId, editorColumnRef, measureTick, refreshKey }) {
  const { t } = useTranslation()
  const [pulse, refetch] = usePulseScores(projectPath, language, chapterId, refreshKey)
  const scores = pulse?.map || null
  const coverage = pulse?.coverage || null
  const stale = pulse?.stale || []
  // key -> { value, seq }: a just-saved correction shows at once and stays until
  // an answer requested after the save (seq) carries it from the server
  const [overrides, setOverrides] = useState(() => new Map())
  const [layout, setLayout] = useState([]) // [{ top, bottom, keys, texts, idx }]
  const [win, setWin] = useState({ from: 0, to: 2400 })
  const [tip, setTip] = useState(null)
  const [pad, setPad] = useState(null)
  const [staleOpen, setStaleOpen] = useState(false)
  const gutterRef = useRef(null)
  const padElRef = useRef(null)
  const padRef = useRef(null) // mirror of `pad` for the window listeners
  const drag = useRef(null)
  const keyMemo = useRef(new Map()) // segment text -> key: only new or edited text gets hashed
  const measureSeq = useRef(0)

  const valueOf = (k) => {
    const o = overrides.get(k)
    if (o && !(pulse && pulse.seq >= o.seq)) return o.value
    return scores?.get(k) ?? null
  }
  const valueOfRef = useRef(valueOf)
  valueOfRef.current = valueOf

  useEffect(() => { setOverrides(new Map()); setPad(null); padRef.current = null; setStaleOpen(false) }, [chapterId])

  const measure = useCallback(async () => {
    if (!editor || editor.isDestroyed || !editorColumnRef?.current) return
    const mine = ++measureSeq.current
    const blocks = gutterBlocks(editor.state.doc)
    const memo = keyMemo.current
    if (memo.size > 5000) memo.clear()
    const keys = await Promise.all(blocks.map((b) => Promise.all(b.segments.map(async (s) => {
      let k = memo.get(s)
      if (!k) { k = await paragraphKey(s); memo.set(s, k) }
      return k
    }))))
    if (mine !== measureSeq.current || editor.isDestroyed || !editorColumnRef.current) return
    const colTop = editorColumnRef.current.getBoundingClientRect().top
    const next = []
    blocks.forEach((b, i) => {
      let el = null
      try { el = editor.view.nodeDOM(b.pos) } catch { /* position moved under us; next measure fixes it */ }
      if (!el?.getBoundingClientRect) return
      const r = el.getBoundingClientRect()
      next.push({ top: r.top - colTop, bottom: r.bottom - colTop, keys: keys[i], texts: b.segments, idx: i })
    })
    setLayout(next)
  }, [editor, editorColumnRef])

  useEffect(() => {
    measure()
    const t1 = setTimeout(measure, 80)
    const t2 = setTimeout(measure, 600) // web fonts settling after a chapter load
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [measure, measureTick, chapterId])

  // Layout changes that aren't edits (window or side-panel resize, zoom)
  useEffect(() => {
    const col = editorColumnRef?.current
    if (!col || typeof ResizeObserver === 'undefined') return
    let timer = null
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(measure, 150) })
    ro.observe(col)
    return () => { ro.disconnect(); clearTimeout(timer) }
  }, [measure, editorColumnRef])

  // Only bars near the viewport are drawn (and animated)
  useEffect(() => {
    const sc = gutterRef.current?.closest('.editor-content-wrapper')
    if (!sc) return
    let raf = 0
    const update = () => {
      raf = 0
      const from = Math.floor((sc.scrollTop - WINDOW_MARGIN) / WINDOW_STEP) * WINDOW_STEP
      const to = Math.ceil((sc.scrollTop + sc.clientHeight + WINDOW_MARGIN) / WINDOW_STEP) * WINDOW_STEP
      setWin((w) => (w.from === from && w.to === to ? w : { from, to }))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    sc.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      sc.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // ── Corrections ────────────────────────────────────────────────────────
  const setPadState = useCallback((fn) => {
    setPad((p) => {
      const n = typeof fn === 'function' ? fn(p) : fn
      padRef.current = n
      return n
    })
  }, [])

  const closePad = useCallback(() => {
    const d = drag.current
    if (d) { d.cleanup(); drag.current = null }
    setPadState(null)
  }, [setPadState])

  const save = useCallback(async (p, value, reset = false) => {
    const keys = p.block.keys
    const ids = keys.map((k) => valueOfRef.current(k)?.correction_id ?? null)
    const base = p.base
    const shown = reset
      ? (p.measured && base ? { ...base, ...p.measured, corrected: false, measured: undefined, correction_id: undefined } : null)
      : { ...(base || {}), intensity: value.intensity, valence: value.valence, corrected: true, measured: p.measured, emotions: p.emotions }
    setOverrides((m) => { const n = new Map(m); keys.forEach((k) => n.set(k, { value: shown, seq: Infinity })); return n })
    let res = null
    try {
      res = await window.api.storyPulseCorrect({
        project_path: projectPath, chapter_id: chapterId, texts: p.block.texts, correction_ids: ids,
        para_idx: p.block.idx, ...(reset ? { reset: true } : { intensity: value.intensity, valence: value.valence }),
      })
    } catch { /* fall through to the revert */ }
    if (res?.status !== 'ok') {
      setOverrides((m) => { const n = new Map(m); keys.forEach((k) => n.delete(k)); return n })
      return
    }
    const newIds = new Map((res.corrections || []).map((c) => [c.key, c.id]))
    const s = refetch()
    setOverrides((m) => {
      const n = new Map(m)
      keys.forEach((k) => {
        const o = n.get(k)
        if (o) n.set(k, { value: o.value && !reset ? { ...o.value, correction_id: newIds.get(k) ?? o.value.correction_id } : o.value, seq: s })
      })
      return n
    })
  }, [projectPath, chapterId, refetch])

  const onBarPointerDown = (block, value) => (e) => {
    if (e.button !== 0) return
    // keep the writer's caret and selection where they are
    e.preventDefault()
    e.stopPropagation()
    setTip(null)
    setStaleOpen(false)
    if (drag.current) closePad()
    const rtl = getComputedStyle(gutterRef.current).direction === 'rtl'
    const start = value ? { intensity: value.intensity, valence: value.valence } : { intensity: 0.5, valence: 0 }
    const measured = value
      ? (value.corrected ? (value.measured?.intensity != null ? value.measured : null) : { intensity: value.intensity, valence: value.valence })
      : null
    // the pad opens with the current value's dot under the cursor, shifted only to stay on screen
    const dot = dotPos(start, rtl)
    const left = clamp(e.clientX - PAD_INSET - dot.x, 8, window.innerWidth - PAD_TOTAL_W - 8)
    const top = clamp(e.clientY - PAD_INSET - dot.y, 8, window.innerHeight - PAD_TOTAL_H - 8)
    setPadState({
      block, base: value, start, draft: start, measured, emotions: value?.emotions,
      corrected: !!value?.corrected, left, top, rtl, sticky: false,
    })

    // The dot follows the mouse 1:1. No pointer lock: Chromium drops the held
    // button when a lock starts mid-press, so the release never arrives. The
    // gutter hugs the window edge, so when the cursor is pinned there the dot
    // keeps gliding that way (like drag auto-scroll) until it's moved back.
    const d = { moved: 0, lastX: e.clientX, lastY: e.clientY, movedXAt: 0, movedYAt: 0, done: false, raf: 0, t: 0 }
    const move = (dx, dy) => setPadState((p) => {
      if (!p) return p
      const intensity = clamp(p.draft.intensity - dy / PAD_H, 0, 1)
      const valence = clamp(p.draft.valence + (2 * (p.rtl ? -dx : dx)) / PAD_W, -1, 1)
      if (intensity === p.draft.intensity && valence === p.draft.valence) return p
      return { ...p, draft: { intensity, valence } }
    })
    const edge = (v, max) => (v >= max - EDGE_ZONE ? 1 : v < EDGE_ZONE ? -1 : 0)
    const tick = (t) => {
      d.raf = requestAnimationFrame(tick)
      const dt = Math.min((t - (d.t || t)) / 1000, 0.05)
      d.t = t
      if (d.moved <= CLICK_SLOP) return
      const now = performance.now()
      const ex = now - d.movedXAt > EDGE_STALL_MS ? edge(d.lastX, window.innerWidth) : 0
      const ey = now - d.movedYAt > EDGE_STALL_MS ? edge(d.lastY, window.innerHeight) : 0
      if (ex || ey) move(ex * EDGE_SPEED * dt, ey * EDGE_SPEED * dt)
    }
    d.raf = requestAnimationFrame(tick)
    const onMove = (ev) => {
      // a move with no button held: the release happened where we couldn't
      // hear it (outside the window, say), so end the drag now
      if (ev.buttons === 0) { onUp(); return }
      const dx = ev.clientX - d.lastX
      const dy = ev.clientY - d.lastY
      d.lastX = ev.clientX
      d.lastY = ev.clientY
      const now = performance.now()
      if (dx) d.movedXAt = now
      if (dy) d.movedYAt = now
      d.moved += Math.abs(dx) + Math.abs(dy)
      if (dx || dy) move(dx, dy)
    }
    const onUp = () => {
      if (d.done) return
      d.done = true
      d.cleanup()
      drag.current = null
      const p = padRef.current
      if (!p) return
      if (d.moved > CLICK_SLOP) {
        save(p, p.draft)
        setPadState(null)
      } else {
        setPadState({ ...p, sticky: true }) // a click: leave the pad open
      }
    }
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopPropagation()
      d.done = true
      closePad()
    }
    d.cleanup = () => {
      cancelAnimationFrame(d.raf)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('keydown', onKey, true)
    }
    // capture phase, so nothing below can swallow the move or the release;
    // pointerup and mouseup both end the drag, whichever arrives first
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('mouseup', onUp, true)
    window.addEventListener('keydown', onKey, true)
    drag.current = d
  }

  // Sticky pad: Esc or a press outside closes it (without stealing that press)
  useEffect(() => {
    if (!pad?.sticky) return
    const onDown = (e) => { if (padElRef.current && !padElRef.current.contains(e.target)) closePad() }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closePad()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [pad?.sticky, closePad])

  useEffect(() => () => { drag.current?.cleanup() }, [])

  const discardStale = async (id) => {
    try {
      await window.api.storyPulseCorrect({ project_path: projectPath, chapter_id: chapterId, texts: [], correction_ids: [id], reset: true })
    } catch { /* stays listed */ }
    refetch()
  }

  const seen = new Map() // per render: occurrences of each bar's content key
  return (
    <div
      ref={gutterRef}
      className="pulse-gutter"
      // for QA: scored paragraphs vs. editor blocks that found their score
      data-scored={scores ? scores.size : -1}
      data-blocks={layout.length}
      data-matched={scores ? layout.filter((b) => b.keys.some((k) => scores.has(k))).length : 0}
      data-stale={stale.length}
    >
      {stale.length > 0 && (
        <button
          type="button"
          className="pulse-gutter-stale"
          title={t('storyPulse.staleTitle', '{{count}} correction(s) lost their paragraph after edits', { count: stale.length })}
          aria-label={t('storyPulse.staleTitle', '{{count}} correction(s) lost their paragraph after edits', { count: stale.length })}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => setStaleOpen((o) => !o)}
        >
          {stale.length}
        </button>
      )}
      {staleOpen && stale.length > 0 && (
        <div className="pulse-tooltip pulse-gutter-tip pulse-gutter-stale-list" onPointerDown={(e) => e.preventDefault()}>
          <div className="pulse-tip-head">{t('storyPulse.staleTitle', '{{count}} correction(s) lost their paragraph after edits', { count: stale.length })}</div>
          {stale.map((s) => (
            <div key={s.id} className="pulse-stale-item">
              <div className="pulse-tip-excerpt">{s.excerpt}{s.excerpt && s.excerpt.length >= 140 ? '…' : ''}</div>
              <button type="button" className="pulse-text-btn" onClick={() => discardStale(s.id)}>
                {t('storyPulse.discard', 'Discard')}
              </button>
            </div>
          ))}
        </div>
      )}
      {layout.map((b) => {
        // keyed by content (plus occurrence for repeated text), never by
        // position: Enter above a bar must not remount it and restart its wave
        const id = b.keys.join('|')
        const nth = (seen.get(id) || 0) + 1
        seen.set(id, nth)
        if (b.bottom < win.from || b.top > win.to) return null
        const value = combineSegments(b.keys.map(valueOf))
        const top = b.top + 3
        return [
          value?.corrected && <span key={`pin:${id}#${nth}`} className="pulse-gutter-pin" style={{ top: top - 1 }} />,
          <PulseBar
            key={`${id}#${nth}`}
            top={top}
            height={b.bottom - b.top - 6}
            value={value}
            onEnter={() => { if (!padRef.current) setTip({ top, value, coverage }) }}
            onLeave={() => setTip(null)}
            onPointerDown={onBarPointerDown(b, value)}
          />,
        ]
      })}
      {tip && !pad && <GutterTooltip tip={tip} />}
      {pad && (
        <CorrectionPad
          pad={pad}
          padElRef={padElRef}
          onPlotSet={(v) => setPadState((p) => p && { ...p, draft: v })}
          onPlotCommit={(v) => {
            const p = padRef.current
            if (!p) return
            save(p, v)
            setPadState({ ...p, draft: v, corrected: true, base: { ...(p.base || {}), ...v, corrected: true } })
          }}
          onReset={() => {
            const p = padRef.current
            if (p) save(p, null, true)
            closePad()
          }}
        />
      )}
    </div>
  )
}
