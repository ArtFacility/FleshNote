import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import killPort from 'kill-port'

let pythonProcess: ChildProcessWithoutNullStreams | null = null
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

  pythonProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`))
}

async function waitForBackend() {
  console.log('Waiting for Python backend to wake up...')
  while (true) {
    try {
      const response = await fetch(`${BACKEND_URL}/`)
      if (response.ok) {
        console.log('Backend is online.')
        break
      }
    } catch (error) {
      // ECONNREFUSED means it's not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
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

function getGlobalConfig() {
  if (fs.existsSync(globalConfigPath)) {
    return JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'))
  }
  return { workspacePath: null }
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
  await waitForBackend()
  electronApp.setAppUserModelId('com.electron')

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
    if (app.isPackaged) {
      return join(process.resourcesPath, 'Tutorial')
    }
    return join(__dirname, '../../backend/Tutorial')
  })

  ipcMain.handle('api:initProject', async (_event, payload) => {
    return await backendPost('/api/project/init', payload)
  })

  ipcMain.handle('api:loadProject', async (_event, projectPath) => {
    return await backendPost('/api/project/load', { project_path: projectPath })
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

  ipcMain.handle('api:appendEntityDescription', async (_event, payload) => {
    return await backendPost('/api/project/entity/append-description', payload)
  })

  ipcMain.handle('api:addEntityAlias', async (_event, payload) => {
    return await backendPost('/api/project/entity/add-alias', payload)
  })

  ipcMain.handle('api:searchEntities', async (_event, payload) => {
    return await backendPost('/api/project/entities/search', payload)
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
