/*
 * The board's legend: named connection types ("Fuels", "Counters") and node
 * kinds ("Source", "Effect"). An entry owns a look. Giving a connection a
 * type copies the type's look onto it, so every build draws it the same.
 * Restyling the type later restyles the rows that still wear its old look;
 * a row restyled by hand keeps its own look and shows as a custom style.
 *
 * Every function here returns a patch for useBoardStore:
 * { types?, kinds?, nodes?, edges? }, each { id: row | null }.
 */

export const TYPE_LOOK = ['color_token', 'conn_type', 'start_marker', 'end_marker']
export const KIND_LOOK = ['shape', 'color_token']

// Which rows each legend bucket styles, and the field that points at it.
const TARGET = {
  types: { rows: 'edges', ref: 'type_id', look: TYPE_LOOK },
  kinds: { rows: 'nodes', ref: 'kind_id', look: KIND_LOOK }
}

export function lookOf(row, fields) {
  return Object.fromEntries(fields.map((f) => [f, row[f]]))
}

export function sameLook(a, b, fields) {
  return fields.every((f) => a[f] === b[f])
}

/** True when a row carries a legend entry but has been restyled by hand. */
export function isCustom(row, entry, bucket) {
  return !!entry && !sameLook(row, entry, TARGET[bucket].look)
}

const norm = (s) => (s || '').trim().toLowerCase()

/** The entry whose name matches `name`, ignoring case and outer spaces. */
export function entryNamed(entries, name) {
  const n = norm(name)
  return n ? entries.find((e) => norm(e.name) === n) || null : null
}

/** Gives `rows` the entry (or takes it away with entry = null, keeping their look). */
export function assignPatch(bucket, rows, entry) {
  const { rows: kind, ref, look } = TARGET[bucket]
  const patch = {}
  for (const r of rows)
    patch[r.id] = entry ? { ...r, ...lookOf(entry, look), [ref]: entry.id } : { ...r, [ref]: null }
  return { [kind]: patch }
}

/**
 * Changes an entry. When its look changes, rows of that entry that still
 * match the old look follow; hand-styled rows stay as they are. A rename
 * also renames connection labels that were the old name, so labels typed
 * to pick the type keep matching it.
 */
export function updateEntryPatch(bucket, entry, fields, rows) {
  const { rows: kind, ref, look } = TARGET[bucket]
  const next = { ...entry, ...fields }
  const patch = {}
  const restyle = !sameLook(entry, next, look)
  const renamed = bucket === 'types' && 'name' in fields && norm(fields.name) !== norm(entry.name)
  for (const r of rows) {
    if (r[ref] !== entry.id) continue
    let row = r
    if (restyle && sameLook(r, entry, look)) row = { ...row, ...lookOf(next, look) }
    if (renamed && norm(r.title) === norm(entry.name)) row = { ...row, title: next.name }
    if (row !== r) patch[r.id] = row
  }
  return { [bucket]: { [entry.id]: next }, [kind]: patch }
}

/** Deletes an entry; its rows keep their look and lose the link. */
export function removeEntryPatch(bucket, entry, rows) {
  const { ref } = TARGET[bucket]
  return {
    ...assignPatch(
      bucket,
      rows.filter((r) => r[ref] === entry.id),
      null
    ),
    [bucket]: { [entry.id]: null }
  }
}

/** A new entry named `name` with `row`'s look, given to `row` and to `alsoRows`. */
export function saveAsEntryPatch(bucket, id, name, row, sortOrder, alsoRows = []) {
  const { look } = TARGET[bucket]
  const entry = { id, name: name.trim().slice(0, 80), ...lookOf(row, look), sort_order: sortOrder }
  const assigned = assignPatch(bucket, [row, ...alsoRows], entry)
  // The source row already has the look; the others take it on.
  return { [bucket]: { [id]: entry }, ...assigned }
}

/**
 * What a connection's new label means for its type: a label naming a type
 * gives the connection that type. Any other label leaves the type as it is,
 * so a typed line can carry a note of its own.
 */
export function labelPatch(edge, title, types) {
  const type = entryNamed(types, title)
  const row = { ...edge, title }
  if (type && edge.type_id !== type.id) return assignPatch('types', [row], type)
  return { edges: { [edge.id]: row } }
}

/** Legend references that point outside `types` / `kinds` dropped (pasting from another board). */
export function localiseRefs(row, types, kinds) {
  const out = { ...row }
  if ('type_id' in out && out.type_id && !types.some((x) => x.id === out.type_id))
    out.type_id = null
  if ('kind_id' in out && out.kind_id && !kinds.some((x) => x.id === out.kind_id))
    out.kind_id = null
  return out
}

export function nextSortOrder(entries) {
  return entries.reduce((m, e) => Math.max(m, e.sort_order || 0), -1) + 1
}
