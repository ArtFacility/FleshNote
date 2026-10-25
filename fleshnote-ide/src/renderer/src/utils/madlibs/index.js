import * as en from './en.js'
import * as hu from './hu.js'
import * as pl from './pl.js'

/*
 * Madlibs engine for the Story Architect brainstorm sparks.
 *
 * Language packs (en.js, …) hold word lists and sentence templates. The
 * engine only picks entries and fills templates, so a pack for an inflected
 * language can carry its own grammatical forms:
 *
 *   Entry   — a plain string, or an object of forms:
 *             { base: 'nawiedzony', f: 'nawiedzona', g: 'm', ins: '…' }
 *             `base` is the dictionary form. `g` is the entry's own grammatical
 *             gender ('m' | 'f' | 'n' | 'pl'), used by other slots that agree
 *             with it. Any other key is a form name the pack chooses (cases,
 *             gender forms, forms with an article…).
 *   Entries that the UI stores (site types, roles, climates…) also carry a
 *   stable English `id`; the id is what gets saved, the forms are what is shown.
 *
 *   Token   — {slot} {slot:form} {slot@other} {slot:form@other}, optionally
 *             prefixed with ^ (capitalize) or ~ (lowercase).
 *             {slot:form@other} looks up, in order: `form_<g>`, `form`, `<g>`,
 *             `base`, where <g> is the gender of the entry in slot `other`.
 *             Every slot is picked once per roll, so the same word can appear
 *             in two different forms within one sentence.
 *
 *   Grammar words — a pack may export GRAMMAR_WORDS, a map of small words that
 *             change with gender or case (e.g. a relative pronoun:
 *             { who: { m: 'który', f: 'która', n: 'które' } }). They work as
 *             extra slots in every template: "{^archetype}, {who@archetype} …".
 *
 * Unknown slots are left in the output as-is so the validator can catch them.
 */

const LIBRARIES = {
  en,
  hu,
  pl
}

/** Pack lookup with a per-key fallback to English, so a partial pack never crashes. */
function getLib(lang = 'en') {
  const pack = LIBRARIES[lang]
  if (!pack || pack === en) return en
  return {
    ...en,
    ...pack,
    CHARACTER_DATA: { ...en.CHARACTER_DATA, ...pack.CHARACTER_DATA },
    LOCATION_DATA: { ...en.LOCATION_DATA, ...pack.LOCATION_DATA },
    STORY_IDEA_DATA: {
      genreFlavor: { ...en.STORY_IDEA_DATA.genreFlavor, ...pack.STORY_IDEA_DATA?.genreFlavor }
    }
  }
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

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** The dictionary form of an entry. */
export function baseOf(entry) {
  if (entry == null) return ''
  if (typeof entry === 'string') return entry
  return entry.base ?? entry.label ?? entry.id ?? ''
}

/** The stable id of an entry (plain-string entries are their own id). */
export function idOf(entry) {
  if (entry == null) return ''
  if (typeof entry === 'string') return entry
  return entry.id ?? entry.base ?? ''
}

function genderOf(entry) {
  return entry && typeof entry === 'object' ? entry.g || null : null
}

function formOf(entry, form, gender) {
  if (entry == null) return ''
  if (typeof entry === 'string') return entry
  const keys = []
  if (form && gender) keys.push(`${form}_${gender}`)
  if (form) keys.push(form)
  if (gender) keys.push(gender)
  for (const k of keys) {
    if (typeof entry[k] === 'string') return entry[k]
  }
  return baseOf(entry)
}

const TOKEN = /\{([\^~]?)([A-Za-z]+)(?::([A-Za-z_]+))?(?:@([A-Za-z]+))?\}/g

/** Fills a template from a map of slot name → entry. See the header comment for the token syntax. */
export function fillTemplate(template, slots) {
  return String(template || '').replace(TOKEN, (match, mod, name, form, agree) => {
    if (!(name in slots)) return match
    const out = formOf(slots[name], form, agree ? genderOf(slots[agree]) : null)
    if (mod === '^') return capitalize(out)
    if (mod === '~') return out.toLowerCase()
    return out
  })
}

/** Template slots plus the pack's grammar words (slots win on a name clash). */
function withGrammar(lib, slots) {
  return { ...(lib.GRAMMAR_WORDS || {}), ...slots }
}

function findById(list, id) {
  if (id == null) return null
  const wanted = String(id).toLowerCase()
  return (list || []).find((e) => String(idOf(e)).toLowerCase() === wanted) || null
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

/** Genre ids for the genre chips; labels are UI strings (architect.genres.<id>). */
export const STORY_GENRES = en.STORY_GENRES || []

/**
 * Trait pools and narrative roles for character creation.
 * Roles come back as { id, label }: save the id, show the label.
 */
export function getTraitPools(lang = 'en') {
  const lib = getLib(lang)
  const rawRoles = lib.CHARACTER_DATA?.roles || DEFAULT_ROLES
  const roles = rawRoles.map((r) =>
    typeof r === 'string' ? { id: r, label: r } : { id: r.id, label: r.label || r.id }
  )
  return {
    positive: lib.CHARACTER_DATA?.traits?.positive || [],
    negative: lib.CHARACTER_DATA?.traits?.negative || [],
    roles: roles.length > 0 ? roles : DEFAULT_ROLES.map((r) => ({ id: r, label: r }))
  }
}

function characterSlots(d) {
  return {
    archetype: pickRandom(d.archetypes),
    condition: pickRandom(d.conditions),
    catalyst: pickRandom(d.catalysts),
    action: pickRandom(d.actions),
    determiner: pickRandom(d.determiners),
    subject: pickRandom(d.subjects),
    stakes: pickRandom(d.stakes),
    wildcard: pickRandom(d.wildcards?.length ? d.wildcards : d.catalysts)
  }
}

/**
 * Generates a one-sentence Madlibs character logline.
 */
export function rollCharacterDescription(lang = 'en') {
  const lib = getLib(lang)
  const isWildcard = Math.random() < 0.08 && lib.CHARACTER_WILDCARD_TEMPLATES?.length > 0
  const template = isWildcard
    ? pickRandom(lib.CHARACTER_WILDCARD_TEMPLATES)
    : pickRandom(lib.CHARACTER_TEMPLATES)
  return fillTemplate(template, withGrammar(lib, characterSlots(lib.CHARACTER_DATA)))
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

  const chosenRole = role || idOf(pickRandom(d.roles)) || 'Protagonist'
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

function locationSlots(d, siteType, climate, scale) {
  const climateEntry = findById(d.climates, climate)
  const scaleEntry = findById(d.scales, scale)
  return {
    terrain: pickRandom(d.terrains),
    relation: pickRandom(d.relations),
    landmark: pickRandom(d.landmarks),
    atmosphere: pickRandom(d.atmospheres),
    siteType: findById(d.siteTypes, siteType) || siteType,
    // Climates and scales are UI options; `word` is how they read inside a sentence.
    climate: climateEntry?.word ?? String(climate || '').toLowerCase(),
    scale: scaleEntry?.word ?? String(scale || '').toLowerCase()
  }
}

/**
 * Generates a one-sentence Madlibs location description.
 * siteType, climate and scale are ids.
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

  const chosenSiteType = siteType || idOf(pickRandom(d.siteTypes))
  const chosenClimate = climate || idOf(pickRandom(d.climates)) || 'temperate'
  const chosenScale = scale || idOf(pickRandom(d.scales)) || 'local'

  return fillTemplate(template, withGrammar(lib, locationSlots(d, chosenSiteType, chosenClimate, chosenScale)))
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

  const chosenSiteType = siteType || idOf(pickRandom(d.siteTypes))
  const chosenClimate = climate || idOf(pickRandom(d.climates)) || 'temperate'
  const chosenScale = scale || idOf(pickRandom(d.scales)) || 'local'
  const chosenPop = population || idOf(pickRandom(d.populations)) || 'settlement'

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

/**
 * Location option lists for the forge UI. Every option is { id, label, badge? }:
 * save the id, show the label (or badge).
 */
export function getLocationMetadata(lang = 'en') {
  const d = getLib(lang).LOCATION_DATA
  const asOption = (e) =>
    typeof e === 'string'
      ? { id: e, label: e }
      : { id: idOf(e), label: e.label || baseOf(e), badge: e.badge, desc: e.desc }
  return {
    siteTypes: (d.siteTypes || []).map(asOption),
    climates: (d.climates || []).map(asOption),
    populations: (d.populations || []).map(asOption),
    scales: (d.scales || []).map(asOption),
    sensoryTags: d.sensoryTags || []
  }
}

/** Appends a sensory tag to a location description, using the pack's sentence pattern. */
export function appendSensoryTag(lang, description, tag) {
  const lib = getLib(lang)
  const prev = (description || '').trim()
  const pattern = prev ? lib.SENSORY_APPEND?.more : lib.SENSORY_APPEND?.first
  return fillTemplate(pattern || (prev ? '{prev} {^tag}.' : '{^tag}.'), withGrammar(lib, { prev, tag }))
}

/**
 * Generates a one-sentence madlibs story idea flavored by genre.
 * Weaves in names of already-created characters/locations when available.
 * Character and place names cannot be inflected, so packs must place {protag},
 * {place} and their capitalized variants only where the dictionary form fits.
 */
export function rollStoryIdea({ lang = 'en', genre = 'fantasy', characters = [], locations = [] } = {}) {
  const lib = getLib(lang)
  const d = lib.CHARACTER_DATA
  const locData = lib.LOCATION_DATA
  const flavor =
    lib.STORY_IDEA_DATA?.genreFlavor?.[genre] ||
    lib.STORY_IDEA_DATA?.genreFlavor?.custom || { adjectives: ['uncanny'], settings: ['the edge of the map'] }
  const patterns = lib.GENERIC_PATTERNS || en.GENERIC_PATTERNS

  const char = characters && characters.length > 0 ? pickRandom(characters) : null
  const loc = locations && locations.length > 0 ? pickRandom(locations) : null

  const makeProtag = () => {
    if (char && Math.random() < 0.55) {
      // A saved character's gender lets agreeing slots pick the right form.
      const g = char.gender === 'female' ? 'f' : char.gender === 'male' ? 'm' : undefined
      return { base: char.name, cap: char.name, g }
    }
    const slots = withGrammar(lib, { archetype: pickRandom(d.archetypes), condition: pickRandom(d.conditions) })
    const text = fillTemplate(
      Math.random() < 0.4 ? patterns.protagConditioned : patterns.protag,
      slots
    )
    return { base: text, cap: capitalize(text), g: genderOf(slots.archetype) || undefined }
  }

  const makePlace = () => {
    if (loc && Math.random() < 0.55) {
      return { text: loc.name, name: loc.name }
    }
    const slots = withGrammar(lib, { siteType: pickRandom(locData.siteTypes) })
    return {
      text: fillTemplate(patterns.place, slots),
      name: fillTemplate(patterns.placeName, slots)
    }
  }

  const protag = makeProtag()
  const place = makePlace()

  const slots = {
    genreAdj: pickRandom(flavor.adjectives),
    setting: pickRandom(flavor.settings),
    protag: { base: protag.base, g: protag.g },
    protagCap: { base: protag.cap, g: protag.g },
    catalyst: pickRandom(d.catalysts),
    action: pickRandom(d.actions),
    stakes: pickRandom(d.stakes),
    condition: pickRandom(d.conditions),
    place: place.text,
    placeName: place.name
  }
  return fillTemplate(pickRandom(lib.STORY_TEMPLATES), withGrammar(lib, slots))
}
