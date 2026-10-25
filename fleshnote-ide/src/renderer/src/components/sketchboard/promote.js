/*
 * Turning a board node into an entity: which of the node's text goes where.
 * A lore entry has fields for rules, limitations and origin, and a node's
 * properties with matching names fill them. Every other property becomes a
 * "Name: value" line in the entity's notes.
 */

const LORE_FIELDS = {
  rules: ['rules', 'rule', 'laws', 'law'],
  limitations: [
    'limitations',
    'limitation',
    'limits',
    'limit',
    'cost',
    'costs',
    'weakness',
    'weaknesses'
  ],
  origin: ['origin', 'source']
}

const field = (key) => {
  const k = key.trim().toLowerCase()
  return Object.keys(LORE_FIELDS).find((f) => LORE_FIELDS[f].includes(k)) || null
}

/**
 * { create, update }: the fields for the entity's create call, and for an
 * update right after it (lore takes rules and the like only on update).
 */
export function promoteFields(node, kind) {
  const description = (node.description || '').trim()
  const lines = []
  const lore = {}
  for (const [k, v] of node.props || []) {
    const key = (k || '').trim()
    const value = (v || '').trim()
    if (!key && !value) continue
    const f = kind === 'lore' && key ? field(key) : null
    if (f) lore[f] = lore[f] ? `${lore[f]}\n${value}` : value
    else lines.push(key ? `${key}: ${value}` : value)
  }
  const notes = lines.join('\n')
  const name = (node.name || '').trim()
  if (kind === 'character') return { create: { name, bio: description, notes }, update: null }
  if (kind === 'lore') {
    const update = { ...lore, ...(notes ? { notes } : {}) }
    return { create: { name, description }, update: Object.keys(update).length ? update : null }
  }
  return { create: { name, description, notes }, update: null }
}
