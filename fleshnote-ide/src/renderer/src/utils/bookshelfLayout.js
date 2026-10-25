// Pure helpers for the project picker bookshelf.
// Layout (per workspace, stored in global config under `bookshelf.workspaces[path]`):
//   { shelves: [{ id, name }], placement: { [project_id]: { shelf, order } } }
// Projects without a placement (or pointing at a deleted shelf) live on the
// implicit "Unsorted" shelf, ordered most-recently-opened first.

export const UNSORTED = '__unsorted'

export const EMPTY_LAYOUT = { shelves: [], placement: {} }

// Dark leather/cloth bindings — used when a project has no book_color yet.
export const BOOK_PALETTE = [
  '#6e2b2b', '#7a4a24', '#5b4a2a', '#3f5236', '#2d4a4a',
  '#2c3d5c', '#3d3160', '#5a2e4f', '#4a4a4a', '#6b5a3a',
  '#8a3b2e', '#2f5a45', '#44306b', '#1f3b3f', '#7a6a4a',
]

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// book_color comes from shared project files and lands in CSS — hex only.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function bookColor(project) {
  if (HEX_COLOR.test(project.book_color || '')) return project.book_color
  return BOOK_PALETTE[hashString(project.project_id || project.path) % BOOK_PALETTE.length]
}

// Page-block depth on the cover's edge. Log scale: a 300-word test is a thin
// pamphlet (~6px), a 100k-word novel a proper tome (~18px).
export function bookDepth(words) {
  const d = 3 + 5 * Math.log10((words || 0) / 100 + 1)
  return Math.round(Math.min(20, Math.max(3, d)))
}

/** Groups projects into [{ id, name, books }], user shelves first, Unsorted last. */
export function buildShelves(layout, projects) {
  const shelves = layout.shelves.map((s) => ({ ...s, books: [] }))
  const byId = new Map(shelves.map((s) => [s.id, s]))
  const unsorted = []
  for (const proj of projects) {
    const place = layout.placement[proj.project_id]
    const shelf = place && byId.get(place.shelf)
    if (shelf) shelf.books.push(proj)
    else unsorted.push(proj)
  }
  for (const s of shelves) {
    s.books.sort((a, b) => layout.placement[a.project_id].order - layout.placement[b.project_id].order)
  }
  return [...shelves, { id: UNSORTED, name: null, books: unsorted }]
}

/**
 * Moves a book onto `shelfId` at `index` (index within that shelf's current
 * book list, as rendered). Re-numbers orders of the target shelf.
 */
export function moveBook(layout, projects, projectId, shelfId, index) {
  const placement = { ...layout.placement }
  if (shelfId === UNSORTED) {
    delete placement[projectId]
    return { ...layout, placement }
  }
  const target = buildShelves(layout, projects).find((s) => s.id === shelfId)
  if (!target) return layout
  const ids = target.books.map((b) => b.project_id)
  const from = ids.indexOf(projectId)
  if (from !== -1) {
    ids.splice(from, 1)
    if (from < index) index -= 1
  }
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, projectId)
  ids.forEach((id, order) => { placement[id] = { shelf: shelfId, order } })
  return { ...layout, placement }
}

export function addShelf(layout, name) {
  const id = crypto.randomUUID()
  return { layout: { ...layout, shelves: [...layout.shelves, { id, name }] }, id }
}

export function renameShelf(layout, shelfId, name) {
  return { ...layout, shelves: layout.shelves.map((s) => (s.id === shelfId ? { ...s, name } : s)) }
}

export function moveShelf(layout, shelfId, delta) {
  const shelves = [...layout.shelves]
  const i = shelves.findIndex((s) => s.id === shelfId)
  const j = i + delta
  if (i < 0 || j < 0 || j >= shelves.length) return layout
  ;[shelves[i], shelves[j]] = [shelves[j], shelves[i]]
  return { ...layout, shelves }
}

/** Deletes a shelf; its books fall back to Unsorted. Never touches projects. */
export function deleteShelf(layout, shelfId) {
  const placement = {}
  for (const [id, p] of Object.entries(layout.placement)) {
    if (p.shelf !== shelfId) placement[id] = p
  }
  return { shelves: layout.shelves.filter((s) => s.id !== shelfId), placement }
}

/** Drops placements for projects that are no longer in the workspace. */
export function pruneLayout(layout, projects) {
  if (!projects.length) return layout
  const known = new Set(projects.map((p) => p.project_id))
  const placement = {}
  for (const [id, p] of Object.entries(layout.placement)) {
    if (known.has(id)) placement[id] = p
  }
  return { ...layout, placement }
}
