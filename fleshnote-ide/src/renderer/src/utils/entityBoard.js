/*
 * State for the character & place finder's board. Every found name is an item:
 *   { id, name, shelf, loreCategory, aliases: [{ name, on }], frequency, chapterCount, snippets }
 * shelf: 'character' | 'location' | 'lore' | 'unsure' | 'skip'
 * Every operation returns a new array; nothing is mutated.
 */

export const SHELVES = ['character', 'location', 'lore']

/** Analysis result → board items. Confident finds go on their shelf; the rest wait as 'unsure'. */
export function itemsFromAnalysis(result, defaultLoreCategory = 'item') {
  const toItem = (e, confident) => ({
    id: e.name.toLowerCase(),
    name: e.name,
    shelf: confident && e.suggested_type ? e.suggested_type : 'unsure',
    loreCategory: defaultLoreCategory,
    aliases: (e.aliases || []).map((a, i) => ({ name: a, on: e.aliases_on ? e.aliases_on[i] !== false : true })),
    frequency: e.frequency || 0,
    chapterCount: e.chapter_count || 0,
    snippets: e.snippets?.length ? e.snippets : e.snippet ? [e.snippet] : []
  })
  const seen = new Set()
  return [
    ...(result.confident || []).map((e) => toItem(e, true)),
    ...(result.low_confidence || []).map((e) => toItem(e, false))
  ].filter((item) => (seen.has(item.id) ? false : seen.add(item.id)))
}

const update = (items, id, patch) => items.map((it) => (it.id === id ? { ...it, ...patch(it) } : it))

export const moveTo = (items, id, shelf) => update(items, id, () => ({ shelf }))

export const rename = (items, id, name) => update(items, id, () => ({ name }))

export const setLoreCategory = (items, id, loreCategory) => update(items, id, () => ({ loreCategory }))

export const toggleAlias = (items, id, index) =>
  update(items, id, (it) => ({ aliases: it.aliases.map((a, i) => (i === index ? { ...a, on: !a.on } : a)) }))

/** Swaps the main name with one of its alternative spellings. */
export const promoteAlias = (items, id, index) =>
  update(items, id, (it) => ({
    name: it.aliases[index].name,
    aliases: it.aliases.map((a, i) => (i === index ? { name: it.name, on: true } : a))
  }))

/**
 * Folds `sourceId` into `targetId`: its name and spellings become the target's
 * alternative spellings, its mentions add up. The target keeps its shelf.
 */
export function merge(items, sourceId, targetId) {
  if (sourceId === targetId) return items
  const source = items.find((it) => it.id === sourceId)
  const target = items.find((it) => it.id === targetId)
  if (!source || !target) return items
  const known = new Set([target.name, ...target.aliases.map((a) => a.name)].map((n) => n.toLowerCase()))
  const added = [{ name: source.name, on: true }, ...source.aliases].filter((a) => {
    const key = a.name.toLowerCase()
    return known.has(key) ? false : known.add(key)
  })
  const merged = {
    ...target,
    aliases: [...target.aliases, ...added],
    frequency: target.frequency + source.frequency,
    chapterCount: Math.max(target.chapterCount, source.chapterCount),
    snippets: [...target.snippets, ...source.snippets].slice(0, 3)
  }
  return items.filter((it) => it.id !== sourceId).map((it) => (it.id === targetId ? merged : it))
}

export const onShelf = (items, shelf) =>
  items.filter((it) => it.shelf === shelf).sort((a, b) => b.frequency - a.frequency)

export function counts(items) {
  const c = { character: 0, location: 0, lore: 0, unsure: 0, skip: 0 }
  for (const it of items) c[it.shelf] += 1
  return c
}

/** What the backend's bulk-create endpoint takes: everything on a shelf. */
export const toCreatePayload = (items) =>
  items
    .filter((it) => SHELVES.includes(it.shelf) && it.name.trim())
    .map((it) => ({
      name: it.name.trim(),
      type: it.shelf,
      lore_category: it.shelf === 'lore' ? it.loreCategory : null,
      aliases: it.aliases.filter((a) => a.on).map((a) => a.name)
    }))

/** Chip size: frequent names read larger (12–20px). */
export function chipSize(frequency, maxFrequency) {
  if (maxFrequency <= 1) return 13
  return Math.round(12 + 8 * (Math.log(Math.max(frequency, 1)) / Math.log(maxFrequency)))
}
