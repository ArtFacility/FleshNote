import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import killPort from 'kill-port'

let pythonProcess: ChildProcessWithoutNullStreams | null = null
let backendStderr = ''
const globalConfigPath = join(app.getPath('userData'), 'fleshnote_config.json')
const BACKEND_URL = 'http://127.0.0.1:8000'

async function startPythonBackend() {
  try {
    // Attempt to kill any dangling process on port 8000 before starting
    await killPort(8000, 'tcp')
    console.log('Cleared port 8000 for backend startup.')
  } catch (err) {
    // kill-port throws an error if no process is running, which is fine
  }

  if (app.isPackaged) {
    // In production, the backend binary is placed inside resources/backend-dist
    const isWin = process.platform === 'win32'
    const backendExeName = isWin ? 'backend.exe' : 'backend'
    const backendExe = join(process.resourcesPath, 'backend-dist', backendExeName)
    pythonProcess = spawn(backendExe, { windowsHide: true })
  } else {
    // In development, run the python script from the virtual environment
    const isWinDev = process.platform === 'win32'
    const pythonExe = isWinDev
      ? join(__dirname, '../../backend/.venv/Scripts/python.exe')
      : join(__dirname, '../../backend/.venv/bin/python')
    const scriptPath = join(__dirname, '../../backend/main.py')
    pythonProcess = spawn(pythonExe, [scriptPath], { windowsHide: true })
  }

  pythonProcess.stdout.on('data', (data) => {
    const text = data.toString()
    console.log(`Backend: ${text}`)

    // Broadcast NLP download progress to all renderer windows
    if (text.includes('DOWNLOAD_PROGRESS:')) {
      const match = text.match(/DOWNLOAD_PROGRESS:\s*(\d+)/)
      if (match) {
        const progress = parseInt(match[1], 10)
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('language-download-progress', progress)
        })
      }
    }
  })

  pythonProcess.stderr.on('data', (data) => {
    const text = data.toString()
    backendStderr += text
    console.error(`Backend Error: ${text}`)
  })

  pythonProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      showBackendErrorWindow(
        `Backend process exited unexpectedly (code ${code})\n\n${backendStderr || 'No stderr output captured.'}`
      )
    }
  })
}

async function waitForBackend(timeoutMs = 30000) {
  console.log('Waiting for Python backend to wake up...')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BACKEND_URL}/`)
      if (response.ok) {
        console.log('Backend is online.')
        return
      }
    } catch {
      // ECONNREFUSED — not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(
    `Backend did not respond within ${timeoutMs / 1000} seconds.\n\n` +
    (backendStderr || 'No stderr output captured.')
  )
}

function showBackendErrorWindow(details: string) {
  const errWin = new BrowserWindow({
    width: 640,
    height: 460,
    title: 'FleshNote — Backend Error',
    show: false,
    autoHideMenuBar: true,
    webPreferences: { sandbox: false }
  })

  const escaped = details.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #12121f; color: #e0e0e0; padding: 24px; display: flex; flex-direction: column; height: 100vh; }
  h2 { color: #ff6b6b; font-size: 16px; margin-bottom: 8px; }
  p { color: #999; font-size: 12px; margin-bottom: 12px; line-height: 1.5; }
  textarea { flex: 1; width: 100%; background: #0a0a16; color: #d0d0e0; border: 1px solid #333; border-radius: 6px; padding: 12px; font-family: 'Consolas', monospace; font-size: 11px; resize: none; outline: none; }
  button { margin-top: 12px; padding: 8px 20px; background: #e94560; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; align-self: flex-start; transition: background 0.15s; }
  button:hover { background: #c73652; }
</style>
</head>
<body>
<h2>⚠ Backend Failed to Start</h2>
<p>FleshNote's backend process crashed or timed out. Copy the error log below and report it.</p>
<textarea readonly>${escaped}</textarea>
<button onclick="navigator.clipboard.writeText(document.querySelector('textarea').value).then(() => this.textContent = '✓ Copied!')">Copy to Clipboard</button>
</body>
</html>`

  errWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  errWin.once('ready-to-show', () => errWin.show())
}

// ── Helper: POST to backend ──────────────────────────────────────────────────

async function backendPost(path: string, body: object) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.detail || `Backend error: ${path}`)
  return data
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Global Config ────────────────────────────────────────────────────────────

const DEFAULT_HOTKEYS = {
  synonym_lookup: 'Alt+s',
  search: 'Ctrl+f'
}

function getGlobalConfig() {
  let config: any = { workspacePath: null }
  if (fs.existsSync(globalConfigPath)) {
    config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'))
  }
  // Ensure hotkeys always have defaults backfilled
  config.hotkeys = { ...DEFAULT_HOTKEYS, ...(config.hotkeys || {}) }
  return config
}

function updateGlobalConfig(newConfig) {
  const current = getGlobalConfig()
  const updated = { ...current, ...newConfig }
  fs.writeFileSync(globalConfigPath, JSON.stringify(updated, null, 2))
  return updated
}

// ── App Ready ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startPythonBackend()
  try {
    await waitForBackend()
  } catch (err: any) {
    showBackendErrorWindow(err.message)
    return
  }
  electronApp.setAppUserModelId('com.artfacility.fleshnote')

  // ── Global Config ──────────────────────────────────
  ipcMain.handle('api:getGlobalConfig', () => getGlobalConfig())
  ipcMain.handle('api:updateGlobalConfig', (_event, conf) => updateGlobalConfig(conf))

  // ── Translations ───────────────────────────────────
  ipcMain.handle('api:loadTranslations', async (_event, lang) => {
    try {
      let localePath = join(__dirname, '../../src/renderer/src/locales', `${lang}`, 'translation.json')
      if (app.isPackaged) {
        localePath = join(process.resourcesPath, 'locales', `${lang}`, 'translation.json')
      }
      if (fs.existsSync(localePath)) {
        return JSON.parse(fs.readFileSync(localePath, 'utf-8'))
      }
      console.warn(`Translation file not found at: ${localePath}`)
      return {}
    } catch (e) {
      console.error('Failed to load translations:', e)
      return {}
    }
  })

  // ── Dialogs ────────────────────────────────────────
  ipcMain.handle('dialog:selectFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select FleshNote Workspace'
    })
    if (canceled) return null
    return filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async (_event, filters) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select File to Import',
      filters: filters || [
        { name: 'Manuscripts', extensions: ['txt', 'md', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (canceled) return null
    return filePaths[0]
  })

  // ── Window Controls ────────────────────────────────
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // ── Project Management (existing) ──────────────────
  ipcMain.handle('api:getProjects', async (_event, workspacePath) => {
    try {
      return await backendPost('/api/projects', { workspace_path: workspacePath })
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      return { projects: [] }
    }
  })

  ipcMain.handle('api:getTutorialPath', async () => {
    let sourcePath = join(__dirname, '../../backend/Tutorial')
    if (app.isPackaged) {
      sourcePath = join(process.resourcesPath, 'Tutorial')
    }
    const userDataTutorial = join(app.getPath('userData'), 'Tutorial')
    // Always ensure the tutorial exists in the user's writable data directory.
    if (!fs.existsSync(userDataTutorial)) {
      try {
        fs.cpSync(sourcePath, userDataTutorial, { recursive: true })
      } catch (err) {
        console.error('Failed to copy tutorial to userData:', err)
        return sourcePath // fallback to read-only, though it might fail
      }
    }
    return userDataTutorial
  })

  ipcMain.handle('api:initProject', async (_event, payload) => {
    return await backendPost('/api/project/init', payload)
  })

  ipcMain.handle('api:loadProject', async (_event, projectPath) => {
    return await backendPost('/api/project/load', { project_path: projectPath })
  })

  ipcMain.handle('api:getStats', async (_event, projectPath) => {
    return await backendPost('/api/project/stats', { project_path: projectPath })
  })

  ipcMain.handle('api:getAchievements', async (_event, projectPath) => {
    return await backendPost('/api/project/achievements', { project_path: projectPath })
  })

  ipcMain.handle('api:updateStat', async (_event, payload) => {
    return await backendPost('/api/project/stats/update', payload)
  })

  ipcMain.handle('api:getProjectConfig', async (_event, projectPath) => {
    return await backendPost('/api/project/config', { project_path: projectPath })
  })

  ipcMain.handle('api:updateProjectConfig', async (_event, payload) => {
    return await backendPost('/api/project/config/update', payload)
  })

  ipcMain.handle('api:deleteProject', async (_event, projectPath) => {
    try {
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true })
        return { status: 'ok' }
      }
      return { status: 'error', msg: 'Project not found on disk' }
    } catch (err: any) {
      console.error('Failed to delete project folder:', err)
      return { status: 'error', msg: err.message }
    }
  })

  ipcMain.handle('api:exportProject', async (_event, payload) => {
    return await backendPost('/api/project/export', payload)
  })

  ipcMain.handle('api:exportPreview', async (_event, payload) => {
    return await backendPost('/api/project/export/preview', payload)
  })

  ipcMain.handle('api:showItemInFolder', (_event, filepath: string) => {
    shell.showItemInFolder(filepath)
  })

  // ── Chapters ───────────────────────────────────────
  ipcMain.handle('api:getChapters', async (_event, projectPath) => {
    return await backendPost('/api/project/chapters', { project_path: projectPath })
  })

  ipcMain.handle('api:createChapter', async (_event, payload) => {
    return await backendPost('/api/project/chapter/create', payload)
  })

  ipcMain.handle('api:bulkCreateChapters', async (_event, payload) => {
    return await backendPost('/api/project/chapters/bulk-create', payload)
  })

  ipcMain.handle('api:loadChapterContent', async (_event, payload) => {
    return await backendPost('/api/project/chapter/load', payload)
  })

  ipcMain.handle('api:saveChapterContent', async (_event, payload) => {
    return await backendPost('/api/project/chapter/save', payload)
  })

  ipcMain.handle('api:updateChapter', async (_event, payload) => {
    return await backendPost('/api/project/chapter/update', payload)
  })

  ipcMain.handle('api:deleteChapter', async (_event, payload) => {
    return await backendPost('/api/project/chapter/delete', payload)
  })

  ipcMain.handle('api:insertChapter', async (_event, payload) => {
    return await backendPost('/api/project/chapter/insert', payload)
  })

  // ── Characters ─────────────────────────────────────
  ipcMain.handle('api:getCharacters', async (_event, projectPath) => {
    return await backendPost('/api/project/characters', { project_path: projectPath })
  })

  ipcMain.handle('api:createCharacter', async (_event, payload) => {
    return await backendPost('/api/project/character/create', payload)
  })

  ipcMain.handle('api:bulkCreateCharacters', async (_event, payload) => {
    return await backendPost('/api/project/characters/bulk-create', payload)
  })

  ipcMain.handle('api:updateCharacter', async (_event, payload) => {
    return await backendPost('/api/project/character/update', payload)
  })

  ipcMain.handle('api:deleteCharacter', async (_event, payload) => {
    return await backendPost('/api/project/character/delete', payload)
  })

  // ── Locations ──────────────────────────────────────
  ipcMain.handle('api:getLocations', async (_event, projectPath) => {
    return await backendPost('/api/project/locations', { project_path: projectPath })
  })

  ipcMain.handle('api:createLocation', async (_event, payload) => {
    return await backendPost('/api/project/location/create', payload)
  })

  ipcMain.handle('api:updateLocation', async (_event, payload) => {
    return await backendPost('/api/project/location/update', payload)
  })

  ipcMain.handle('api:deleteLocation', async (_event, payload) => {
    return await backendPost('/api/project/location/delete', payload)
  })

  // ── Groups ─────────────────────────────────────────
  ipcMain.handle('api:getGroups', async (_event, projectPath) => {
    return await backendPost('/api/project/groups', { project_path: projectPath })
  })

  ipcMain.handle('api:createGroup', async (_event, payload) => {
    return await backendPost('/api/project/group/create', payload)
  })

  ipcMain.handle('api:updateGroup', async (_event, payload) => {
    return await backendPost('/api/project/group/update', payload)
  })

  ipcMain.handle('api:deleteGroup', async (_event, payload) => {
    return await backendPost('/api/project/group/delete', payload)
  })

  // ── Entities ───────────────────────────────────────
  ipcMain.handle('api:getEntities', async (_event, projectPath) => {
    return await backendPost('/api/project/entities', { project_path: projectPath })
  })

  ipcMain.handle('api:createLoreEntity', async (_event, payload) => {
    return await backendPost('/api/project/lore-entity/create', payload)
  })

  ipcMain.handle('api:updateLoreEntity', async (_event, payload) => {
    return await backendPost('/api/project/lore-entity/update', payload)
  })

  ipcMain.handle('api:deleteLoreEntity', async (_event, payload) => {
    return await backendPost('/api/project/lore-entity/delete', payload)
  })

  ipcMain.handle('api:appendEntityDescription', async (_event, payload) => {
    return await backendPost('/api/project/entity/append-description', payload)
  })

  ipcMain.handle('api:addEntityAlias', async (_event, payload) => {
    return await backendPost('/api/project/entity/add-alias', payload)
  })

  ipcMain.handle('api:searchEntities', async (_event, payload) => {
    return await backendPost('/api/project/entities/search', payload)
  })

  // ── Entity Manager ────────────────────────────────────
  ipcMain.handle('api:bulkDeleteEntities', async (_event, payload) => {
    return await backendPost('/api/project/entities/bulk-delete', payload)
  })

  ipcMain.handle('api:mergeEntities', async (_event, payload) => {
    return await backendPost('/api/project/entities/merge', payload)
  })

  // ── Quick Notes ────────────────────────────────────
  ipcMain.handle('api:getQuickNotes', async (_event, projectPath) => {
    return await backendPost('/api/project/quick-notes', { project_path: projectPath })
  })

  ipcMain.handle('api:createQuickNote', async (_event, payload) => {
    return await backendPost('/api/project/quick-note/create', payload)
  })

  ipcMain.handle('api:deleteQuickNote', async (_event, payload) => {
    return await backendPost('/api/project/quick-note/delete', payload)
  })

  // ── Annotations ────────────────────────────────────
  ipcMain.handle('api:getAnnotations', async (_event, projectPath) => {
    return await backendPost('/api/project/annotations', { project_path: projectPath })
  })

  ipcMain.handle('api:createAnnotation', async (_event, payload) => {
    return await backendPost('/api/project/annotation/create', payload)
  })

  ipcMain.handle('api:updateAnnotation', async (_event, payload) => {
    return await backendPost('/api/project/annotation/update', payload)
  })

  ipcMain.handle('api:deleteAnnotation', async (_event, payload) => {
    return await backendPost('/api/project/annotation/delete', payload)
  })

  // ── Knowledge States ─────────────────────────────────
  ipcMain.handle('api:createKnowledge', async (_event, payload) => {
    return await backendPost('/api/project/knowledge/create', payload)
  })

  ipcMain.handle('api:updateKnowledge', async (_event, payload) => {
    return await backendPost('/api/project/knowledge/update', payload)
  })

  ipcMain.handle('api:deleteKnowledge', async (_event, payload) => {
    return await backendPost('/api/project/knowledge/delete', payload)
  })

  ipcMain.handle('api:getKnowledgeForEntity', async (_event, payload) => {
    return await backendPost('/api/project/knowledge/for-entity', payload)
  })

  ipcMain.handle('api:getKnowledgeForCharacter', async (_event, payload) => {
    return await backendPost('/api/project/knowledge/for-character', payload)
  })

  // ── Relationships ────────────────────────────────────
  ipcMain.handle('api:createRelationship', async (_event, payload) => {
    return await backendPost('/api/project/relationship/create', payload)
  })

  ipcMain.handle('api:updateRelationship', async (_event, payload) => {
    return await backendPost('/api/project/relationship/update', payload)
  })

  ipcMain.handle('api:deleteRelationship', async (_event, payload) => {
    return await backendPost('/api/project/relationship/delete', payload)
  })

  ipcMain.handle('api:getRelationshipsForCharacter', async (_event, payload) => {
    return await backendPost('/api/project/relationships/for-character', payload)
  })

  // ── Secrets ─────────────────────────────────────────
  ipcMain.handle('api:getSecrets', async (_event, projectPath) => {
    return await backendPost('/api/project/secrets', { project_path: projectPath })
  })

  ipcMain.handle('api:createSecret', async (_event, payload) => {
    return await backendPost('/api/project/secret/create', payload)
  })

  ipcMain.handle('api:updateSecret', async (_event, payload) => {
    return await backendPost('/api/project/secret/update', payload)
  })

  // ── Twists ──────────────────────────────────────────
  ipcMain.handle('api:getTwists', async (_event, projectPath) => {
    return await backendPost('/api/project/twists', { project_path: projectPath })
  })

  ipcMain.handle('api:getTwistsForPlanner', async (_event, projectPath) => {
    return await backendPost('/api/project/twists/planner', { project_path: projectPath })
  })

  ipcMain.handle('api:createTwist', async (_event, payload) => {
    return await backendPost('/api/project/twist/create', payload)
  })

  ipcMain.handle('api:updateTwist', async (_event, payload) => {
    return await backendPost('/api/project/twist/update', payload)
  })

  ipcMain.handle('api:getTwistDetail', async (_event, payload) => {
    return await backendPost('/api/project/twist/detail', payload)
  })

  ipcMain.handle('api:deleteTwist', async (_event, payload) => {
    return await backendPost('/api/project/twist/delete', payload)
  })

  // ── Calendar ───────────────────────────────────────
  ipcMain.handle('api:getCalendarConfig', async (_event, projectPath) => {
    return await backendPost('/api/project/calendar/config', { project_path: projectPath })
  })

  ipcMain.handle('api:updateCalendarConfig', async (_event, payload) => {
    return await backendPost('/api/project/calendar/update', payload)
  })

  ipcMain.handle('api:calculateAge', async (_event, payload) => {
    return await backendPost('/api/project/calendar/calculate-age', payload)
  })

  // ── History Timeline ─────────────────────────────────
  ipcMain.handle('api:getHistoryEntries', async (_event, payload) => {
    return await backendPost('/api/project/history/list', payload)
  })

  ipcMain.handle('api:createHistoryEntry', async (_event, payload) => {
    return await backendPost('/api/project/history/create', payload)
  })

  ipcMain.handle('api:updateHistoryEntry', async (_event, payload) => {
    return await backendPost('/api/project/history/update', payload)
  })

  ipcMain.handle('api:deleteHistoryEntry', async (_event, payload) => {
    return await backendPost('/api/project/history/delete', payload)
  })

  // ── World Times ────────────────────────────────────
  ipcMain.handle('api:getWorldTimes', async (_e, p) => backendPost('/api/project/world-times/list', p))
  ipcMain.handle('api:createWorldTime', async (_e, p) => backendPost('/api/project/world-times/create', p))
  ipcMain.handle('api:updateWorldTime', async (_e, p) => backendPost('/api/project/world-times/update', p))
  ipcMain.handle('api:deleteWorldTime', async (_e, p) => backendPost('/api/project/world-times/delete', p))

  // ── Sketchboards ───────────────────────────────────
  ipcMain.handle('api:listBoards', async (_e, p) => backendPost('/api/project/boards/list', p))
  ipcMain.handle('api:createBoard', async (_e, p) => backendPost('/api/project/boards/create', p))
  ipcMain.handle('api:updateBoard', async (_e, p) => backendPost('/api/project/boards/update', p))
  ipcMain.handle('api:deleteBoard', async (_e, p) => backendPost('/api/project/boards/delete', p))
  ipcMain.handle('api:loadBoard', async (_e, p) => backendPost('/api/project/boards/load', p))
  ipcMain.handle('api:createBoardItem', async (_e, p) => backendPost('/api/project/boards/items/create', p))
  ipcMain.handle('api:updateBoardItem', async (_e, p) => backendPost('/api/project/boards/items/update', p))
  ipcMain.handle('api:deleteBoardItem', async (_e, p) => backendPost('/api/project/boards/items/delete', p))
  ipcMain.handle('api:createBoardConnection', async (_e, p) => backendPost('/api/project/boards/connections/create', p))
  ipcMain.handle('api:updateBoardConnection', async (_e, p) => backendPost('/api/project/boards/connections/update', p))
  ipcMain.handle('api:deleteBoardConnection', async (_e, p) => backendPost('/api/project/boards/connections/delete', p))

  // ── Planner ────────────────────────────────────────
  ipcMain.handle('api:loadPlanner', async (_event, projectPath) => {
    return await backendPost('/api/project/planner/load', { project_path: projectPath })
  })

  ipcMain.handle('api:updatePlannerSettings', async (_event, payload) => {
    return await backendPost('/api/project/planner/settings', payload)
  })

  ipcMain.handle('api:savePlannerBlock', async (_event, payload) => {
    return await backendPost('/api/project/planner/save-block', payload)
  })

  ipcMain.handle('api:savePlannerArc', async (_event, payload) => {
    return await backendPost('/api/project/planner/save-arc', payload)
  })

  ipcMain.handle('api:deletePlannerBlock', async (_event, payload) => {
    return await backendPost('/api/project/planner/delete-block', payload)
  })

  ipcMain.handle('api:deletePlannerArc', async (_event, payload) => {
    return await backendPost('/api/project/planner/delete-arc', payload)
  })

  // ── Import ─────────────────────────────────────────
  ipcMain.handle('api:importSplitPreview', async (_event, payload) => {
    return await backendPost('/api/project/import/split-preview', payload)
  })

  ipcMain.handle('api:importConfirmSplits', async (_event, payload) => {
    return await backendPost('/api/project/import/confirm-splits', payload)
  })

  ipcMain.handle('api:importNerExtract', async (_event, payload) => {
    // payload can be { text } or { text, language }
    return await backendPost('/api/project/import/ner-extract', payload)
  })

  ipcMain.handle('api:importNerAnalyze', async (_event, payload) => {
    return await backendPost('/api/project/import/ner-analyze', payload)
  })

  ipcMain.handle('api:importBulkCreateEntities', async (_event, payload) => {
    return await backendPost('/api/project/import/bulk-create-entities', payload)
  })

  // ── NLP Configuration ──────────────────────────────
  ipcMain.handle('api:checkNlpModel', async (_event, langCode) => {
    return await backendPost('/api/settings/check-model', { lang_code: langCode })
  })

  ipcMain.handle('api:loadNlpModel', async (_event, language) => {
    return await backendPost('/api/nlp/load', { language })
  })

  // ── Synonyms ────────────────────────────────────────
  ipcMain.handle('api:synonymLookup', async (_event, payload) => {
    return await backendPost('/api/synonyms/lookup', payload)
  })

  ipcMain.handle('api:checkWordnetData', async () => {
    return await backendPost('/api/synonyms/check-data', {})
  })

  ipcMain.handle('api:ensureWordnetData', async () => {
    return await backendPost('/api/synonyms/ensure-data', {})
  })

  // ── Spell Check ────────────────────────────────────
  ipcMain.handle('api:spellCheck', async (_event, payload) => {
    return await backendPost('/api/project/spellcheck', payload)
  })

  ipcMain.handle('api:spellCheckIgnore', async (_event, payload) => {
    return await backendPost('/api/project/spellcheck/ignore', payload)
  })

  // ── Dev Tools ──────────────────────────────────────
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) {
      pythonProcess.kill('SIGKILL')
      pythonProcess = null
    }
    app.quit()
  }
})

app.on('will-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill('SIGKILL')
    pythonProcess = null
  }
})
