import { useState, useEffect, useCallback } from 'react'
import ProjectPicker from './components/ProjectPicker'
import ProjectQuestionnaire from './components/ProjectQuestionnaire'
import ProjectSetup from './components/ProjectSetup'
import StoryArchitectSuite from './components/StoryArchitectSuite'
import NewProjectChoiceModal from './components/NewProjectChoiceModal'
import FleshNoteIDE from './components/FleshNoteIDE'
import ReviewerIDE from './components/ReviewerIDE'
import TitleBar from './components/TitleBar'
import { applyToProject } from './utils/pentimentoVerification'
import { useTranslation } from 'react-i18next'

import './index.css'

export default function App() {
  const [currentView, setCurrentView] = useState('picker') // picker | questionnaire | setup | ide | reviewer
  const [activeProject, setActiveProject] = useState(null)
  const [workspacePath, setWorkspacePath] = useState(null)
  const [projectConfig, setProjectConfig] = useState(null)
  const [showChoiceModal, setShowChoiceModal] = useState(false)
  const [reviewSession, setReviewSession] = useState(null)
  const { i18n } = useTranslation()

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

      // Check if project has chapters — if not, show setup wizard
      const chaptersData = await window.api.getChapters(projectPath)
      if (!chaptersData.chapters || chaptersData.chapters.length === 0) {
        setCurrentView('setup')
      } else {
        setCurrentView('ide')
      }
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
    if (choice === 'quick') {
      setCurrentView('questionnaire')
    } else if (choice === 'architect') {
      setCurrentView('architect')
    }
  }

  // ── After questionnaire creates the DB (Fast-track flow) ──
  const handleCompleteQuestionnaire = async (projectPath) => {
    try {
      const data = await window.api.loadProject(projectPath)
      setProjectConfig(data.config)
      setActiveProject(projectPath)
      // carry the app-level Sealed Pentimento choice into the new project
      applyToProject(projectPath).catch(() => { })
      setCurrentView('setup') // Go to project setup wizard for existing manuscripts/imports
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

  // ── After project setup wizard completes ────────────
  const handleSetupComplete = () => {
    setCurrentView('ide')
  }

  // ── Close project and return to picker ──────────────
  const handleCloseProject = () => {
    setActiveProject(null)
    setProjectConfig(null)
    setCurrentView('picker')
  }

  const handleOpenReviewer = (session) => {
    setReviewSession({ ...session, mode: 'reviewer' })
    setCurrentView('reviewer')
  }

  const handleOpenCollect = (session) => {
    setReviewSession({ ...session, mode: 'collect' })
    setCurrentView('reviewer')
  }

  const handleCloseReviewer = () => {
    setReviewSession(null)
    setCurrentView('picker')
  }

  return (
    <div className="ide-root">
      <TitleBar projectName={projectConfig?.project_name || reviewSession?.pkg?.snapshot?.project?.title || reviewSession?.data?.snapshot?.project?.title} />
      {currentView === 'picker' && (
        <>
          <ProjectPicker
            workspacePath={workspacePath}
            setWorkspacePath={handleWorkspaceChanged}
            onSelectProject={handleSelectProject}
            onCreateNew={handleCreateNew}
            onOpenReviewer={handleOpenReviewer}
            onOpenCollect={handleOpenCollect}
          />
          {showChoiceModal && (
            <NewProjectChoiceModal
              onSelect={handleChoiceSelect}
              onClose={() => setShowChoiceModal(false)}
            />
          )}
        </>
      )}

      {currentView === 'questionnaire' && (
        <ProjectQuestionnaire
          workspacePath={workspacePath}
          onComplete={handleCompleteQuestionnaire}
          onCancel={() => setCurrentView('picker')}
        />
      )}

      {currentView === 'architect' && (
        <StoryArchitectSuite
          workspacePath={workspacePath}
          onComplete={handleCompleteArchitect}
          onCancel={() => setCurrentView('picker')}
        />
      )}

      {currentView === 'setup' && (
        <ProjectSetup
          projectPath={activeProject}
          projectConfig={projectConfig}
          onComplete={handleSetupComplete}
          onSkip={handleSetupComplete}
        />
      )}

      {currentView === 'ide' && (
        <FleshNoteIDE
          projectConfig={projectConfig}
          projectPath={activeProject}
          onCloseProject={handleCloseProject}
          onConfigUpdate={setProjectConfig}
        />
      )}

      {currentView === 'reviewer' && reviewSession && (
        <ReviewerIDE
          session={reviewSession}
          onClose={handleCloseReviewer}
        />
      )}
    </div>
  )
}
