/* eslint-disable @typescript-eslint/no-explicit-any -- values crossing the IPC boundary are untyped, as in the preload (window.api: unknown) */
// Browser versions of the IPC handlers in src/main/index.ts that use Electron itself (dialogs,
// windows, the file system, the updater). Every other handler only passes its arguments on to
// the backend and is lifted from main as it is (lift-handlers.mjs); a channel named here
// replaces main's version. The build fails when the preload uses a channel that has neither.
//
// The browser build has one workspace on the server (api/web/info). Files go up with
// api/web/upload, and what an export writes comes back as a download.
import { mainConstants } from 'virtual:fleshnote-lifted'
import { backendPost, download, upload } from './backend'

type Filter = { name: string; extensions: string[] }
type Info = { workspace: string; uploads: string; exports: string; reviews: string; root: string }

let infoPromise: Promise<Info> | null = null
const info = (): Promise<Info> =>
  (infoPromise ??= backendPost('api/web/info', {}).catch((err) => {
    infoPromise = null
    throw err
  }))

// ── Picking files ─────────────────────────────────────────────────────────────
// A file input stands in for the open dialog; what is picked is uploaded, and the handler
// returns the server's paths, as main returns the local ones.

function pick(opts: { multiple?: boolean; folder?: boolean; filters?: Filter[] }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = !!opts.multiple
    if (opts.folder) input.webkitdirectory = true
    const exts = (opts.filters || []).flatMap((f) => f.extensions).filter((e) => e !== '*')
    if (exts.length) input.accept = exts.map((e) => '.' + e).join(',')
    input.style.display = 'none'
    let done = false
    const finish = (files: File[]): void => {
      if (done) return
      done = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish([...(input.files || [])]))
    input.addEventListener('cancel', () => finish([]))
    document.body.appendChild(input)
    input.click()
  })
}

const uploadAll = (files: File[]): Promise<string[]> => Promise.all(files.map((f) => upload(f)))

const MANUSCRIPTS: Filter[] = [{ name: 'Manuscripts', extensions: ['txt', 'md', 'docx'] }]
const REVIEWS: Filter[] = [{ name: 'FleshNote Review', extensions: ['flreview'] }]
const IMAGES: Filter[] = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }
]

/** A picked folder, uploaded file by file into one place; its path on the server. */
async function pickFolder(): Promise<string | null> {
  const files = await pick({ folder: true })
  if (!files.length) return null
  const batch = Math.random().toString(36).slice(2, 12).padEnd(6, '0')
  const paths = await Promise.all(
    files.map((f) => upload(f, batch, (f as any).webkitRelativePath || f.name))
  )
  // uploads/<batch>/<folder>/…: the folder as the server named it
  const first = paths[0].replace(/\\/g, '/')
  const cut = first.indexOf(`/${batch}/`) + batch.length + 2
  return first.slice(0, cut) + first.slice(cut).split('/')[0]
}

const safeFileName = (name: string): string =>
  (name || 'Review')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .slice(0, 120) || 'Review'

// ── The Pentimento backup ─────────────────────────────────────────────────────
// Electron keeps writing not yet confirmed by the backend in a file; here it is IndexedDB
// (up to 5 MB, more than localStorage holds, and not shared with the other Labs apps' keys).

function stashStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('fleshnote-web', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onsuccess = () => resolve(open.result.transaction('kv', mode).objectStore('kv'))
    open.onerror = () => reject(open.error)
  })
}

// ── Printing ──────────────────────────────────────────────────────────────────
// Electron prints PDFs with Chromium itself; a browser can only offer its print dialog
// (where "Save as PDF" is one of the printers). A hidden frame is not a pop-up, so it isn't
// blocked after the export's await.

function printHtml(html: string): void {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  frame.srcdoc = html
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
  }
}

const noop = (): void => undefined

export const webHandlers = {
  // ── Dialogs ─────────────────────────────────────
  'dialog:selectFolder': () => pickFolder(),
  'dialog:openFile': async (_e: unknown, filters?: Filter[]) => {
    const [file] = await pick({ filters: filters || MANUSCRIPTS })
    return file ? upload(file) : null
  },
  'dialog:openFiles': async (_e: unknown, filters?: Filter[]) =>
    uploadAll(await pick({ multiple: true, filters: filters || MANUSCRIPTS })),
  // A board file is made and read in the browser: no server round trip.
  'dialog:saveBoardFile': async (_e: unknown, payload: any) => {
    const url = URL.createObjectURL(
      new Blob([String(payload?.content ?? '')], { type: payload?.mime || 'text/plain' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = payload?.defaultName || 'board'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return { saved: true }
  },
  'dialog:openBoardFile': async (_e: unknown, filters?: Filter[]) => {
    const [file] = await pick({ filters })
    return file ? { name: file.name, content: await file.text() } : null
  },
  'dialog:openImage': async () => {
    const [file] = await pick({ filters: IMAGES })
    return file ? upload(file) : null
  },

  // ── Settings and translations ───────────────────
  'api:getGlobalConfig': async () => {
    const [stored, where] = await Promise.all([backendPost('api/web/config', {}), info()])
    return {
      ...stored,
      workspacePath: where.workspace,
      hotkeys: { ...mainConstants.DEFAULT_HOTKEYS, ...(stored.hotkeys || {}) }
    }
  },
  'api:updateGlobalConfig': async (_e: unknown, conf: Record<string, any>) => {
    // The browser build's workspace is the server's; it is never stored.
    const rest = { ...(conf || {}) }
    delete rest.workspacePath
    const [stored, where] = await Promise.all([
      backendPost('api/web/config', { update: rest }),
      info()
    ])
    return {
      ...stored,
      workspacePath: where.workspace,
      hotkeys: { ...mainConstants.DEFAULT_HOTKEYS, ...(stored.hotkeys || {}) }
    }
  },
  'api:loadTranslations': async (_e: unknown, lang: string) => {
    const load = translations[`../renderer/src/locales/${lang}/translation.json`]
    return load ? (((await load()) as any).default ?? {}) : {}
  },

  // ── Projects ────────────────────────────────────
  'api:getTutorialPath': async () => {
    const res = await backendPost('api/web/tutorial', {})
    if (res.migrate) await backendPost('/api/project/migrate', { project_path: res.path })
    return res.path
  },
  'api:deleteProject': (_e: unknown, projectPath: string) =>
    backendPost('api/web/project/delete', { project_path: projectPath }),
  'api:deleteAssetFile': (_e: unknown, payload: { project_path: string; image_path: string }) =>
    backendPost('api/web/asset/delete', payload),
  'api:coverReadImage': async (_e: unknown, payload: { project_path: string; path: string }) => {
    const res = await backendPost('api/web/cover/read', payload)
    if (!res) return null
    const bin = atob(res.data)
    const data = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i)
    return { mime: res.mime, data }
  },
  'api:takeLaunchFile': () => null,
  'api:showItemInFolder': (_e: unknown, path: string) => {
    if (path) download(path)
  },

  // ── Exports: written on the server, then downloaded ──
  'api:exportFlnote': async (_e: unknown, payload: any) => {
    try {
      const { exports } = await info()
      const dest = `${exports}/${safeFileName(payload?.defaultName || 'Project')}.flnote`
      const res = await backendPost('/api/project/export-flnote', {
        project_path: payload.project_path,
        dest_path: dest
      })
      download(res?.path || dest)
      return res
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:exportVault': async (_e: unknown, payload: any) => {
    try {
      const { path: dest } = await backendPost('api/web/export-dir', {})
      const res = await backendPost('/api/project/export-vault', {
        project_path: payload.project_path,
        dest_dir: dest,
        fmt: payload.fmt || 'obsidian'
      })
      if (res?.path) download(res.path)
      return res
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:exportProject': async (_e: unknown, payload: any) => {
    const res = await backendPost('/api/project/export', payload)
    if (res?.status === 'print') {
      printHtml(res.html)
      const rest = { ...res }
      delete rest.html
      return { ...rest, status: 'success', warnings: 'Choose "Save as PDF" in the print dialog.' }
    }
    if (res?.status === 'success' && res.filepath) download(res.filepath)
    return res
  },
  'api:exportPrintPreview': async () => {
    throw new Error(
      'The page preview needs the desktop app. Exporting works: it opens the print dialog.'
    )
  },
  'pentimento:captureShowcase': () => ({ saved: false }),

  // ── Opening and importing files ─────────────────
  'api:importFlnote': async (_e: unknown, payload: any) => {
    try {
      let zip = payload?.zip_path
      if (!zip) {
        const [file] = await pick({
          filters: [{ name: 'FleshNote Project', extensions: ['flnote'] }]
        })
        if (!file) return { status: 'cancelled' }
        zip = await upload(file)
      }
      const workspace = payload?.workspace_path || (await info()).workspace
      return await backendPost('/api/project/import-flnote', {
        zip_path: zip,
        workspace_path: workspace
      })
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },

  // ── Reviews (.flreview) ─────────────────────────
  'api:exportReviewPackage': async (_e: unknown, payload: any) => {
    try {
      const { exports } = await info()
      const dest = `${exports}/${safeFileName(payload?.defaultName)}.flreview`
      const res = await backendPost('/api/review/export', {
        project_path: payload.project_path,
        dest_path: dest,
        scope: payload.scope || {},
        reviewer_label: payload.reviewer_label || '',
        author_label: payload.author_label || '',
        message: payload.message || '',
        expires_days: payload.expires_days || 0
      })
      if (res?.status === 'ok') download(res.path || dest)
      return res
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:startReview': async (_e: unknown, payload: any) => {
    try {
      let file = payload?.path
      if (!file) {
        const [picked] = await pick({ filters: REVIEWS })
        if (!picked) return { status: 'cancelled' }
        file = await upload(picked)
      }
      return await backendPost('/api/review/start', {
        path: file,
        store_dir: (await info()).reviews
      })
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:listReviews': async () => {
    try {
      return await backendPost('/api/review/list', { store_dir: (await info()).reviews })
    } catch (err: any) {
      return { status: 'error', message: err.message, reviews: [] }
    }
  },
  'api:saveReviewPackage': async (_e: unknown, payload: any) => {
    try {
      return await backendPost('/api/review/save', {
        path: payload.path,
        package: payload.package,
        store_dir: (await info()).reviews
      })
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:finishReview': async (_e: unknown, payload: any) => {
    try {
      const where = await info()
      const dest = `${where.exports}/${safeFileName(payload?.defaultName)}.flreview`
      const res = await backendPost('/api/review/finish', {
        path: payload.path,
        dest_path: dest,
        store_dir: where.reviews
      })
      if (res?.status === 'ok') download(res.path || dest)
      return res
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:discardReview': async (_e: unknown, payload: any) => {
    try {
      return await backendPost('/api/review/discard', {
        path: payload.path,
        store_dir: (await info()).reviews
      })
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:importReviews': async (_e: unknown, payload: any) => {
    try {
      let files: string[] = payload?.paths || []
      if (!files.length) {
        files = await uploadAll(await pick({ multiple: true, filters: REVIEWS }))
        if (!files.length) return { status: 'cancelled' }
      }
      return await backendPost('/api/review/import', {
        project_path: payload.project_path,
        package_paths: files
      })
    } catch (err: any) {
      return { status: 'error', message: err.message }
    }
  },
  'api:pickReviewFiles': async () => {
    const paths = await uploadAll(await pick({ multiple: true, filters: REVIEWS }))
    return paths.length ? { status: 'ok', paths } : { status: 'cancelled' }
  },

  // ── The Pentimento backup ───────────────────────
  'pentimento:stash-read': async () => {
    try {
      const store = await stashStore('readonly')
      return await new Promise((resolve) => {
        const req = store.get('stash')
        req.onsuccess = () => resolve(req.result ? JSON.parse(req.result) : {})
        req.onerror = () => resolve({})
      })
    } catch {
      return {}
    }
  },
  'pentimento:stash-write': async (_e: unknown, json: string) => {
    if (typeof json !== 'string' || json.length > 5_000_000) return
    try {
      const store = await stashStore('readwrite')
      if (json === '{}') store.delete('stash')
      else store.put(json, 'stash')
    } catch (err) {
      console.error('Pentimento stash write failed:', err)
    }
  },

  // ── The window and the app: nothing to do in a tab ──
  'app:close-ready': noop,
  'window:minimize': noop,
  'window:maximize': noop,
  'window:close': noop,
  'api:checkForUpdates': noop,
  'api:downloadUpdate': noop,
  'api:installUpdate': noop
}

const translations = import.meta.glob('../renderer/src/locales/*/translation.json')
