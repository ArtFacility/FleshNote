// What the main process lets the renderer reach outside the app. A script running in
// the renderer has only these doors, so they stay narrow. Kept free of Electron so
// the rules can be tested on their own: node --test src/main/guards.test.mjs

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** Only web and mail links go to the system. file:, smb: and app protocols don't. */
export function isSafeExternalUrl(url) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

const IMAGE_FILE = /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico)$/i

/**
 * fleshnote-asset:// serves a project's images, which always live under its assets
 * folder (assets/, assets/cover/). Returns the file path, or null for anything else.
 */
export function assetPathFromUrl(requestUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname)
  } catch {
    return null
  }
  // Pathname is /C:/stories/x/assets/a.png or //home/me/x/assets/a.png: drop the one
  // slash the URL adds.
  const filePath = pathname.startsWith('/') ? pathname.substring(1) : pathname
  const parts = filePath.split(/[\\/]+/)
  if (filePath.includes('\0') || parts.includes('..')) return null
  if (!parts.slice(0, -1).includes('assets') || !IMAGE_FILE.test(filePath)) return null
  return filePath
}

/** Where a file dialog starts: its own absolute path, else the last folder used. */
export function dialogStartPath(defaultPath, lastFolder, { isAbsolute, join }) {
  if (defaultPath && isAbsolute(defaultPath)) return defaultPath
  if (!lastFolder) return defaultPath
  return defaultPath ? join(lastFolder, defaultPath) : lastFolder
}
