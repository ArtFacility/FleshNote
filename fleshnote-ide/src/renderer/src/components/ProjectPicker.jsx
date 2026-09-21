import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import changelogData from '../changelog.json'
import CloneModal from './CloneModal'
import PentimentoFirstRunModal from './PentimentoFirstRunModal'
import PickerSettingsModal from './PickerSettingsModal'
import { getVerificationDefault } from '../utils/pentimentoVerification'
import HomeRail from './picker/HomeRail'
import ProjectListPane from './picker/ProjectListPane'
import ReviewerHome from './picker/ReviewerHome'
import CollectHome from './picker/CollectHome'

export default function ProjectPicker({
  workspacePath,
  setWorkspacePath,
  onSelectProject,
  onCreateNew,
  onOpenReviewer,
  onOpenCollect,
}) {
  const { t, i18n } = useTranslation()
  const [section, setSection] = useState('projects')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [migratingPath, setMigratingPath] = useState(null)
  const [modernizing, setModernizing] = useState(false)
  const [modernizeResults, setModernizeResults] = useState(null)
  const [busyPath, setBusyPath] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showMobileImport, setShowMobileImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [updateState, setUpdateState] = useState({ status: 'idle' })

  useEffect(() => {
    let timer = null
    if (getVerificationDefault() == null) {
      timer = setTimeout(() => setShowFirstRun(true), 1200)
    }
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  const fetchProjects = async (path) => {
    setLoading(true)
    const data = await window.api.getProjects(path)
    setProjects(data.projects || [])
    setLoading(false)
  }

  useEffect(() => {
    if (workspacePath) fetchProjects(workspacePath)
  }, [workspacePath])

  useEffect(() => {
    if (window.api.onDownloadProgress) {
      const unsub = window.api.onDownloadProgress((progress) => setDownloadProgress(progress))
      return () => unsub()
    }
  }, [])

  useEffect(() => {
    if (window.api.onUpdateEvent) {
      const unsub = window.api.onUpdateEvent((payload) => {
        if (payload.type === 'update-available') {
          setUpdateState({
            status: 'available',
            version: payload.info.version,
            canAutoUpdate: payload.canAutoUpdate
          })
        } else if (payload.type === 'download-progress') {
          setUpdateState(prev => ({ ...prev, status: 'downloading', progress: payload.progress }))
        } else if (payload.type === 'update-downloaded') {
          setUpdateState(prev => ({ ...prev, status: 'downloaded' }))
        } else if (payload.type === 'error') {
          console.error("Updater error:", payload.message)
        }
      })
      if (window.api.checkForUpdates) {
        window.api.checkForUpdates()
      }
      return () => unsub()
    }
  }, [])

  const handleSelectWorkspace = async () => {
    const newPath = await window.api.selectFolder()
    if (newPath) setWorkspacePath(newPath)
  }

  const handleMigrate = async (proj) => {
    setMigratingPath(proj.path)
    try {
      const res = await window.api.migrateProject(proj.path)
      if (res && res.status === 'ok') {
        alert(t('picker.migrationSuccess', 'Project migrated successfully to Schema v2!'))
        fetchProjects(workspacePath)
      } else {
        alert(t('picker.migrationError', 'Migration failed: ') + (res?.message || 'Unknown error'))
      }
    } catch (err) {
      alert(t('picker.migrationError', 'Migration failed: ') + (err.message || err))
    } finally {
      setMigratingPath(null)
    }
  }

  const legacyProjects = projects.filter(p => p.is_legacy)

  const handleModernize = async () => {
    setModernizing(true)
    try {
      const res = await window.api.modernizeProjects(workspacePath)
      setModernizeResults(res?.results || [])
      fetchProjects(workspacePath)
    } catch (err) {
      alert(t('picker.modernizeError', 'Upgrade failed: ') + (err.message || err))
    } finally {
      setModernizing(false)
    }
  }

  const handleExportFlnote = async (proj) => {
    setBusyPath(proj.path)
    try {
      const res = await window.api.exportFlnote({ project_path: proj.path, defaultName: proj.name })
      if (res?.status === 'error') {
        alert(t('picker.exportError', 'Export failed: ') + (res.message || ''))
      }
    } catch (err) {
      alert(t('picker.exportError', 'Export failed: ') + (err.message || err))
    } finally {
      setBusyPath(null)
    }
  }

  const handleDropFlnote = async (zipPath) => {
    try {
      const res = await window.api.importFlnote({ workspace_path: workspacePath, zip_path: zipPath })
      if (res?.status === 'error') {
        alert(t('picker.importFileError', 'Import failed: ') + (res.message || ''))
      } else if (res?.status === 'ok') {
        if (res.message) alert(t('picker.importMigrationFailed', 'Project imported, but the schema migration failed: ') + res.message)
        fetchProjects(workspacePath)
      }
    } catch (err) {
      alert(t('picker.importFileError', 'Import failed: ') + (err.message || err))
    }
  }

  const handleTutorial = async () => {
    try {
      const tutorialPath = await window.api.getTutorialPath()
      onSelectProject(tutorialPath)
    } catch (err) {
      console.error('Failed to load tutorial path', err)
      alert('Could not load the tutorial project!')
    }
  }

  const handleUpdateAction = () => {
    if (updateState.status === 'available') {
      if (updateState.canAutoUpdate) {
        window.api.downloadUpdate()
        setUpdateState(prev => ({ ...prev, status: 'downloading', progress: 0 }))
      } else {
        window.open('https://github.com/ArtFacility/FleshNote/releases/latest', '_blank')
      }
    } else if (updateState.status === 'downloaded') {
      window.api.installUpdate()
    }
  }

  return (
    <div className="picker-shell">
      <HomeRail
        section={section}
        onSection={setSection}
        onCreate={onCreateNew}
        onTutorial={handleTutorial}
        onPhone={() => setShowMobileImport(true)}
        onSettings={() => setShowSettings(true)}
        onAbout={() => setShowAbout(true)}
        onChangelog={() => setShowChangelog(true)}
        workspacePath={workspacePath}
      />

      <main className="picker-main">
        {section === 'projects' && (
          <ProjectListPane
            workspacePath={workspacePath}
            onBrowse={handleSelectWorkspace}
            projects={projects}
            loading={loading}
            downloadProgress={downloadProgress}
            updateState={updateState}
            onUpdateAction={handleUpdateAction}
            legacyCount={legacyProjects.length}
            modernizing={modernizing}
            onModernize={handleModernize}
            migratingPath={migratingPath}
            onMigrate={handleMigrate}
            busyPath={busyPath}
            onExport={handleExportFlnote}
            onDelete={setDeletingProject}
            onSelect={onSelectProject}
            onDropFlnote={handleDropFlnote}
          />
        )}
        {section === 'reviewer' && (
          <ReviewerHome onOpenPackage={onOpenReviewer} />
        )}
        {section === 'collect' && (
          <CollectHome
            projects={projects}
            workspacePath={workspacePath}
            onCollect={onOpenCollect}
          />
        )}

        <div className="picker-lang">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <select
            value={i18n.language}
            onChange={async (e) => {
              const newLang = e.target.value
              i18n.changeLanguage(newLang)
              window.api.updateGlobalConfig({ language: newLang })
              try {
                if (window.api.loadNlpModel) {
                  setLoading(true)
                  setDownloadProgress(0)
                  await window.api.loadNlpModel(newLang)
                }
              } catch (err) {
                console.error('Failed to load NLP model', err)
              } finally {
                setLoading(false)
                setDownloadProgress(null)
              }
            }}
          >
            <option value="en">English (EN)</option>
            <option value="hu">Magyar (HU)</option>
            <option value="pl">Polski (PL)</option>
            <option value="ar">العربية (AR)</option>
          </select>
        </div>
      </main>

      {showFirstRun && (
        <PentimentoFirstRunModal
          projects={projects}
          onClose={() => setShowFirstRun(false)}
        />
      )}

      {modernizeResults && (
        <div className="popup-overlay" onClick={() => setModernizeResults(null)} style={{ zIndex: 9999 }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 480, display: 'flex', flexDirection: 'column' }}>
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.modernizeResultsTitle', 'Upgrade Results')}</span>
              <button className="popup-close" onClick={() => setModernizeResults(null)}>&times;</button>
            </div>
            <div style={{ overflowY: 'auto', paddingInline: '20px', paddingBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {modernizeResults.map((r, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface)',
                  border: `1px solid ${r.status === 'error' ? 'var(--entity-character)' : 'var(--border-subtle)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{r.name}</div>
                  <div style={{
                    color: r.status === 'error' ? 'var(--entity-character)' : 'var(--accent-green)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                  }}>
                    {r.status === 'migrated'
                      ? t('picker.modernizeMigrated', 'Renamed + migrated to Schema v2')
                      : r.status === 'renamed'
                      ? t('picker.modernizeRenamed', 'Renamed to .flnote')
                      : r.status === 'error'
                      ? t('picker.modernizeFailed', 'Failed')
                      : r.status}
                  </div>
                  {r.message && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{r.message}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <PickerSettingsModal
          projects={projects}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showChangelog && (
        <div className="popup-overlay" onClick={() => setShowChangelog(false)} style={{ zIndex: 9999 }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.changelogTitle', "What's New in FleshNote")}</span>
              <button className="popup-close" onClick={() => setShowChangelog(false)}>&times;</button>
            </div>
            <div style={{ overflowY: 'auto', paddingInline: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {changelogData.history.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ color: index === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>v{log.version}</strong>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{log.date}</span>
                  </div>
                  <ul style={{ margin: 0, paddingInlineStart: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                    {log.changes.map((change, cIdx) => {
                      if (change.includes('artfacility.xyz')) {
                        const parts = change.split('artfacility.xyz')
                        return (
                          <li key={cIdx}>
                            {parts[0]}
                            <a href="https://artfacility.xyz" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-amber)', textDecoration: 'underline' }}>
                              artfacility.xyz
                            </a>
                            {parts[1]}
                          </li>
                        )
                      }
                      return <li key={cIdx}>{change}</li>
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="popup-overlay" onClick={() => setShowAbout(false)} style={{ zIndex: 9999 }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 500, display: 'flex', flexDirection: 'column' }}>
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.aboutTitle', 'About FleshNote')}</span>
              <button className="popup-close" onClick={() => setShowAbout(false)}>&times;</button>
            </div>
            <div style={{ paddingInline: '20px', paddingBottom: '20px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('picker.aboutSubtitle', 'A no-bullshit writing tool designed for writing first, with seamless notetaking second.')}
              </p>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                {t('picker.featuresTitle', 'Core Features')}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['featureWriting', 'featureNlp', 'featureExport', 'featureKnowledge', 'featureI18n'].map(fKey => (
                  <li key={fKey} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--accent-amber)', fontSize: '18px' }}>•</span>
                    {t(`picker.${fKey}`)}
                  </li>
                ))}
              </ul>

              <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px', fontStyle: 'italic' }}>
                  "{t('picker.kofiSubtitle', 'Creating this app took a lot of work, if you found this app helped you write, please consider throwing me a bone')}"
                </p>
                <a href="https://ko-fi.com/artfacility" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-amber)', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('picker.kofiLink', 'Support me on Ko-fi')}
                </a>
              </div>

              <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px', fontStyle: 'italic' }}>
                  "{t('picker.discordSubtitle', 'You found a bug/have a feature idea? join our discord!')}"
                </p>
                <a href="https://discord.gg/T3xCjrmj2x" target="_blank" rel="noreferrer" style={{ color: '#5865F2', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('picker.discordLink', 'Join our Discord')}
                </a>
              </div>

              <a href="https://artfacility.xyz" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-amber)', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {t('picker.websiteLink', 'Visit artfacility.xyz')}
              </a>

              <button
                onClick={() => setShowCredits(true)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                {t('picker.thirdPartyCreditsBtn', 'Third-Party Licenses & Credits')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredits && (
        <div className="popup-overlay" onClick={() => setShowCredits(false)} style={{ zIndex: 10000 }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.creditsTitle', 'Third-Party Licenses')}</span>
              <button className="popup-close" onClick={() => setShowCredits(false)}>&times;</button>
            </div>
            <div style={{ overflowY: 'auto', paddingInline: '20px', paddingBottom: '20px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {`FleshNote is made possible by the following incredible open-source projects:

--- FRONTEND (MIT License) ---
• React & React DOM
• Electron & Electron-Vite
• TipTap Editor (and extensions)
• TailwindCSS
• Recharts
• i18next
• Tippy.js

--- BACKEND (MIT / BSD / Apache 2.0) ---
• FastAPI & Uvicorn
• Pydantic
• spaCy & huSpaCy
• NLTK (Apache 2.0)
• python-docx & lxml
• xhtml2pdf
• phunspell (Hunspell wrappers)

--- SPECIAL LICENSES ---
• ebooklib (AGPL-3.0) - The FleshNote backend is open-source, complying with AGPL-3.0 terms for this dependency.
• PyInstaller (GPL-2.0 w/ Bootloader Exception) - Used to freeze the offline Python environment securely.
• Hunspell Dictionaries - Varies by language (MPL, LGPL, GPL).

All trademarks and copyrights belong to their respective owners. Support open source!`}
            </div>
          </div>
        </div>
      )}

      {deletingProject && (
        <div className="popup-overlay" onClick={() => setDeletingProject(null)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 400 }}>
            <div className="popup-header">
              <span style={{ color: 'var(--entity-character)' }}>{t('picker.deleteTitle', 'Delete Project')}</span>
              <button className="popup-close" onClick={() => setDeletingProject(null)}>&times;</button>
            </div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
              {t('picker.deletePrompt', 'Are you sure you want to permanently delete')} <strong>{deletingProject.name}</strong>?
              <br /><br />
              {t('picker.deleteWarning1', 'This will remove all chapters, database files, and character sheets from your hard drive. This action')}{' '}
              <strong style={{ color: 'var(--entity-character)' }}>{t('picker.deleteWarning2', 'cannot')}</strong> {t('picker.deleteWarning3', 'be undone.')}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingProject(null)}
                style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              >
                {t('picker.cancel', 'Cancel')}
              </button>
              <button
                onClick={async () => {
                  try {
                    await window.api.deleteProject(deletingProject.path)
                    setDeletingProject(null)
                    fetchProjects(workspacePath)
                  } catch (e) {
                    console.error('Failed to delete', e)
                    alert(t('picker.deleteFailed', 'Failed to delete project. Make sure files are not in use.'))
                  }
                }}
                style={{ padding: '8px 16px', background: 'var(--entity-character)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}
              >
                {t('picker.deletePermanently', 'Delete Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}

      <CloneModal
        isOpen={showMobileImport}
        mode="receive"
        onClose={() => setShowMobileImport(false)}
        workspacePath={workspacePath}
        onCloneReceived={(path) => { setShowMobileImport(false); onSelectProject(path); }}
      />
    </div>
  )
}
