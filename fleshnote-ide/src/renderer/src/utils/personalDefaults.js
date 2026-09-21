let cached = null

async function load() {
  if (cached) return cached
  try {
    cached = await window.api.getGlobalConfig()
  } catch {
    cached = {}
  }
  return cached
}

export async function getPersonalDefaults() {
  const cfg = await load()
  return {
    author_name: cfg.author_name || '',
    reviewer_name: cfg.reviewer_name || '',
    story_language: cfg.story_language || '',
  }
}

export async function setPersonalDefaults(patch) {
  cached = { ...(cached || {}), ...patch }
  try {
    await window.api.updateGlobalConfig(patch)
  } catch (err) {
    console.error('Failed to save personal defaults', err)
  }
}
