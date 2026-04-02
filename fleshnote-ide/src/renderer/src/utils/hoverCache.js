// Hover cache utilities for EntityHoverCard to avoid HMR issues with dual exports

export const iconCache  = new Map()  // projectPath → { 'char:id': path, 'loc:id': path, … }
export const ageCache   = new Map()  // `${birth_date}|${world_time}|${projectPath}` → result
export const twistCache = new Map()  // `${projectPath}|${twistId}` → result
export const weatherCache = new Map() // `${projectPath}|${locationId}` → states[]

/**
 * Call this whenever entities are mutated (icon change, rename, delete, etc.)
 * so the next hover re-fetches fresh data instead of showing a stale/broken icon.
 */
export function clearEntityHoverCaches() {
  iconCache.clear()
  ageCache.clear()
  weatherCache.clear()
}
