import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // ── Workspace & Project ────────────────────────────
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getTutorialPath: () => ipcRenderer.invoke('api:getTutorialPath'),
  getProjects: (workspacePath) => ipcRenderer.invoke('api:getProjects', workspacePath),
  initProject: (payload) => ipcRenderer.invoke('api:initProject', payload),
  getGlobalConfig: () => ipcRenderer.invoke('api:getGlobalConfig'),
  updateGlobalConfig: (conf) => ipcRenderer.invoke('api:updateGlobalConfig', conf),
  getProjectConfig: (projectPath) => ipcRenderer.invoke('api:getProjectConfig', projectPath),
  updateProjectConfig: (projectPath, key, value, type) =>
    ipcRenderer.invoke('api:updateProjectConfig', { project_path: projectPath, config_key: key, config_value: value, config_type: type }),
  loadProject: (projectPath) => ipcRenderer.invoke('api:loadProject', projectPath),
  deleteProject: (projectPath) => ipcRenderer.invoke('api:deleteProject', projectPath),
  loadTranslations: (lang) => ipcRenderer.invoke('api:loadTranslations', lang),
  exportProject: (payload) => ipcRenderer.invoke('api:exportProject', payload),
  exportPreview: (payload) => ipcRenderer.invoke('api:exportPreview', payload),

  // ── Chapters ───────────────────────────────────────
  getChapters: (projectPath) => ipcRenderer.invoke('api:getChapters', projectPath),
  createChapter: (payload) => ipcRenderer.invoke('api:createChapter', payload),
  bulkCreateChapters: (payload) => ipcRenderer.invoke('api:bulkCreateChapters', payload),
  loadChapterContent: (projectPath, chapterId) =>
    ipcRenderer.invoke('api:loadChapterContent', {
      project_path: projectPath,
      chapter_id: chapterId
    }),
  saveChapterContent: (payload) => ipcRenderer.invoke('api:saveChapterContent', payload),
  updateChapter: (payload) => ipcRenderer.invoke('api:updateChapter', payload),
  deleteChapter: (payload) => ipcRenderer.invoke('api:deleteChapter', payload),
  insertChapter: (payload) => ipcRenderer.invoke('api:insertChapter', payload),

  // ── Characters ─────────────────────────────────────
  getCharacters: (projectPath) => ipcRenderer.invoke('api:getCharacters', projectPath),
  createCharacter: (payload) => ipcRenderer.invoke('api:createCharacter', payload),
  bulkCreateCharacters: (payload) => ipcRenderer.invoke('api:bulkCreateCharacters', payload),
  updateCharacter: (payload) => ipcRenderer.invoke('api:updateCharacter', payload),

  // ── Locations ──────────────────────────────────────
  getLocations: (projectPath) => ipcRenderer.invoke('api:getLocations', projectPath),
  createLocation: (payload) => ipcRenderer.invoke('api:createLocation', payload),
  updateLocation: (payload) => ipcRenderer.invoke('api:updateLocation', payload),

  // ── Groups ─────────────────────────────────────────
  getGroups: (projectPath) => ipcRenderer.invoke('api:getGroups', projectPath),
  createGroup: (payload) => ipcRenderer.invoke('api:createGroup', payload),
  updateGroup: (payload) => ipcRenderer.invoke('api:updateGroup', payload),

  // ── Entities (for linkification) ───────────────────
  getEntities: (projectPath) => ipcRenderer.invoke('api:getEntities', projectPath),
  createLoreEntity: (payload) => ipcRenderer.invoke('api:createLoreEntity', payload),
  updateLoreEntity: (payload) => ipcRenderer.invoke('api:updateLoreEntity', payload),
  appendEntityDescription: (payload) => ipcRenderer.invoke('api:appendEntityDescription', payload),
  addEntityAlias: (payload) => ipcRenderer.invoke('api:addEntityAlias', payload),
  searchEntities: (payload) => ipcRenderer.invoke('api:searchEntities', payload),

  // ── Quick Notes ────────────────────────────────────
  getQuickNotes: (projectPath) => ipcRenderer.invoke('api:getQuickNotes', projectPath),
  createQuickNote: (payload) => ipcRenderer.invoke('api:createQuickNote', payload),
  deleteQuickNote: (payload) => ipcRenderer.invoke('api:deleteQuickNote', payload),

  // ── Knowledge States ──────────────────────────────
  createKnowledge: (payload) => ipcRenderer.invoke('api:createKnowledge', payload),
  updateKnowledge: (payload) => ipcRenderer.invoke('api:updateKnowledge', payload),
  deleteKnowledge: (payload) => ipcRenderer.invoke('api:deleteKnowledge', payload),
  getKnowledgeForEntity: (payload) => ipcRenderer.invoke('api:getKnowledgeForEntity', payload),
  getKnowledgeForCharacter: (payload) =>
    ipcRenderer.invoke('api:getKnowledgeForCharacter', payload),

  // ── Secrets ──────────────────────────────────────
  getSecrets: (projectPath) => ipcRenderer.invoke('api:getSecrets', projectPath),
  createSecret: (payload) => ipcRenderer.invoke('api:createSecret', payload),
  updateSecret: (payload) => ipcRenderer.invoke('api:updateSecret', payload),

  // ── Calendar ─────────────────────────────────────────
  getCalendarConfig: (projectPath) => ipcRenderer.invoke('api:getCalendarConfig', projectPath),
  updateCalendarConfig: (payload) => ipcRenderer.invoke('api:updateCalendarConfig', payload),
  calculateAge: (payload) => ipcRenderer.invoke('api:calculateAge', payload),

  // ── Import ─────────────────────────────────────────
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  importSplitPreview: (payload) => ipcRenderer.invoke('api:importSplitPreview', payload),
  importConfirmSplits: (payload) => ipcRenderer.invoke('api:importConfirmSplits', payload),
  importNerExtract: (payload) => ipcRenderer.invoke('api:importNerExtract', payload),

  // ── NLP Configuration ──────────────────────────────
  checkNlpModel: (langCode) => ipcRenderer.invoke('api:checkNlpModel', langCode),
  loadNlpModel: (language) => ipcRenderer.invoke('api:loadNlpModel', language),
  onDownloadProgress: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('language-download-progress', listener)
    return () => ipcRenderer.removeListener('language-download-progress', listener)
  },

  // ── Window Controls ────────────────────────────────
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
