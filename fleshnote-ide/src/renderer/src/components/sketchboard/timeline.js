/*
 * When things are on a board.
 *
 * A node or connection can appear at a chapter and/or a world date, and can
 * end at one. A board reads them along one of two axes:
 *   reading — chapter order: when the reader learns of it;
 *   world   — in-world dates: when it happens in the story.
 * On the world axis a chapter reference stands for that chapter's world date.
 * A bound node set to "first mention" appears at the first chapter that links
 * its entity, and not at all while no chapter does.
 *
 * Positions are numbers: a chapter's index in reading order, or a world date
 * as days since the calendar's year 0. A point on the axis is { at, prev },
 * where prev is the stop before it, so "appears right here" means
 * prev < start <= at.
 */

export const AXES = ['reading', 'world']

/** Chapters in reading order, each with its world day when it has a readable date. */
export function makeTimeContext(chapters, parseDay) {
  const stops = [...(chapters || [])]
    .sort((a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0))
    .map((c, index) => ({
      id: String(c.id),
      index,
      number: c.chapter_number,
      title: c.title || '',
      day: c.world_time ? parseDay(c.world_time) : null
    }))
  return { stops, byId: new Map(stops.map((s) => [s.id, s])), parseDay }
}

const chapter = (ctx, id) => (id != null ? ctx.byId.get(String(id)) || null : null)

function appearsChapter(item) {
  if (!item.appears_auto) return item.appears_chapter_id
  return item.first_chapter_id
}

/** { start, end } of an item on an axis; null means open on that side. */
export function itemSpan(item, axis, ctx) {
  // Set to appear at its first mention, but no chapter mentions it yet.
  const unmet = item.appears_auto && !item.first_chapter_id
  if (axis === 'reading') {
    return {
      start: unmet ? Infinity : (chapter(ctx, appearsChapter(item))?.index ?? null),
      end: chapter(ctx, item.ends_chapter_id)?.index ?? null
    }
  }
  const day = (text, chapterId) => {
    const own = text ? ctx.parseDay(text) : null
    return own ?? chapter(ctx, chapterId)?.day ?? null
  }
  return {
    start: unmet
      ? Infinity
      : day(item.appears_auto ? null : item.appears_world_time, appearsChapter(item)),
    end: day(item.ends_world_time, item.ends_chapter_id)
  }
}

/** A connection is there only while it and both of its ends are. */
export function joinSpans(...spans) {
  const starts = spans.map((s) => s.start).filter((v) => v != null)
  const ends = spans.map((s) => s.end).filter((v) => v != null)
  return {
    start: starts.length ? Math.max(...starts) : null,
    end: ends.length ? Math.min(...ends) : null
  }
}

/**
 * 'always'  — no time set (or no point chosen): drawn as usual;
 * 'future'  — not there yet;
 * 'new'     — appears at this point;
 * 'present' — there;
 * 'ended'   — gone by this point.
 */
export function timeState(span, point) {
  if (!point || (span.start == null && span.end == null)) return 'always'
  if (span.start != null && point.at < span.start) return 'future'
  if (span.end != null && point.at >= span.end) return 'ended'
  if (span.start != null && span.start > point.prev) return 'new'
  return 'present'
}

/** The point for a chapter on an axis, or null when it can't be placed there. */
export function chapterPoint(ctx, axis, chapterId) {
  const stop = chapter(ctx, chapterId)
  if (!stop) return null
  if (axis === 'reading') return { at: stop.index, prev: stop.index - 1 }
  // A chapter without a date of its own is read at the latest date before it.
  const dated = ctx.stops.slice(0, stop.index + 1).filter((s) => s.day != null)
  if (!dated.length) return null
  const at = dated[dated.length - 1].day
  return { at, prev: previousDay(ctx, at) }
}

/** The point for a world day picked freely on the ruler. */
export function dayPoint(ctx, day) {
  return { at: day, prev: previousDay(ctx, day) }
}

function previousDay(ctx, day) {
  const before = ctx.stops.map((s) => s.day).filter((d) => d != null && d < day)
  return before.length ? Math.max(...before) : day - 1
}

/** The [min, max] world days a ruler should cover: every chapter date and item date. */
export function worldRange(ctx, spans) {
  const days = [...ctx.stops.map((s) => s.day), ...spans.flatMap((s) => [s.start, s.end])].filter(
    (d) => d != null && Number.isFinite(d)
  )
  if (!days.length) return null
  let min = Math.min(...days)
  let max = Math.max(...days)
  if (max - min < 60) {
    min -= 30
    max += 30
  }
  return [min, max]
}

/** Positions on the axis where something starts, with how many things start there. */
export function startMarks(spans) {
  const out = new Map()
  for (const s of spans)
    if (s.start != null && Number.isFinite(s.start)) out.set(s.start, (out.get(s.start) || 0) + 1)
  return out
}
