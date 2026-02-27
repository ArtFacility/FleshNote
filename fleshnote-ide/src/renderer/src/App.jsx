import { useState, useEffect } from 'react'
import ProjectPicker from './components/ProjectPicker'
import ProjectQuestionnaire from './components/ProjectQuestionnaire'
import ProjectSetup from './components/ProjectSetup'
import FleshNoteIDE from './components/FleshNoteIDE'
import TitleBar from './components/TitleBar'
import { useTranslation } from 'react-i18next'

import './index.css'

export default function App() {
  const [currentView, setCurrentView] = useState('picker') // picker | questionnaire | setup | ide
  const [activeProject, setActiveProject] = useState(null)
  const [workspacePath, setWorkspacePath] = useState(null)
  const [projectConfig, setProjectConfig] = useState(null)
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
    setCurrentView('questionnaire')
  }

  // ── After questionnaire creates the DB ──────────────
  const handleCompleteQuestionnaire = async (projectPath) => {
    try {
      const data = await window.api.loadProject(projectPath)
      setProjectConfig(data.config)
      setActiveProject(projectPath)
      setCurrentView('setup') // Go to project setup wizard, not directly to IDE
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

  return (
    <div className="ide-root">
      <TitleBar projectName={projectConfig?.project_name} />
      {currentView === 'picker' && (
        <ProjectPicker
          workspacePath={workspacePath}
          setWorkspacePath={handleWorkspaceChanged}
          onSelectProject={handleSelectProject}
          onCreateNew={handleCreateNew}
        />
      )}

      {currentView === 'questionnaire' && (
        <ProjectQuestionnaire
          workspacePath={workspacePath}
          onComplete={handleCompleteQuestionnaire}
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
        />
      )}
    </div>
  )
}
