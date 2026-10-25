import { useState, useEffect, useCallback, useRef } from 'react'
import ProjectPicker from './components/ProjectPicker'
import ProjectStart from './components/ProjectStart'
import StoryArchitectSuite from './components/StoryArchitectSuite'
import NewProjectChoiceModal from './components/NewProjectChoiceModal'
import FleshNoteIDE from './components/FleshNoteIDE'
import ReviewerIDE from './components/ReviewerIDE'
import IncomingReviewModal from './components/IncomingReviewModal'
import TitleBar from './components/TitleBar'
import { applyToProject } from './utils/pentimentoVerification'
import { installCloseGuard } from './utils/closeGuard'
import { useTranslation } from 'react-i18next'

import './index.css'

export default function App() {
  const [currentView, setCurrentView] = useState('picker') // picker | start | architect | ide | reviewer
  const [activeProject, setActiveProject] = useState(null)
  const [workspacePath, setWorkspacePath] = useState(null)
  const [projectConfig, setProjectConfig] = useState(null)
  const [startMode, setStartMode] = useState('write') // 'write' | 'import' (the new-book flow)
  const [showChoiceModal, setShowChoiceModal] = useState(false)
  const [reviewSession, setReviewSession] = useState(null)
  // the start screen reopens on the Reviewer tab after a review is closed
  const [pickerSection, setPickerSection] = useState('projects')
  // returned review files to import into the project being opened: { paths, key }
  const [incomingReviews, setIncomingReviews] = useState(null)
  // a review file FleshNote was opened with, waiting for the user to choose what to do
  const [incomingFile, setIncomingFile] = useState(null)
  const viewRef = useRef({ currentView, activeProject, workspacePath })
  viewRef.current = { currentView, activeProject, workspacePath }
  const { i18n } = useTranslation()

  useEffect(() => installCloseGuard(), [])

  useEffect(() => {
    window.api.getGlobalConfig().then((config) => {
      if (config.workspacePath) {
        setWorkspacePath(config.workspacePath)
      }
      if (config.language) {
        i18n.changeLanguage(config.language)
      }
    })
  }, [])

  useEffect(() => {
    document.documentElement.dir = i18n.dir()
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  // App-level accessibility toggle (set from the Project Picker settings;
  // falls back to the legacy per-project config when the app-level key is unset)
  const applyDyslexiaMode = useCallback(() => {
    let on = null
    try {
      const stored = localStorage.getItem('fn_dyslexia_mode')
      if (stored !== null) on = stored === 'true'
    } catch { /* noop */ }
    if (on === null) on = !!projectConfig?.dyslexia_mode
    if (on) {
      document.body.classList.add('dyslexia-mode')
    } else {
      document.body.classList.remove('dyslexia-mode')
    }
  }, [projectConfig?.dyslexia_mode])

  useEffect(() => {
    applyDyslexiaMode()
  }, [applyDyslexiaMode])

  useEffect(() => {
    const handler = () => applyDyslexiaMode()
    window.addEventListener('fn:appsettings-changed', handler)
    return () => window.removeEventListener('fn:appsettings-changed', handler)
  }, [applyDyslexiaMode])

  // ── Load an existing project ────────────────────────
  const handleSelectProject = async (projectPath) => {
    try {
      const data = await window.api.loadProject(projectPath)
      setProjectConfig(data.config)
      setActiveProject(projectPath)

      setCurrentView('ide')
    } catch (err) {
      alert('Failed to load project DB: ' + err.message)
    }
  }

  const handleWorkspaceChanged = (newPath) => {
    setWorkspacePath(newPath)
    window.api.updateGlobalConfig({ workspacePath: newPath })
  }

  const handleCreateNew = () => {
    setActiveProject(null)
    setShowChoiceModal(true)
  }

  const handleChoiceSelect = (choice) => {
    setShowChoiceModal(false)
    if (choice === 'write' || choice === 'import') {
      setStartMode(choice)
      setCurrentView('start')
    } else if (choice === 'architect') {
      setCurrentView('architect')
    }
  }

  // ── After the new-book flow created the project ──
  const handleOpenNewProject = async (projectPath) => {
    try {
      const data = await window.api.loadProject(projectPath)
      setProjectConfig(data.config)
      setActiveProject(projectPath)
      // carry the app-level Sealed Pentimento choice into the new project
      applyToProject(projectPath).catch(() => { })
      setCurrentView('ide')
    } catch (err) {
      alert('Failed to load new project: ' + err.message)
    }
  }

  // ── After Story Architect Suite creates the DB ──────
  const handleCompleteArchitect = async (projectPath) => {
    try {
      const data = await window.api.loadProject(projectPath)
      setProjectConfig(data.config)
      setActiveProject(projectPath)
      // carry the app-level Sealed Pentimento choice into the new project
      applyToProject(projectPath).catch(() => { })
      setCurrentView('ide') // Go directly to chapter editor, skipping setup/import wizard!
    } catch (err) {
      alert('Failed to load new project: ' + err.message)
    }
  }

  // ── Close project and return to picker ──────────────
  const handleCloseProject = () => {
    setPickerSection('projects')
    setActiveProject(null)
    setProjectConfig(null)
    setCurrentView('picker')
  }

  // res: what window.api.startReview returned (the working copy to review in)
  const handleOpenReviewer = (res) => {
    setReviewSession({ path: res.path, pkg: res.package, resumed: !!res.resumed })
    setCurrentView('reviewer')
  }

  // Returned review files go into a project; it opens with the Reviews panel
  const handleImportReviews = async ({ projectPath, paths }) => {
    const { currentView: view, activeProject: open } = viewRef.current
    if (!(view === 'ide' && open === projectPath)) await handleSelectProject(projectPath)
    setIncomingReviews({ paths, key: Date.now() })
  }

  // A .flreview file double-clicked (or opened with FleshNote): a review someone
  // sent to read, or one coming back to the author of a project on this machine
  const handleLaunchFile = async (path) => {
    const res = await window.api.openReviewPackage({ path })
    if (res?.status !== 'ok') {
      setIncomingFile({ path, error: res?.message || 'unreadable' })
      return
    }
    const peek = res.peek || {}
    const desktopId = peek.desktop_id
    const ws = viewRef.current.workspacePath
    let match = null
    if (desktopId && ws) {
      try {
        const data = await window.api.getProjects(ws)
        match = (data.projects || []).find((p) => p.project_id === desktopId) || null
      } catch { match = null }
    }
    const returned = (peek.notes || 0) > 0 || !!peek.finished_at
    if (!(returned && match) && viewRef.current.currentView === 'picker') {
      const started = await window.api.startReview({ path })
      if (started?.status === 'ok') handleOpenReviewer(started)
      else setIncomingFile({ path, problem: started })
      return
    }
    setIncomingFile({ path, peek, match: returned ? match : null })
  }

  useEffect(() => {
    const take = async () => {
      const file = await window.api.takeLaunchFile?.()
      if (file) handleLaunchFile(file)
    }
    take()
    return window.api.onLaunchFile?.(take)
  }, [])

  const handleCloseReviewer = () => {
    setReviewSession(null)
    setPickerSection('reviewer')
    setCurrentView('picker')
  }

  return (
    <div className="ide-root">
      <TitleBar projectName={projectConfig?.project_name || reviewSession?.pkg?.snapshot?.project?.title} />
      {currentView === 'picker' && (
        <>
          <ProjectPicker
            workspacePath={workspacePath}
            setWorkspacePath={handleWorkspaceChanged}
            onSelectProject={handleSelectProject}
            onCreateNew={handleCreateNew}
            onOpenReviewer={handleOpenReviewer}
            onImportReviews={handleImportReviews}
            initialSection={pickerSection}
          />
          {showChoiceModal && (
            <NewProjectChoiceModal
              onSelect={handleChoiceSelect}
              onClose={() => setShowChoiceModal(false)}
            />
          )}
        </>
      )}

      {currentView === 'start' && (
        <ProjectStart
          workspacePath={workspacePath}
          mode={startMode}
          onCancel={() => setCurrentView('picker')}
          onOpenProject={handleOpenNewProject}
        />
      )}

      {currentView === 'architect' && (
        <StoryArchitectSuite
          workspacePath={workspacePath}
          onComplete={handleCompleteArchitect}
          onCancel={() => setCurrentView('picker')}
        />
      )}

      {currentView === 'ide' && (
        <FleshNoteIDE
          projectConfig={projectConfig}
          projectPath={activeProject}
          onCloseProject={handleCloseProject}
          onConfigUpdate={setProjectConfig}
          incomingReviews={incomingReviews}
        />
      )}

      {currentView === 'reviewer' && reviewSession && (
        <ReviewerIDE
          key={reviewSession.path}
          session={reviewSession}
          onClose={handleCloseReviewer}
        />
      )}

      {incomingFile && (
        <IncomingReviewModal
          file={incomingFile}
          onClose={() => setIncomingFile(null)}
          onImport={() => {
            const { path, match } = incomingFile
            setIncomingFile(null)
            handleImportReviews({ projectPath: match.path, paths: [path] })
          }}
          onReview={async () => {
            const { path } = incomingFile
            setIncomingFile(null)
            const started = await window.api.startReview({ path })
            if (started?.status !== 'ok') {
              setIncomingFile({ path, problem: started })
              return
            }
            setActiveProject(null)
            setProjectConfig(null)
            handleOpenReviewer(started)
          }}
        />
      )}
    </div>
  )
}
