import * as en from './en'

// Language registry mapping ISO code to dictionary pack
const LIBRARIES = {
  en: en
}

function getLib(lang = 'en') {
  return LIBRARIES[lang] || LIBRARIES.en
}

export function pickRandom(arr) {
  if (!arr || arr.length === 0) return ''
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickRandomN(arr, n = 1) {
  if (!arr || arr.length === 0) return []
  const copy = [...arr]
  const result = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(idx, 1)[0])
  }
  return result
}

export const DEFAULT_ROLES = [
  'Protagonist',
  'Antagonist',
  'Deuteragonist',
  'Supporting',
  'Mentor',
  'Wildcard',
  'Rival',
  'Comic Relief / Foil',
  'Love Interest',
  'Reluctant Ally'
]

export const STORY_GENRES = en.STORY_GENRES || []

/**
 * Returns available positive, negative trait pools, and narrative roles for character creation.
 */
export function getTraitPools(lang = 'en') {
  const lib = getLib(lang)
  const rawRoles = lib.CHARACTER_DATA?.roles || DEFAULT_ROLES
  const roles = rawRoles.map((r) => (typeof r === 'string' ? r : r.label || r.id))
  return {
    positive: lib.CHARACTER_DATA?.traits?.positive || [],
    negative: lib.CHARACTER_DATA?.traits?.negative || [],
    roles: roles && roles.length > 0 ? roles : DEFAULT_ROLES
  }
}

/**
 * Generates a one-sentence Madlibs character logline.
 */
export function rollCharacterDescription(lang = 'en') {
  const lib = getLib(lang)
  const d = lib.CHARACTER_DATA
  const isWildcard = Math.random() < 0.08 && lib.CHARACTER_WILDCARD_TEMPLATES?.length > 0
  const template = isWildcard
    ? pickRandom(lib.CHARACTER_WILDCARD_TEMPLATES)
    : pickRandom(lib.CHARACTER_TEMPLATES)

  return template
    .replace('{archetype}', pickRandom(d.archetypes))
    .replace('{condition}', pickRandom(d.conditions))
    .replace('{catalyst}', pickRandom(d.catalysts))
    .replace('{action}', pickRandom(d.actions))
    .replace('{determiner}', pickRandom(d.determiners))
    .replace('{subject}', pickRandom(d.subjects))
    .replace('{stakes}', pickRandom(d.stakes))
    .replace('{wildcard}', pickRandom(d.wildcards || d.catalysts))
}

/**
 * Generates a full randomized character spark entity.
 */
export function generateCharacterSpark({
  lang = 'en',
  role = null,
  age = null,
  traits = null,
  name = null
} = {}) {
  const lib = getLib(lang)
  const d = lib.CHARACTER_DATA

  const chosenRole = role || pickRandom(d.roles)?.id || 'Protagonist'
  const chosenAge = typeof age === 'number' ? age : Math.floor(Math.random() * 55) + 16
  const chosenName = name || pickRandom(d.names) || 'Unnamed Explorer'
  const positive = traits?.positive || pickRandomN(d.traits.positive, 2)
  const negative = traits?.negative || pickRandomN(d.traits.negative, 2)
  const description = rollCharacterDescription(lang)

  return {
    id: 'char_' + Math.random().toString(36).substr(2, 9),
    type: 'character',
    name: chosenName,
    role: chosenRole,
    age: chosenAge,
    positiveTraits: positive,
    negativeTraits: negative,
    description: description,
    notes: `Age: ${chosenAge} | Positive: ${positive.join(', ')} | Flaws: ${negative.join(', ')}`
  }
}

/**
 * Generates a one-sentence Madlibs location description.
 */
export function rollLocationDescription({
  lang = 'en',
  siteType = null,
  climate = null,
  scale = null
} = {}) {
  const lib = getLib(lang)
  const d = lib.LOCATION_DATA
  const template = pickRandom(lib.LOCATION_TEMPLATES)

  const chosenSiteType = siteType || pickRandom(d.siteTypes)
  const chosenClimate = climate ? climate.toLowerCase() : pickRandom(d.climates)?.id || 'temperate'
  const chosenScale = scale ? scale.toLowerCase() : pickRandom(d.scales)?.id || 'local'

  return template
    .replace('{terrain}', pickRandom(d.terrains))
    .replace('{relation}', pickRandom(d.relations))
    .replace('{landmark}', pickRandom(d.landmarks))
    .replace('{atmosphere}', pickRandom(d.atmospheres))
    .replace('{siteType}', chosenSiteType)
    .replace('{climate}', chosenClimate)
    .replace('{scale}', chosenScale)
}

/**
 * Generates a full randomized location spark entity.
 */
export function generateLocationSpark({
  lang = 'en',
  siteType = null,
  population = null,
  climate = null,
  scale = null,
  name = null
} = {}) {
  const lib = getLib(lang)
  const d = lib.LOCATION_DATA

  const chosenSiteType = siteType || pickRandom(d.siteTypes)
  const chosenClimate = climate || pickRandom(d.climates)?.id || 'temperate'
  const chosenScale = scale || pickRandom(d.scales)?.id || 'local'
  const chosenPop = population || pickRandom(d.populations)?.id || 'settlement'

  let generatedName = name
  if (!generatedName) {
    const hasPrefix = Math.random() < 0.6
    const prefix = hasPrefix ? pickRandom(d.namePrefixes) + ' ' : ''
    const root = pickRandom(d.nameRoots)
    const suffix = pickRandom(d.nameSuffixes)
    generatedName = `${prefix}${root}${suffix}`
  }

  const description = rollLocationDescription({
    lang,
    siteType: chosenSiteType,
    climate: chosenClimate,
    scale: chosenScale
  })

  return {
    id: 'loc_' + Math.random().toString(36).substr(2, 9),
    type: 'location',
    name: generatedName,
    siteType: chosenSiteType,
    population: chosenPop,
    climate: chosenClimate,
    scale: chosenScale,
    description: description,
    notes: `Type: ${chosenSiteType} | Scale: ${chosenScale} | Climate: ${chosenClimate} | Population: ${chosenPop}`
  }
}

export function getLocationMetadata(lang = 'en') {
  const lib = getLib(lang)
  return {
    siteTypes: lib.LOCATION_DATA.siteTypes,
    climates: lib.LOCATION_DATA.climates,
    populations: lib.LOCATION_DATA.populations,
    scales: lib.LOCATION_DATA.scales
  }
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * Generates a one-sentence madlibs story idea flavored by genre.
 * Weaves in names of already-created characters/locations when available.
 */
export function rollStoryIdea({ lang = 'en', genre = 'fantasy', characters = [], locations = [] } = {}) {
  const lib = getLib(lang)
  const d = lib.CHARACTER_DATA
  const locData = lib.LOCATION_DATA
  const flavor = lib.STORY_IDEA_DATA?.genreFlavor?.[genre] || lib.STORY_IDEA_DATA?.genreFlavor?.custom || { adjectives: ['uncanny'], settings: ['the edge of the map'] }

  const char = characters && characters.length > 0 ? pickRandom(characters) : null
  const loc = locations && locations.length > 0 ? pickRandom(locations) : null

  const makeProtag = () => {
    if (char && Math.random() < 0.55) {
      return { text: char.name, cap: char.name }
    }
    const arch = pickRandom(d.archetypes)
    const cond = Math.random() < 0.4 ? pickRandom(d.conditions) + ' ' : ''
    return { text: `${cond}${arch}`.toLowerCase(), cap: capitalize(`${cond}${arch}`.toLowerCase()) }
  }

  const makePlace = () => {
    if (loc && Math.random() < 0.55) {
      return { text: loc.name, name: loc.name }
    }
    const st = pickRandom(locData.siteTypes)
    return { text: `a ${st.toLowerCase()}`, name: `A ${st}` }
  }

  const protag = makeProtag()
  const place = makePlace()

  let idea = pickRandom(lib.STORY_TEMPLATES)
  const slots = {
    genreAdj: pickRandom(flavor.adjectives),
    setting: pickRandom(flavor.settings),
    protag: protag.text,
    protagCap: protag.cap,
    catalyst: pickRandom(d.catalysts),
    action: pickRandom(d.actions),
    stakes: pickRandom(d.stakes),
    condition: pickRandom(d.conditions),
    place: place.text,
    placeName: place.name
  }
  for (const [key, value] of Object.entries(slots)) {
    idea = idea.split(`{${key}}`).join(value)
  }
  return idea
}
