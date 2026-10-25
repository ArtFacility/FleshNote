export function applyFrameworkVariant(framework, variantId) {
  if (!framework) return null
  const variant = (framework.variants || []).find((v) => v.id === variantId)
  if (!variant) return framework
  const merged = { ...framework }
  if (variant.curve_points) merged.curve_points = variant.curve_points
  const labels = variant.marker_labels || {}
  if (Object.keys(labels).length) {
    merged.craft_markers = (framework.craft_markers || []).map((m) => ({
      ...m,
      title: labels[m.title] || m.title
    }))
    merged.blocks = (framework.blocks || []).map((b) => ({
      ...b,
      label: labels[b.label] || b.label
    }))
  }
  if (variant.arc_labels) {
    merged.arcs = (framework.arcs || []).map((a) => ({
      ...a,
      name: (variant.arc_labels[a.name] || a.name)
    }))
  }
  return merged
}

export function inferEngineForArchetype(archetype, engines = []) {
  const found = engines.find((e) => (e.auto_map || []).includes(archetype))
  return found ? found.id : 'golden_fleece'
}

export const ENGINE_AXIS_FALLBACKS = {
  monster_in_the_house: 'Monster Threat ↑',
  golden_fleece: 'Journey Pressure ↑',
  voyage_and_return: 'Strange World Danger ↑',
  rags_to_riches: 'Fortune Shifts ↑',
  comedy_engine: 'Chaos & Clarity ↑',
  tragedy_engine: 'Hubris & Ruin ↑',
  rebirth: 'Renewal Pressure ↑',
  dude_with_a_problem: 'Crisis Pressure ↑',
  buddy_love: 'Bond Tension ↑',
  whydunit: 'Secrets Revealed ↑',
  fool_triumphant: 'Underdog Surge ↑',
  out_of_the_bottle: 'Magic Escalation ↑',
  rites_of_passage: 'Transition Pressure ↑',
  institutionalized: 'System Pressure ↑'
}

const DEFAULT_LENGTH_CONVENTIONS = {
  custom: { min: 40000, max: 160000, base: 80000 }
}

export function suggestWordCount(frameworkId, engineId, genre, drivers, conventions, genreOffsets) {
  const conv = (conventions || {})[frameworkId] || DEFAULT_LENGTH_CONVENTIONS.custom
  let base = conv.base
  base += (genreOffsets || {})[genre] || 0
  if (drivers) {
    const pol = Number(drivers.polarity) || 0
    const inten = Number(drivers.intensity) || 0.5
    if (pol <= -0.6) base -= 5000
    if (inten >= 0.85) base += 5000
  }
  const suggested = Math.max(conv.min, Math.min(conv.max, base))
  return {
    min: conv.min,
    max: conv.max,
    suggested: Math.round(suggested / 500) * 500
  }
}
