// Checks the brainstorm madlibs language packs against the English pack and
// rolls every generator to catch broken templates.
//
//   node scripts/validate_madlibs.mjs            # every pack next to en.js
//   node scripts/validate_madlibs.mjs hu pl      # only these
//
// Errors fail the run (exit code 1). Warnings point at likely grammar slips:
// a template asks for a form that some entries don't define, so they fall
// back to their dictionary form.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packDir = join(root, 'src/renderer/src/utils/madlibs')
const localeDir = join(root, 'src/renderer/src/locales')

const engine = await import(pathToFileURL(join(packDir, 'index.js')).href)
const en = await import(pathToFileURL(join(packDir, 'en.js')).href)

const ROLLS = 300
const SAMPLES = 6

const requested = process.argv.slice(2)
const langs = requested.length
  ? requested
  : readdirSync(packDir)
      .filter((f) => /^[a-z]{2}\.js$/.test(f) && f !== 'en.js')
      .map((f) => f.slice(0, 2))

const PACK_KEYS = [
  'CHARACTER_DATA',
  'CHARACTER_TEMPLATES',
  'CHARACTER_WILDCARD_TEMPLATES',
  'LOCATION_DATA',
  'LOCATION_TEMPLATES',
  'STORY_IDEA_DATA',
  'STORY_TEMPLATES',
  'GENERIC_PATTERNS',
  'SENSORY_APPEND'
]
const ID_LISTS = [
  ['CHARACTER_DATA', 'roles'],
  ['LOCATION_DATA', 'siteTypes'],
  ['LOCATION_DATA', 'climates'],
  ['LOCATION_DATA', 'scales'],
  ['LOCATION_DATA', 'populations']
]
const UI_SECTIONS = ['brainstorm', 'architect']

const TOKEN = /\{([\^~]?)([A-Za-z]+)(?::([A-Za-z_]+))?(?:@([A-Za-z]+))?\}/g
const BAD_OUTPUT = /[{}]|undefined|null|NaN|\[object|\s{2,}|\s[.,;:!?]/

// Slot name -> entries it draws from, per template family.
function slotSources(pack) {
  const c = pack.CHARACTER_DATA || {}
  const l = pack.LOCATION_DATA || {}
  const flavors = Object.values(pack.STORY_IDEA_DATA?.genreFlavor || {})
  const character = {
    archetype: c.archetypes,
    condition: c.conditions,
    catalyst: c.catalysts,
    action: c.actions,
    determiner: c.determiners,
    subject: c.subjects,
    stakes: c.stakes,
    wildcard: c.wildcards
  }
  const location = {
    terrain: l.terrains,
    relation: l.relations,
    landmark: l.landmarks,
    atmosphere: l.atmospheres,
    siteType: l.siteTypes,
    climate: (l.climates || []).map((x) => x.word ?? x.id),
    scale: (l.scales || []).map((x) => x.word ?? x.id)
  }
  const story = {
    genreAdj: flavors.flatMap((f) => f.adjectives || []),
    setting: flavors.flatMap((f) => f.settings || []),
    protag: [],
    protagCap: [],
    catalyst: c.catalysts,
    action: c.actions,
    stakes: c.stakes,
    condition: c.conditions,
    place: [],
    placeName: []
  }
  // Grammar words are extra slots available to every template family.
  const grammar = Object.fromEntries(Object.entries(pack.GRAMMAR_WORDS || {}).map(([k, v]) => [k, [v]]))
  const families = {
    CHARACTER_TEMPLATES: character,
    CHARACTER_WILDCARD_TEMPLATES: character,
    LOCATION_TEMPLATES: location,
    STORY_TEMPLATES: story,
    'GENERIC_PATTERNS.protag': { archetype: c.archetypes, condition: c.conditions },
    'GENERIC_PATTERNS.protagConditioned': { archetype: c.archetypes, condition: c.conditions },
    'GENERIC_PATTERNS.place': { siteType: l.siteTypes },
    'GENERIC_PATTERNS.placeName': { siteType: l.siteTypes },
    'SENSORY_APPEND.first': { prev: [], tag: l.sensoryTags },
    'SENSORY_APPEND.more': { prev: [], tag: l.sensoryTags }
  }
  for (const k of Object.keys(families)) families[k] = { ...grammar, ...families[k] }
  return families
}

function templatesOf(pack, family) {
  const [key, sub] = family.split('.')
  const v = sub ? pack[key]?.[sub] : pack[key]
  return Array.isArray(v) ? v : v ? [v] : []
}

const hasForm = (entry, form, genders) => {
  if (typeof entry !== 'object' || entry === null) return false
  if (typeof entry[form] === 'string') return true
  return genders.length > 0 && genders.every((g) => typeof entry[`${form}_${g}`] === 'string')
}

function arraysIn(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (Array.isArray(v)) out.push([path, v])
    else if (v && typeof v === 'object') out.push(...arraysIn(v, path))
  }
  return out
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function flatKeys(obj, prefix = '') {
  return Object.entries(obj || {}).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

let failed = false

for (const lang of langs) {
  const errors = []
  const warnings = []
  let pack
  try {
    pack = await import(pathToFileURL(join(packDir, `${lang}.js`)).href)
  } catch (e) {
    console.log(`\n=== ${lang} ===\nERROR cannot load ${lang}.js: ${e.message}`)
    failed = true
    continue
  }

  // 1. Every export the English pack has.
  for (const key of PACK_KEYS) if (!(key in pack)) errors.push(`missing export ${key}`)

  // 2. Lists at least as long as English.
  for (const key of ['CHARACTER_DATA', 'LOCATION_DATA', 'STORY_IDEA_DATA']) {
    for (const [path, list] of arraysIn(en[key], key)) {
      const mine = get(pack, path)
      if (!Array.isArray(mine)) errors.push(`missing list ${path}`)
      else if (mine.length < list.length) errors.push(`${path} has ${mine.length} entries, English has ${list.length}`)
    }
  }
  for (const key of PACK_KEYS.filter((k) => k.endsWith('TEMPLATES'))) {
    const mine = pack[key] || []
    if (mine.length < en[key].length) errors.push(`${key} has ${mine.length} templates, English has ${en[key].length}`)
  }

  // 3. Stored ids identical to English.
  for (const [key, list] of ID_LISTS) {
    const ids = (l) => (l || []).map((e) => (typeof e === 'string' ? e : e.id)).sort().join('|')
    if (ids(pack[key]?.[list]) !== ids(en[key][list])) errors.push(`${key}.${list} ids differ from English`)
  }

  // 4. Tokens resolve, and requested forms exist.
  const sources = slotSources(pack)
  for (const family of Object.keys(sources)) {
    for (const tpl of templatesOf(pack, family)) {
      for (const [, , name, form, agree] of tpl.matchAll(TOKEN)) {
        if (!(name in sources[family])) {
          errors.push(`${family}: unknown slot {${name}} in "${tpl}"`)
          continue
        }
        if (agree && !(agree in sources[family])) errors.push(`${family}: unknown agreement slot @${agree} in "${tpl}"`)
        const entries = sources[family][name] || []
        const genders = agree
          ? [...new Set((sources[family][agree] || []).map((e) => e?.g).filter(Boolean))]
          : []
        const lacking = entries.filter((e) => {
          if (form) return !hasForm(e, form, genders)
          if (agree) return genders.some((g) => typeof e !== 'object' || typeof e[g] !== 'string')
          return false
        })
        if (lacking.length && entries.length) {
          const want = form ? `:${form}` : ''
          warnings.push(
            `${family}: {${name}${want}${agree ? '@' + agree : ''}} — ${lacking.length}/${entries.length} entries lack that form` +
              ` (e.g. ${JSON.stringify(lacking[0])})`
          )
        }
      }
    }
  }

  // 5. Roll every generator.
  if (lang !== 'en' && !isRegistered(lang)) {
    errors.push(`${lang}.js is not registered in madlibs/index.js (LIBRARIES), so the app still uses English`)
  } else {
    const genres = engine.STORY_GENRES.map((g) => g.id)
    const characters = [
      { name: 'Zsófia', gender: 'female' },
      { name: 'Bartek', gender: 'male' },
      { name: 'Ash', gender: 'any' }
    ]
    const locations = [{ name: 'Kőhalom' }]
    const gens = {
      character: () => engine.rollCharacterDescription(lang),
      location: () => engine.rollLocationDescription({ lang }),
      story: () => engine.rollStoryIdea({ lang, genre: engine.pickRandom(genres) }),
      'story (with saved entities)': () =>
        engine.rollStoryIdea({ lang, genre: engine.pickRandom(genres), characters, locations }),
      'sensory tag': () =>
        engine.appendSensoryTag(
          lang,
          Math.random() < 0.5 ? '' : engine.rollLocationDescription({ lang }),
          engine.pickRandom(pack.LOCATION_DATA.sensoryTags)
        )
    }
    const samples = {}
    for (const [name, fn] of Object.entries(gens)) {
      samples[name] = new Set()
      for (let i = 0; i < ROLLS; i++) {
        const out = fn()
        if (BAD_OUTPUT.test(out)) {
          errors.push(`${name}: malformed output "${out}"`)
          break
        }
        if (samples[name].size < SAMPLES) samples[name].add(out)
      }
    }
    console.log(`\n=== ${lang} samples ===`)
    for (const [name, set] of Object.entries(samples)) {
      console.log(`  [${name}]`)
      for (const s of set) console.log(`    ${s}`)
    }
  }

  // 6. UI strings for the brainstorm and architect screens.
  const enUi = JSON.parse(readFileSync(join(localeDir, 'en/translation.json'), 'utf8'))
  let ui = null
  try {
    ui = JSON.parse(readFileSync(join(localeDir, `${lang}/translation.json`), 'utf8'))
  } catch {
    errors.push(`no locales/${lang}/translation.json`)
  }
  if (ui) {
    for (const section of UI_SECTIONS) {
      const have = new Set(flatKeys(ui[section]))
      const missing = flatKeys(enUi[section]).filter((k) => !have.has(k))
      if (missing.length) errors.push(`translation.json ${section}: missing ${missing.join(', ')}`)
    }
  }

  console.log(`\n=== ${lang} result ===`)
  for (const w of [...new Set(warnings)]) console.log(`  WARN  ${w}`)
  for (const e of [...new Set(errors)]) console.log(`  ERROR ${e}`)
  if (!errors.length) console.log(`  OK (${warnings.length} warnings)`)
  if (errors.length) failed = true
}

function isRegistered(lang) {
  const src = readFileSync(join(packDir, 'index.js'), 'utf8')
  return new RegExp(`LIBRARIES\\s*=\\s*\\{[^}]*\\b${lang}\\b`).test(src)
}

if (!langs.length) console.log('No language packs found next to en.js.')
process.exit(failed ? 1 : 0)
