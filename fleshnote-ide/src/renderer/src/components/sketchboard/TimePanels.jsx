import { useRef, useState } from 'react'
import CalendarDatePicker from '../CalendarDatePicker'
import { Icon } from './icons'
import { IconButton, Section } from './controls'

/*
 * Time on a board: the scrubber that picks a point along the story, and the
 * inspector's Timeline section that says when a node or connection appears
 * and ends.
 */

const SNAP_PX = 8

const chapterName = (t, s) =>
  s.title
    ? t('sketchboard.chapterTitled', 'Ch. {{n}} · {{title}}', { n: s.number, title: s.title })
    : t('sketchboard.chapterNumber', 'Ch. {{n}}', { n: s.number })

// ── Scrubber ──────────────────────────────────────────────────

/**
 * A bar along the top of the board. In reading order it has one tick per
 * chapter; on world time it is a ruler of dates with the chapters' dates
 * marked. Marks above the track show where something appears. It follows
 * the chapter open in the editor until it is dragged or stepped.
 */
export function Scrubber({
  axis,
  ctx,
  point,
  chapterId,
  range,
  marks,
  follow,
  showFuture,
  onChapter,
  onDay,
  onFollow,
  onAxis,
  onShowFuture,
  onClose,
  formatDay,
  t
}) {
  const trackRef = useRef(null)
  const stops = ctx.stops
  const dated = stops.filter((s) => s.day != null)
  const usable = axis === 'reading' ? stops.length > 0 : !!range

  // Fraction along the track for an axis position.
  const frac = (v) => {
    if (axis === 'reading') return stops.length > 1 ? v / (stops.length - 1) : 0.5
    return (v - range[0]) / (range[1] - range[0] || 1)
  }

  const pick = (clientX) => {
    const r = trackRef.current.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    if (axis === 'reading') {
      const i = Math.round(f * (stops.length - 1))
      if (stops[i]) onChapter(stops[i].id)
      return
    }
    const near = dated.find((s) => Math.abs(frac(s.day) * r.width - f * r.width) <= SNAP_PX)
    if (near) onChapter(near.id)
    else onDay(Math.round(range[0] + f * (range[1] - range[0])))
  }

  const step = (dir) => {
    if (axis === 'reading') {
      const cur = point ? point.at : -1
      const next = stops[Math.min(stops.length - 1, Math.max(0, cur + dir))]
      if (next) onChapter(next.id)
      return
    }
    const cur = point?.at ?? -Infinity
    const list =
      dir > 0 ? dated.filter((s) => s.day > cur) : dated.filter((s) => s.day < cur).reverse()
    if (list[0]) onChapter(list[0].id)
  }

  const onPointerDown = (e) => {
    if (!usable || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pick(e.clientX)
  }
  const onPointerMove = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) pick(e.clientX)
  }

  const current = stops.find((s) => s.id === String(chapterId))
  const label = !usable
    ? axis === 'reading'
      ? t('sketchboard.noChapters', 'No chapters yet')
      : t('sketchboard.noDates', 'No dates yet')
    : axis === 'reading'
      ? current
        ? chapterName(t, current)
        : '—'
      : point
        ? formatDay(point.at)
        : '—'
  // On world time the chapter the date comes from goes in the tooltip.
  const labelTitle = axis === 'world' && current ? `${label} · ${chapterName(t, current)}` : label

  return (
    <div
      className="sk-scrubber"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          step(e.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      <IconButton
        icon={Icon.prev}
        title={t('sketchboard.prevChapter', 'Previous chapter')}
        disabled={!usable}
        onClick={() => step(-1)}
      />
      <IconButton
        icon={Icon.next}
        title={t('sketchboard.nextChapter', 'Next chapter')}
        disabled={!usable}
        onClick={() => step(1)}
      />
      <div
        ref={trackRef}
        className={`sk-track${usable ? '' : ' disabled'}`}
        role="slider"
        tabIndex={0}
        aria-label={t('sketchboard.timeline', 'Timeline')}
        aria-valuetext={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div className="sk-track-line" />
        {usable &&
          (axis === 'reading' ? stops : dated).map((s) => (
            <div
              key={s.id}
              className={`sk-track-tick${current?.id === s.id ? ' current' : ''}`}
              style={{ left: `${frac(axis === 'reading' ? s.index : s.day) * 100}%` }}
              title={chapterName(t, s)}
            />
          ))}
        {usable &&
          [...marks.keys()]
            .filter((v) => axis === 'reading' || (v >= range[0] && v <= range[1]))
            .map((v) => (
              <div
                key={v}
                className="sk-track-mark"
                style={{ left: `${frac(v) * 100}%` }}
                title={t('sketchboard.appearsCount', '{{count}} appear here', {
                  count: marks.get(v)
                })}
              />
            ))}
        {usable && point && (
          <div className="sk-track-thumb" style={{ left: `${frac(point.at) * 100}%` }} />
        )}
      </div>
      <div className="sk-scrub-label" title={labelTitle}>
        {label}
      </div>
      <button
        type="button"
        className={`sk-chip-btn${follow ? ' active' : ''}`}
        aria-pressed={follow}
        title={t('sketchboard.followHint', 'Move with the chapter open in the editor')}
        onClick={() => onFollow(!follow)}
      >
        {t('sketchboard.follow', 'Follow')}
      </button>
      <div className="sk-seg sk-axis">
        <button
          type="button"
          className={`sk-chip-btn${axis === 'reading' ? ' active' : ''}`}
          aria-pressed={axis === 'reading'}
          title={t('sketchboard.axisReadingHint', 'When the reader learns of it')}
          onClick={() => onAxis('reading')}
        >
          {t('sketchboard.axisReading', 'Chapters')}
        </button>
        <button
          type="button"
          className={`sk-chip-btn${axis === 'world' ? ' active' : ''}`}
          aria-pressed={axis === 'world'}
          title={t('sketchboard.axisWorldHint', 'When it happens in the story')}
          onClick={() => onAxis('world')}
        >
          {t('sketchboard.axisWorld', 'World time')}
        </button>
      </div>
      <IconButton
        icon={Icon.eye}
        title={t('sketchboard.showFuture', "Show what's coming as outlines")}
        active={showFuture}
        onClick={() => onShowFuture(!showFuture)}
      />
      <IconButton
        icon={Icon.close}
        title={t('sketchboard.closeTimeline', 'Close timeline')}
        onClick={onClose}
      />
    </div>
  )
}

// ── Inspector: Timeline ───────────────────────────────────────

function ChapterSelect({ value, stops, disabled, onChange, label, t }) {
  return (
    <select
      className="sk-input sk-select"
      value={value ?? ''}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{t('sketchboard.noChapter', 'Any chapter')}</option>
      {stops.map((s) => (
        <option key={s.id} value={s.id}>
          {chapterName(t, s)}
        </option>
      ))}
    </select>
  )
}

/** When one node or connection appears and ends, by chapter and/or world date. */
export function TimelineSection({ row, isNode, ctx, calConfig, projectPath, onChange, t }) {
  const set =
    row.appears_chapter_id ||
    row.ends_chapter_id ||
    row.appears_world_time ||
    row.ends_world_time ||
    row.appears_auto
  const [open, setOpen] = useState(!!set)
  const title = t('sketchboard.timeline', 'Timeline')
  if (!open && !set)
    return (
      <Section title={title}>
        <div className="sk-hint">
          {t(
            'sketchboard.timelineHint',
            'Show it only from a chapter or date on, and see it light up on the timeline.'
          )}
        </div>
        <button type="button" className="sk-text-btn" onClick={() => setOpen(true)}>
          {t('sketchboard.setTime', 'Set a time')}
        </button>
      </Section>
    )
  const first = row.first_chapter_id ? ctx.byId.get(String(row.first_chapter_id)) : null
  const auto = isNode && !!row.appears_auto
  return (
    <Section title={title}>
      <div className="sk-time-label">{t('sketchboard.appears', 'Appears')}</div>
      {isNode && row.entity_id && (
        <label className="sk-check">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => onChange({ appears_auto: e.target.checked })}
          />
          {t('sketchboard.firstMention', 'At its first mention')}
          <span className="sk-check-note">
            {first ? chapterName(t, first) : t('sketchboard.notMentioned', 'not in the book yet')}
          </span>
        </label>
      )}
      {!auto && (
        <>
          <ChapterSelect
            value={row.appears_chapter_id}
            stops={ctx.stops}
            label={t('sketchboard.appearsChapter', 'Appears in chapter')}
            onChange={(v) => onChange({ appears_chapter_id: v })}
            t={t}
          />
          <CalendarDatePicker
            compact
            value={row.appears_world_time || ''}
            calConfig={calConfig}
            projectPath={projectPath}
            placeholder={t('sketchboard.worldDate', 'World date…')}
            onChange={(v) => onChange({ appears_world_time: v || null })}
          />
        </>
      )}
      <div className="sk-time-label">{t('sketchboard.ends', 'Ends')}</div>
      <ChapterSelect
        value={row.ends_chapter_id}
        stops={ctx.stops}
        label={t('sketchboard.endsChapter', 'Ends in chapter')}
        onChange={(v) => onChange({ ends_chapter_id: v })}
        t={t}
      />
      <CalendarDatePicker
        compact
        value={row.ends_world_time || ''}
        calConfig={calConfig}
        projectPath={projectPath}
        placeholder={t('sketchboard.worldDate', 'World date…')}
        onChange={(v) => onChange({ ends_world_time: v || null })}
      />
      <button
        type="button"
        className="sk-text-btn sk-time-clear"
        onClick={() => {
          onChange({
            appears_chapter_id: null,
            ends_chapter_id: null,
            appears_world_time: null,
            ends_world_time: null,
            ...(isNode ? { appears_auto: false } : {})
          })
          setOpen(false)
        }}
      >
        {t('sketchboard.clearTime', 'Clear')}
      </button>
    </Section>
  )
}
