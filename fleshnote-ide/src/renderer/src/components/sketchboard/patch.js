/*
 * Patches and the batch operations that save them.
 *
 * A patch is { nodes?, edges?, types?, kinds? }, each { id: row | null },
 * where null removes the row.
 */

// Fields the batch endpoint accepts, per row kind.
export const NODE_FIELDS = [
  'name',
  'description',
  'shape',
  'color_token',
  'entity_type',
  'entity_id',
  'pos_x',
  'pos_y',
  'size_x',
  'size_y',
  'z_index',
  'kind_id',
  'parent_id',
  'props',
  'appears_chapter_id',
  'ends_chapter_id',
  'appears_world_time',
  'ends_world_time',
  'appears_auto'
]
export const EDGE_FIELDS = [
  'item_start_id',
  'item_end_id',
  'from_side',
  'to_side',
  'routing',
  'waypoints',
  'start_marker',
  'end_marker',
  'conn_type',
  'color_token',
  'title',
  'label_t',
  'type_id',
  'appears_chapter_id',
  'ends_chapter_id',
  'appears_world_time',
  'ends_world_time'
]
export const TYPE_FIELDS = [
  'name',
  'color_token',
  'conn_type',
  'start_marker',
  'end_marker',
  'sort_order'
]
export const KIND_FIELDS = ['name', 'shape', 'color_token', 'sort_order']

export const BUCKETS = ['nodes', 'edges', 'types', 'kinds']

// Row ids are made here so changes can be shown, undone and redone before the
// server answers. randomUUID needs a secure context; the browser build may be
// served over plain http.
export const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

const SPEC = {
  types: { put: 'put_type', del: 'del_type', fields: TYPE_FIELDS },
  kinds: { put: 'put_kind', del: 'del_kind', fields: KIND_FIELDS },
  nodes: { put: 'put_node', del: 'del_node', fields: NODE_FIELDS },
  edges: { put: 'put_edge', del: 'del_edge', fields: EDGE_FIELDS }
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)

function changedFields(before, after, fields) {
  const out = {}
  for (const f of fields) {
    if (after[f] === undefined) continue
    if (!before || !same(before[f], after[f])) out[f] = after[f]
  }
  // A binding is saved as a pair, or the server refuses it.
  if ('entity_type' in out || 'entity_id' in out) {
    out.entity_type = after.entity_type ?? null
    out.entity_id = after.entity_id ?? null
  }
  return out
}

/**
 * Batch operations that take the server from `before` to `after`. Rows go in
 * before the rows that point at them and come out after: legend entries,
 * then nodes, then connections; deletes in the reverse order.
 */
export function patchToOps(before, after) {
  const puts = (kind) =>
    Object.entries(after[kind] || {})
      .filter(([, row]) => row)
      .map(([id, row]) => ({
        op: SPEC[kind].put,
        id,
        fields: changedFields(before[kind]?.[id], row, SPEC[kind].fields)
      }))
  const dels = (kind) =>
    Object.entries(after[kind] || {})
      .filter(([id, row]) => !row && before[kind]?.[id])
      .map(([id]) => ({ op: SPEC[kind].del, id }))
  return [
    ...puts('types'),
    ...puts('kinds'),
    ...puts('nodes'),
    ...puts('edges'),
    ...dels('edges'),
    ...dels('nodes'),
    ...dels('kinds'),
    ...dels('types')
  ].filter((op) => op.op.startsWith('del') || Object.keys(op.fields).length)
}

/** `list` with a patch bucket applied: rows replaced or removed in place, new rows appended. */
export function applyPatch(list, patch = {}) {
  const seen = new Set()
  const out = []
  for (const row of list) {
    if (row.id in patch) {
      seen.add(row.id)
      if (patch[row.id]) out.push(patch[row.id])
    } else out.push(row)
  }
  for (const [id, row] of Object.entries(patch)) if (row && !seen.has(id)) out.push(row)
  return out
}
