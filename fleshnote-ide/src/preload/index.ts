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
  getStats: (projectPath) => ipcRenderer.invoke('api:getStats', projectPath),
  getAchievements: (projectPath) => ipcRenderer.invoke('api:getAchievements', projectPath),
  updateStat: (payload) => ipcRenderer.invoke('api:updateStat', payload),
  deleteProject: (projectPath) => ipcRenderer.invoke('api:deleteProject', projectPath),
  loadTranslations: (lang) => ipcRenderer.invoke('api:loadTranslations', lang),
  exportProject: (payload) => ipcRenderer.invoke('api:exportProject', payload),
  exportPreview: (payload) => ipcRenderer.invoke('api:exportPreview', payload),
  showItemInFolder: (filepath) => ipcRenderer.invoke('api:showItemInFolder', filepath),

  // ── Chapters ───────────────────────────────────────
  getChapters: (projectPath) => ipcRenderer.invoke('api:getChapters', projectPath),
  getTodos: (projectPath) => ipcRenderer.invoke('api:getTodos', projectPath),
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
  deleteCharacter: (payload) => ipcRenderer.invoke('api:deleteCharacter', payload),

  // ── Locations ──────────────────────────────────────
  getLocations: (projectPath) => ipcRenderer.invoke('api:getLocations', projectPath),
  createLocation: (payload) => ipcRenderer.invoke('api:createLocation', payload),
  updateLocation: (payload) => ipcRenderer.invoke('api:updateLocation', payload),
  deleteLocation: (payload) => ipcRenderer.invoke('api:deleteLocation', payload),

  // ── Groups ─────────────────────────────────────────
  getGroups: (projectPath) => ipcRenderer.invoke('api:getGroups', projectPath),
  createGroup: (payload) => ipcRenderer.invoke('api:createGroup', payload),
  updateGroup: (payload) => ipcRenderer.invoke('api:updateGroup', payload),
  deleteGroup: (payload) => ipcRenderer.invoke('api:deleteGroup', payload),

  // ── Entities (for linkification) ───────────────────
  getEntities: (projectPath) => ipcRenderer.invoke('api:getEntities', projectPath),
  createLoreEntity: (payload) => ipcRenderer.invoke('api:createLoreEntity', payload),
  updateLoreEntity: (payload) => ipcRenderer.invoke('api:updateLoreEntity', payload),
  deleteLoreEntity: (payload) => ipcRenderer.invoke('api:deleteLoreEntity', payload),
  appendEntityDescription: (payload) => ipcRenderer.invoke('api:appendEntityDescription', payload),
  addEntityAlias: (payload) => ipcRenderer.invoke('api:addEntityAlias', payload),
  searchEntities: (payload) => ipcRenderer.invoke('api:searchEntities', payload),
  scanEntityReferences: (payload) => ipcRenderer.invoke('api:scanEntityReferences', payload),
  replaceEntityReferences: (payload) => ipcRenderer.invoke('api:replaceEntityReferences', payload),

  // ── Entity Manager ────────────────────────────────
  bulkDeleteEntities: (payload) => ipcRenderer.invoke('api:bulkDeleteEntities', payload),
  mergeEntities: (payload) => ipcRenderer.invoke('api:mergeEntities', payload),

  // ── Quick Notes ────────────────────────────────────
  getQuickNotes: (projectPath) => ipcRenderer.invoke('api:getQuickNotes', projectPath),
  createQuickNote: (payload) => ipcRenderer.invoke('api:createQuickNote', payload),
  updateQuickNote: (payload) => ipcRenderer.invoke('api:updateQuickNote', payload),
  deleteQuickNote: (payload) => ipcRenderer.invoke('api:deleteQuickNote', payload),

  // ── Annotations ────────────────────────────────────
  getAnnotations: (projectPath) => ipcRenderer.invoke('api:getAnnotations', projectPath),
  createAnnotation: (payload) => ipcRenderer.invoke('api:createAnnotation', payload),
  updateAnnotation: (payload) => ipcRenderer.invoke('api:updateAnnotation', payload),
  deleteAnnotation: (payload) => ipcRenderer.invoke('api:deleteAnnotation', payload),

  // ── Knowledge States ──────────────────────────────
  createKnowledge: (payload) => ipcRenderer.invoke('api:createKnowledge', payload),
  updateKnowledge: (payload) => ipcRenderer.invoke('api:updateKnowledge', payload),
  deleteKnowledge: (payload) => ipcRenderer.invoke('api:deleteKnowledge', payload),
  getKnowledgeForEntity: (payload) => ipcRenderer.invoke('api:getKnowledgeForEntity', payload),
  getKnowledgeForCharacter: (payload) =>
    ipcRenderer.invoke('api:getKnowledgeForCharacter', payload),

  // ── Relationships ──────────────────────────────────
  createRelationship: (payload) => ipcRenderer.invoke('api:createRelationship', payload),
  updateRelationship: (payload) => ipcRenderer.invoke('api:updateRelationship', payload),
  deleteRelationship: (payload) => ipcRenderer.invoke('api:deleteRelationship', payload),
  getRelationshipsForCharacter: (payload) => ipcRenderer.invoke('api:getRelationshipsForCharacter', payload),

  // ── Secrets ──────────────────────────────────────
  getSecrets: (projectPath) => ipcRenderer.invoke('api:getSecrets', projectPath),
  createSecret: (payload) => ipcRenderer.invoke('api:createSecret', payload),
  updateSecret: (payload) => ipcRenderer.invoke('api:updateSecret', payload),

  // ── Twists ──────────────────────────────────────
  getTwists: (projectPath) => ipcRenderer.invoke('api:getTwists', projectPath),
  getTwistsForPlanner: (projectPath) => ipcRenderer.invoke('api:getTwistsForPlanner', projectPath),
  createTwist: (payload) => ipcRenderer.invoke('api:createTwist', payload),
  updateTwist: (payload) => ipcRenderer.invoke('api:updateTwist', payload),
  getTwistDetail: (payload) => ipcRenderer.invoke('api:getTwistDetail', payload),
  deleteTwist: (payload) => ipcRenderer.invoke('api:deleteTwist', payload),

  // ── Calendar ─────────────────────────────────────────
  getCalendarConfig: (projectPath) => ipcRenderer.invoke('api:getCalendarConfig', projectPath),
  updateCalendarConfig: (payload) => ipcRenderer.invoke('api:updateCalendarConfig', payload),
  calculateAge: (payload) => ipcRenderer.invoke('api:calculateAge', payload),

  // ── History Timeline ────────────────────────────────
  getHistoryEntries: (payload) => ipcRenderer.invoke('api:getHistoryEntries', payload),
  createHistoryEntry: (payload) => ipcRenderer.invoke('api:createHistoryEntry', payload),
  updateHistoryEntry: (payload) => ipcRenderer.invoke('api:updateHistoryEntry', payload),
  deleteHistoryEntry: (payload) => ipcRenderer.invoke('api:deleteHistoryEntry', payload),

  // ── World Times ─────────────────────────────────────
  getWorldTimes: (p) => ipcRenderer.invoke('api:getWorldTimes', p),
  createWorldTime: (p) => ipcRenderer.invoke('api:createWorldTime', p),
  updateWorldTime: (p) => ipcRenderer.invoke('api:updateWorldTime', p),
  deleteWorldTime: (p) => ipcRenderer.invoke('api:deleteWorldTime', p),

  // ── Sketchboards ───────────────────────────────────
  listBoards: (p) => ipcRenderer.invoke('api:listBoards', p),
  createBoard: (p) => ipcRenderer.invoke('api:createBoard', p),
  updateBoard: (p) => ipcRenderer.invoke('api:updateBoard', p),
  deleteBoard: (p) => ipcRenderer.invoke('api:deleteBoard', p),
  loadBoard: (p) => ipcRenderer.invoke('api:loadBoard', p),
  createBoardItem: (p) => ipcRenderer.invoke('api:createBoardItem', p),
  updateBoardItem: (p) => ipcRenderer.invoke('api:updateBoardItem', p),
  deleteBoardItem: (p) => ipcRenderer.invoke('api:deleteBoardItem', p),
  createBoardConnection: (p) => ipcRenderer.invoke('api:createBoardConnection', p),
  updateBoardConnection: (p) => ipcRenderer.invoke('api:updateBoardConnection', p),
  deleteBoardConnection: (p) => ipcRenderer.invoke('api:deleteBoardConnection', p),

  // ── Planner ──────────────────────────────────────────
  loadPlanner: (projectPath) => ipcRenderer.invoke('api:loadPlanner', projectPath),
  updatePlannerSettings: (payload) => ipcRenderer.invoke('api:updatePlannerSettings', payload),
  savePlannerBlock: (payload) => ipcRenderer.invoke('api:savePlannerBlock', payload),
  savePlannerArc: (payload) => ipcRenderer.invoke('api:savePlannerArc', payload),
  deletePlannerBlock: (payload) => ipcRenderer.invoke('api:deletePlannerBlock', payload),
  deletePlannerArc: (payload) => ipcRenderer.invoke('api:deletePlannerArc', payload),

  // ── Import ─────────────────────────────────────────
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  importSplitPreview: (payload) => ipcRenderer.invoke('api:importSplitPreview', payload),
  importConfirmSplits: (payload) => ipcRenderer.invoke('api:importConfirmSplits', payload),
  importNerExtract: (payload) => ipcRenderer.invoke('api:importNerExtract', payload),
  importNerAnalyze: (payload) => ipcRenderer.invoke('api:importNerAnalyze', payload),
  importBulkCreateEntities: (payload) => ipcRenderer.invoke('api:importBulkCreateEntities', payload),

  // ── NLP Configuration ──────────────────────────────
  checkNlpModel: (langCode) => ipcRenderer.invoke('api:checkNlpModel', langCode),
  loadNlpModel: (language) => ipcRenderer.invoke('api:loadNlpModel', language),
  onDownloadProgress: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('language-download-progress', listener)
    return () => ipcRenderer.removeListener('language-download-progress', listener)
  },

  // ── Janitor ────────────────────────────────────────
  janitorAnalyze: (payload) => ipcRenderer.invoke('api:janitorAnalyze', payload),
  janitorSensesOverview: (payload) => ipcRenderer.invoke('api:janitorSensesOverview', payload),

  // ── Synonyms ──────────────────────────────────────
  synonymLookup: (payload) => ipcRenderer.invoke('api:synonymLookup', payload),
  checkWordnetData: () => ipcRenderer.invoke('api:checkWordnetData'),
  ensureWordnetData: () => ipcRenderer.invoke('api:ensureWordnetData'),
  spellCheck: (payload) => ipcRenderer.invoke('api:spellCheck', payload),
  spellCheckIgnore: (payload) => ipcRenderer.invoke('api:spellCheckIgnore', payload),

  // ── Auto Updater ───────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('api:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('api:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('api:installUpdate'),
  onUpdateEvent: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('update-event', listener)
    return () => ipcRenderer.removeListener('update-event', listener)
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
