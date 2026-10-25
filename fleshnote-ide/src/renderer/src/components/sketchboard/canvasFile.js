/*
 * Boards to and from JSON Canvas (https://jsoncanvas.org), the .canvas files
 * Obsidian uses. The format has text cards, groups and straight connections
 * between sides, so a board's shapes, line bends, dashes, end shapes other
 * than arrows, the legend and times are left out on the way there.
 */

// Brand colours as JSON Canvas presets ("1" red … "6" purple) and back.
const TO_PRESET = { red: '1', amber: '2', green: '4', blue: '5', purple: '6' }
const FROM_PRESET = { 1: 'red', 2: 'amber', 3: 'amber', 4: 'green', 5: 'blue', 6: 'purple' }
const SIDES = ['top', 'right', 'bottom', 'left']

const round = (v) => Math.round(Number(v) || 0)

function cardText(n) {
  const name = (n.entity_name ?? n.name ?? '').trim()
  if (n.shape === 'text') return name
  const props = (n.props || [])
    .filter(([k, v]) => k || v)
    .map(([k, v]) => `- ${k}${k && v ? ': ' : ''}${v}`)
    .join('\n')
  return [name && `**${name}**`, (n.description || '').trim(), props].filter(Boolean).join('\n\n')
}

/**
 * The board as a JSON Canvas document (a string, ready to save). The legend
 * doesn't travel, so an unlabelled line of a type is labelled with the type's name.
 */
export function toJsonCanvas(nodes, edges, types = []) {
  const ids = new Set(nodes.map((n) => n.id))
  const typeName = new Map(types.map((ty) => [ty.id, ty.name]))
  // Groups first: later nodes sit on top.
  const ordered = [...nodes].sort(
    (a, b) => (a.shape === 'frame' ? 0 : 1) - (b.shape === 'frame' ? 0 : 1)
  )
  const out = {
    nodes: ordered.map((n) => {
      const base = {
        id: n.id,
        x: round(n.pos_x),
        y: round(n.pos_y),
        width: round(n.size_x),
        height: round(n.size_y),
        ...(TO_PRESET[n.color_token] ? { color: TO_PRESET[n.color_token] } : {})
      }
      return n.shape === 'frame'
        ? { ...base, type: 'group', label: (n.name || '').trim() }
        : { ...base, type: 'text', text: cardText(n) }
    }),
    edges: edges
      .filter((c) => ids.has(c.item_start_id) && ids.has(c.item_end_id))
      .map((c) => ({
        id: c.id,
        fromNode: c.item_start_id,
        ...(SIDES.includes(c.from_side) ? { fromSide: c.from_side } : {}),
        fromEnd: c.start_marker && c.start_marker !== 'none' ? 'arrow' : 'none',
        toNode: c.item_end_id,
        ...(SIDES.includes(c.to_side) ? { toSide: c.to_side } : {}),
        toEnd: c.end_marker && c.end_marker !== 'none' ? 'arrow' : 'none',
        ...(TO_PRESET[c.color_token] ? { color: TO_PRESET[c.color_token] } : {}),
        ...(c.title || typeName.get(c.type_id)
          ? { label: c.title || typeName.get(c.type_id) }
          : {})
      }))
  }
  return JSON.stringify(out, null, '\t')
}

const clamp = (v, lo, hi) => Math.min(Math.max(Number.isFinite(v) ? v : lo, lo), hi)
const colorOf = (c) => FROM_PRESET[String(c)] || 'neutral'

/** A card's text as a name (its first line, without Markdown marks) and a description (the rest). */
function splitText(text) {
  const lines = String(text || '').split('\n')
  const name = (lines[0] || '')
    .replace(/^#+\s*/, '')
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .trim()
  return { name: name.slice(0, 200), description: lines.slice(1).join('\n').trim().slice(0, 20000) }
}

/**
 * A JSON Canvas document as batch operations for an empty board, nodes
 * before the connections that use them. Throws on a file that isn't one.
 */
export function fromJsonCanvas(text, uid) {
  const doc = JSON.parse(text)
  if (!doc || !Array.isArray(doc.nodes)) throw new Error('Not a JSON Canvas file')
  const ids = new Map()
  const ops = []
  for (const n of doc.nodes) {
    if (!n || typeof n !== 'object' || ids.has(n.id)) continue
    const id = uid()
    ids.set(n.id, id)
    const isGroup = n.type === 'group'
    const fields = isGroup
      ? { name: String(n.label || '').slice(0, 200), description: '' }
      : n.type === 'file'
        ? {
            name: String(n.file || '')
              .split('/')
              .pop()
              .replace(/\.[^.]+$/, '')
              .slice(0, 200),
            description: ''
          }
        : n.type === 'link'
          ? { name: String(n.url || '').slice(0, 200), description: '' }
          : splitText(n.text)
    ops.push({
      op: 'put_node',
      id,
      fields: {
        ...fields,
        shape: isGroup ? 'frame' : 'card',
        color_token: colorOf(n.color),
        pos_x: clamp(n.x, -1e6, 1e6),
        pos_y: clamp(n.y, -1e6, 1e6),
        size_x: clamp(n.width, 20, 4000),
        size_y: clamp(n.height, 20, 4000),
        z_index: isGroup ? -1 : 1
      }
    })
  }
  for (const e of Array.isArray(doc.edges) ? doc.edges : []) {
    const from = ids.get(e?.fromNode)
    const to = ids.get(e?.toNode)
    if (!from || !to || from === to) continue
    ops.push({
      op: 'put_edge',
      id: uid(),
      fields: {
        item_start_id: from,
        item_end_id: to,
        from_side: SIDES.includes(e.fromSide) ? e.fromSide : 'auto',
        to_side: SIDES.includes(e.toSide) ? e.toSide : 'auto',
        routing: 'straight',
        start_marker: e.fromEnd === 'arrow' ? 'arrow' : 'none',
        end_marker: e.toEnd === 'none' ? 'none' : 'arrow',
        color_token: colorOf(e.color),
        title: String(e.label || '').slice(0, 200)
      }
    })
  }
  return ops
}
