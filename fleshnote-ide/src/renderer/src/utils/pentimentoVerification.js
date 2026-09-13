/**
 * Sealed Pentimento — app-level opt-in helpers.
 *
 * The master switch lives in localStorage (`fn_pentimento_verification`) and is
 * mirrored into each project's `project_config` (`pentimento_verification`),
 * which is what the Python backend actually reads when sealing sessions.
 */

export const VERIFICATION_KEY = 'fn_pentimento_verification'
export const EXTERNAL_TSA_KEY = 'fn_pentimento_external_tsa'
export const TSA_URL_KEY = 'fn_pentimento_tsa_url'
export const DEFAULT_TSA_URL = 'https://api.fleshnote.org/tsa'

export function getVerificationDefault() {
  try { return localStorage.getItem(VERIFICATION_KEY) } catch { return null }
}

export function setVerificationDefault(on) {
  try { localStorage.setItem(VERIFICATION_KEY, on ? 'true' : 'false') } catch { /* noop */ }
}

export function verificationOn() {
  return getVerificationDefault() === 'true'
}

export function externalTsaOn() {
  try { return localStorage.getItem(EXTERNAL_TSA_KEY) === 'true' } catch { return false }
}

export function setExternalTsa(on) {
  try { localStorage.setItem(EXTERNAL_TSA_KEY, on ? 'true' : 'false') } catch { /* noop */ }
}

export function getTsaUrl() {
  try { return localStorage.getItem(TSA_URL_KEY) || DEFAULT_TSA_URL } catch { return DEFAULT_TSA_URL }
}

export function setTsaUrl(url) {
  try {
    const clean = (url || '').trim()
    if (clean && clean !== DEFAULT_TSA_URL) localStorage.setItem(TSA_URL_KEY, clean)
    else localStorage.removeItem(TSA_URL_KEY)
  } catch { /* noop */ }
}

// Write the current app-level choices into a project's config so the backend
// honors them when sealing sessions. Called after project creation and when the
// setting is toggled for every project in the workspace.
export async function applyToProject(projectPath) {
  if (!projectPath || !window.api?.updateProjectConfig) return
  const mode = getVerificationDefault() || 'false'
  try { await window.api.updateProjectConfig(projectPath, 'pentimento_verification', mode, 'string') } catch { /* noop */ }
  try { await window.api.updateProjectConfig(projectPath, 'pentimento_external_tsa', externalTsaOn() ? 'true' : 'false', 'string') } catch { /* noop */ }
  const url = getTsaUrl()
  try { await window.api.updateProjectConfig(projectPath, 'pentimento_tsa_url', url, 'string') } catch { /* noop */ }
}
