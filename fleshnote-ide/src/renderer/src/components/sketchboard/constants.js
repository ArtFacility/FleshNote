import { ROVAS_CAPITALS } from '../../utils/runes'

// Node shapes, in tool-rail order. `key` is the keyboard shortcut.
export const SHAPES = [
  { id: 'card', key: 'r', w: 160, h: 64 },
  { id: 'diamond', key: 'd', w: 140, h: 96 },
  { id: 'ellipse', key: 'o', w: 140, h: 80 },
  { id: 'hex', key: 'h', w: 160, h: 72 },
  { id: 'text', key: 't', w: 180, h: 40 },
  { id: 'frame', key: 'f', w: 420, h: 280 }
]
export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((s) => [s.id, s]))

// Colour is meaning, not decoration: the six brand accents (index.css).
export const COLORS = {
  neutral: { line: 'var(--text-secondary)', fill: 'var(--bg-surface)' },
  amber: { line: 'var(--accent-amber)', fill: 'var(--accent-amber-dim)' },
  red: { line: 'var(--accent-red)', fill: 'var(--accent-red-dim)' },
  green: { line: 'var(--accent-green)', fill: 'var(--accent-green-dim)' },
  blue: { line: 'var(--accent-blue)', fill: 'var(--accent-blue-dim)' },
  purple: { line: 'var(--accent-purple)', fill: 'var(--accent-purple-dim)' }
}
export const COLOR_IDS = Object.keys(COLORS)

export const ROUTINGS = ['straight', 'curved', 'elbow']
export const MARKERS = ['none', 'arrow', 'bar', 'dot', 'diamond']
export const DASHES = {
  solid: null,
  dashed: '8 5',
  dotted: '2 4',
  dashdot: '8 4 2 4',
  longdash: '16 5'
}

// Entities a node can stand for, with their semantic colour and the prefix
// the bulk icon map uses for their portraits.
export const ENTITY_KINDS = {
  character: { color: 'amber', iconPrefix: 'char' },
  location: { color: 'green', iconPrefix: 'loc' },
  lore: { color: 'blue', iconPrefix: 'item' },
  group: { color: 'amber', iconPrefix: 'group' }
}

/** The entity kind a row of the IDE's entity list is, or null for quick notes and annotations. */
export function entityKind(entity) {
  if (!entity) return null
  return ENTITY_KINDS[entity.type] ? entity.type : null
}

// Board icons: Rovás capitals (always drawn with var(--font-runes)).
export const BOARD_RUNES = ROVAS_CAPITALS

export const DEFAULT_SETTINGS = { routing: 'curved', snap: true, portraits: true }
export const GRID = 10
