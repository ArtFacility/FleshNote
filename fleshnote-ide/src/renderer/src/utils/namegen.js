import { generateCharacterSpark, generateLocationSpark } from './madlibs'

export async function generateCharacterName({
  mode = 'real',
  origin = 'english',
  preset = 'elvish',
  gender = 'any',
  lang = 'en'
} = {}) {
  if (window.api?.generateName) {
    try {
      const cfg = { mode }
      if (mode === 'real') {
        cfg.real_origin = origin
        cfg.real_gender = gender
      } else if (mode === 'preset') {
        cfg.preset_name = preset
      } else {
        cfg.no_hard_consonants = false
        cfg.max_consecutive_consonants = 2
        cfg.max_length = 11
      }
      const res = await window.api.generateName({
        project_path: '',
        count: 1,
        config: cfg
      })
      if (res && res.names && res.names.length > 0 && res.names[0]) {
        return res.names[0]
      }
    } catch (err) {
      console.warn('Backend name generator error, falling back:', err)
    }
  }
  return generateCharacterSpark({ lang }).name
}

export async function generateLocationCandidates({
  genre = 'fantasy',
  geography = '',
  founder = '',
  history = '',
  nativeTongue = '',
  mythos = '',
  importance = 'medium',
  vowelHarmony = false,
  drift = 25,
  siteType = 'citadel',
  lang = 'en',
  count = 6
} = {}) {
  if (window.api?.generateLocationName) {
    try {
      const res = await window.api.generateLocationName({
        project_path: '',
        count,
        config: {
          genre,
          geography,
          founder,
          history,
          native_tongue: nativeTongue,
          mythos,
          importance,
          vowel_harmony: vowelHarmony,
          drift: Number(drift),
          site_type: String(siteType).toLowerCase(),
          language: lang || 'en'
        }
      })
      if (res && res.names && res.names.length > 0) {
        return res.names
      }
    } catch (err) {
      console.warn('Backend location generator error, falling back:', err)
    }
  }
  return [generateLocationSpark({ lang }).name]
}
