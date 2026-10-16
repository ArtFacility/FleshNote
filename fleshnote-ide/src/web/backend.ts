/* eslint-disable @typescript-eslint/no-explicit-any -- values crossing the IPC boundary are untyped, as in the preload (window.api: unknown) */
// The browser build's way to the Python backend: the app's own folder on the Labs site
// (…/fleshnote/api/…), which passes /api/ on to the backend. Paths are resolved against the
// page, so nothing here names the folder.

export const apiUrl = (path: string): string =>
  new URL(path.replace(/^\//, ''), document.baseURI).toString()

// Set while the tab closes: the last saves go out with keepalive, so the browser finishes them
// after the page is gone (keepalive bodies are limited to 64 KB, so only small ones can).
let closing = false
export const setClosing = (on: boolean): void => {
  closing = on
}

async function call(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(apiUrl(path), init)
  let data: any = null
  try {
    data = await response.json()
  } catch {
    if (!response.ok) throw new Error(`Backend error: ${path} (${response.status})`)
  }
  if (!response.ok) {
    const detail = data?.detail
    throw new Error(
      typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : `Backend error: ${path}`
    )
  }
  return data
}

// The same contract as main's backendPost / backendGet.
export async function backendPost(path: string, body: object): Promise<any> {
  const json = JSON.stringify(body)
  return call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive: closing && json.length < 60_000
  })
}

export async function backendGet(path: string): Promise<any> {
  return call(path, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

/** Sends a file to the server (api/web/upload) and returns where it was saved. `batch` and
 * `relpath` keep a picked folder together: every file of one batch lands in one folder. */
export async function upload(file: File, batch?: string, relpath?: string): Promise<string> {
  const form = new FormData()
  form.append('file', file, file.name)
  if (batch) form.append('batch', batch)
  if (relpath) form.append('relpath', relpath)
  const res = await call('api/web/upload', { method: 'POST', body: form })
  return res.path
}

/** The URL of a file on the server, for an <img> or a download. */
export const fileUrl = (path: string, download = false): string =>
  apiUrl(`api/web/file?p=${encodeURIComponent(path)}${download ? '&download=1' : ''}`)

/** Asks the browser to download a file (or a folder, as a zip) the server wrote. */
export function download(path: string): void {
  const a = document.createElement('a')
  a.href = fileUrl(path, true)
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// A dropped file has no path in a browser, and the renderer asks for one synchronously
// (getPathForFile). It gets a stand-in at once while the file uploads; every call to the
// backend waits for those uploads and swaps in the real paths.
const pending = new Map<string, Promise<string>>()
let counter = 0

export function pendingPath(file: File): string {
  const token = `webfile:${Date.now().toString(36)}${(counter++).toString(36)}/${file.name}`
  pending.set(token, upload(file))
  return token
}

export async function resolvePaths(value: any): Promise<any> {
  if (typeof value === 'string') return pending.get(value) ?? value
  if (Array.isArray(value)) return Promise.all(value.map(resolvePaths))
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = await resolvePaths(v)
    return out
  }
  return value
}
