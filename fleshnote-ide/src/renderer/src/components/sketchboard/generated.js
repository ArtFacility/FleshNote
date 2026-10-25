import { chapterPoint } from './timeline.js'

/*
 * Generated boards: live views of relationships and factions.
 *
 * The board stores only where its entities sit (ordinary bound nodes). The
 * connections are worked out here from the project's history at the
 * scrubbed point, and are never saved or edited on the board.
 */

export const GENERATED_TYPES = ['gen_relationships', 'gen_factions']

export const isGenerated = (board) => GENERATED_TYPES.includes(board?.board_type)

/**
 * The node id for an entity on a generated board. The same on every device,
 * so two devices that place the same entity make the same row, and a sync
 * merges them instead of leaving two. (64-bit FNV-1a of board, kind and id.)
 */
export function genNodeId(boardId, type, entityId) {
  let h = 0xcbf29ce484222325n
  for (const ch of `${boardId}|${type}|${entityId}`) {
    h ^= BigInt(ch.codePointAt(0))
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return `g${h.toString(16).padStart(16, '0')}`
}

const SIZE = { character: [160, 64], group: [170, 72] }

/** Where each entity starts: characters in a circle; factions in a row above their members. */
export function genLayout(kind, entities) {
  const out = new Map()
  if (kind === 'relationships') {
    const n = entities.length
    const r = Math.max(220, n * 34)
    entities.forEach((e, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1)
      const [w, h] = SIZE.character
      out.set(`${e.type}:${e.id}`, {
        x: Math.round((Math.cos(a) * r - w / 2) / 10) * 10,
        y: Math.round((Math.sin(a) * r - h / 2) / 10) * 10,
        w,
        h
      })
    })
    return out
  }
  const groups = entities.filter((e) => e.type === 'group')
  const people = entities.filter((e) => e.type !== 'group')
  const cols = Math.max(groups.length, 4)
  groups.forEach((g, i) => out.set(`group:${g.id}`, { x: i * 240, y: 0, w: 170, h: 72 }))
  people.forEach((p, i) =>
    out.set(`${p.type}:${p.id}`, {
      x: (i % cols) * 200,
      y: 200 + Math.floor(i / cols) * 120,
      w: 160,
      h: 64
    })
  )
  return out
}

// ── State at a point ──────────────────────────────────────────

const indexOfNumber = (ctx, n) => ctx.stops.find((s) => s.number === n)?.index ?? null

/**
 * One direction of a relationship at a point: the tracker's latest row that
 * is not past it (rows without a chapter, or without a readable date on the
 * world axis, always count). With no point, the latest row of all.
 * Returns { row, state } or null when the direction has no history.
 */
export function relationState(history, axis, point, ctx) {
  if (!history.length) return null
  if (!point) return { row: history[history.length - 1], state: 'always' }
  let valid
  let isNew
  if (axis === 'reading') {
    const num = ctx.stops[point.at]?.number
    valid = history.filter(
      (r) => r.chapter_number == null || num == null || r.chapter_number <= num
    )
    isNew = (r) =>
      r.chapter_number != null && (indexOfNumber(ctx, r.chapter_number) ?? -Infinity) > point.prev
  } else {
    valid = history.filter((r) => r.day == null || r.day <= point.at)
    isNew = (r) => r.day != null && r.day > point.prev
  }
  if (!valid.length) return { row: history[0], state: 'future' }
  const row = valid[valid.length - 1]
  return { row, state: isNew(row) ? 'new' : 'present' }
}

/**
 * The connections a relationships board draws at a point: one per direction,
 * or one with arrows at both ends when both directions stand on the same
 * mutual turning point.
 */
export function relationshipEdges(pairs, axis, point, ctx) {
  const states = new Map(
    pairs.map((p) => [`${p.from}>${p.to}`, { ...p, s: relationState(p.history, axis, point, ctx) }])
  )
  const out = []
  for (const p of states.values()) {
    if (!p.s) continue
    const back = states.get(`${p.to}>${p.from}`)
    const shared = p.s.row.mutual && back?.s && back.s.row.id === p.s.row.id
    if (shared && p.from > p.to) continue
    out.push({
      key: `${p.from}>${p.to}`,
      from: p.from,
      to: p.to,
      row: p.s.row,
      state: p.s.state,
      mutual: !!shared
    })
  }
  return out
}

/** The world point a point stands for: itself on the world axis, its chapter's date in reading order. */
function worldPoint(axis, point, ctx) {
  if (!point) return null
  if (axis === 'world') return point
  const stop = ctx.stops[point.at]
  return stop ? chapterPoint(ctx, 'world', stop.id) : null
}

/**
 * A faction membership at a point. Memberships only have world dates; with
 * no date to compare against, one with a leaving date reads as ended, as in
 * the faction roster.
 */
export function membershipState(link, axis, point, ctx) {
  const p = worldPoint(axis, point, ctx)
  if (!p) return link.left_date ? 'ended' : 'always'
  if (link.joined_day != null && link.joined_day > p.at) return 'future'
  if (link.left_day != null && link.left_day <= p.at) return 'ended'
  if (link.joined_day != null && link.joined_day > p.prev) return 'new'
  return 'present'
}

// Relationship types the tracker offers, as line looks; anything else is neutral.
export const REL_STYLE = {
  friendship: ['green', 'solid'],
  love: ['red', 'solid'],
  hate: ['red', 'dotted'],
  spite: ['purple', 'dashed'],
  guilt: ['purple', 'dotted'],
  trust: ['blue', 'solid'],
  distrust: ['amber', 'dashed']
}

export function relStyle(relType) {
  const [color_token, conn_type] = REL_STYLE[(relType || '').toLowerCase()] || ['neutral', 'solid']
  return { color_token, conn_type }
}

/** A node's state from its connections: not there yet while all of them are still to come. */
export function nodeStateFrom(states) {
  if (!states.length) return 'always'
  if (states.every((s) => s === 'future')) return 'future'
  if (states.every((s) => s === 'ended')) return 'ended'
  return 'always'
}
