import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import changelogData from '../changelog.json'

export default function ProjectPicker({
  workspacePath,
  setWorkspacePath,
  onSelectProject,
  onCreateNew
}) {
  const { t, i18n } = useTranslation()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const fetchProjects = async (path) => {
    setLoading(true)
    const data = await window.api.getProjects(path)
    setProjects(data.projects || [])
    setLoading(false)
  }

  useEffect(() => {
    if (workspacePath) {
      fetchProjects(workspacePath)
    }
  }, [workspacePath])

  useEffect(() => {
    if (window.api.onDownloadProgress) {
      const unsub = window.api.onDownloadProgress((progress) => {
        setDownloadProgress(progress)
      })
      return () => unsub()
    }
  }, [])

  const handleSelectWorkspace = async () => {
    const newPath = await window.api.selectFolder()
    if (newPath) {
      setWorkspacePath(newPath)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        backgroundColor: 'var(--bg-deep)',
        position: 'relative'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '24px',
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}
            >
              {t('picker.title', 'FleshNote Projects')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {t('picker.subtitle', 'Select a project or establish a new workspace.')}
            </p>
          </div>
        </div>

        {/* Workspace Path Picker */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: workspacePath ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px'
            }}
          >
            {workspacePath || t('picker.noWorkspace', 'No workspace selected...')}
          </div>
          <button
            onClick={handleSelectWorkspace}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              textTransform: 'uppercase'
            }}
          >
            {t('picker.browse', 'Browse')}
          </button>
        </div>

        {/* Project List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: '200px',
            maxHeight: '50vh',
            overflowY: 'auto',
            paddingInlineEnd: '4px'
          }}
        >
          {!workspacePath ? (
            <div
              style={{
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                marginTop: '40px',
                fontStyle: 'italic'
              }}
            >
              {t('picker.scanPrompt', 'Select a workspace folder to scan for projects.')}
            </div>
          ) : loading ? (
            <div style={{ color: 'var(--accent-amber)', textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <div>{downloadProgress !== null ? t('picker.downloading', 'Downloading NLP model...') : t('picker.scanning', 'Scanning directory...')}</div>
              {downloadProgress !== null && (
                <div style={{ width: '200px', height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${downloadProgress}%`, height: '100%', background: 'var(--accent-amber)', transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          ) : projects.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '40px' }}>
              {t('picker.noProjects', 'No projects found in this workspace.')}
            </div>
          ) : (
            projects.map((proj, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-amber)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => onSelectProject(proj.path)}
                >
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{proj.name}</div>
                  <div
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 4
                    }}
                  >
                    {t('picker.lastEdited', 'Last edited:')} {proj.lastModified}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingProject(proj)
                  }}
                  title={t('picker.deleteTitle', 'Delete Project')}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--entity-character)' /* red/amber hint */
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                  }}
                >
                  {/* Inline Trash Icon */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          {/* Create New Project Button */}
          <button
            onClick={onCreateNew}
            disabled={!workspacePath}
            style={{
              flex: 1,
              padding: '14px',
              backgroundColor: workspacePath ? 'var(--accent-amber)' : 'var(--bg-elevated)',
              color: workspacePath ? 'var(--bg-deep)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: workspacePath ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            {t('picker.createNew', '+ Create New Project')}
          </button>

          {/* Load Tutorial Button */}
          <button
            onClick={async () => {
              try {
                const tutorialPath = await window.api.getTutorialPath()
                onSelectProject(tutorialPath)
              } catch (err) {
                console.error("Failed to load tutorial path", err)
                alert("Could not load the tutorial project!")
              }
            }}
            style={{
              padding: '14px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.borderColor = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          >
            {t('picker.loadTutorial', 'Load Tutorial')}
          </button>
        </div>
      </div>

      {/* Changelog Modal */}
      {showChangelog && (
        <div className="popup-overlay" onClick={() => setShowChangelog(false)} style={{ zIndex: 9999 }}>
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.changelogTitle', 'What\'s New in FleshNote')}</span>
              <button className="popup-close" onClick={() => setShowChangelog(false)}>
                &times;
              </button>
            </div>
            <div style={{ overflowY: 'auto', paddingInline: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {changelogData.history.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ color: index === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      v{log.version}
                    </strong>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{log.date}</span>
                  </div>
                  <ul style={{ margin: 0, paddingInlineStart: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                    {log.changes.map((change, cIdx) => (
                      <li key={cIdx}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="popup-overlay" onClick={() => setShowAbout(false)} style={{ zIndex: 9999 }}>
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 500, display: 'flex', flexDirection: 'column' }}
          >
            <div className="popup-header" style={{ marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.aboutTitle', 'About FleshNote')}</span>
              <button className="popup-close" onClick={() => setShowAbout(false)}>
                &times;
              </button>
            </div>

            <div style={{ paddingInline: '20px', paddingBottom: '20px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('picker.aboutSubtitle', 'A no-bullshit writing tool designed for writing first, with seamless notetaking second.')}
              </p>

              <h3 style={{
                color: 'var(--text-secondary)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '8px'
              }}>
                {t('picker.featuresTitle', 'Core Features')}
              </h3>

              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {[
                  'featureWriting',
                  'featureNlp',
                  'featureExport',
                  'featureKnowledge',
                  'featureI18n'
                ].map(fKey => (
                  <li key={fKey} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--text-secondary)',
                    fontSize: '13px'
                  }}>
                    <span style={{ color: 'var(--accent-amber)', fontSize: '18px' }}>•</span>
                    {t(`picker.${fKey}`)}
                  </li>
                ))}
              </ul>

              <a
                href="https://artfacility.xyz"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent-amber)',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                {t('picker.websiteLink', 'Visit artfacility.xyz')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div className="popup-overlay" onClick={() => setDeletingProject(null)}>
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 400, transform: 'translateY(0)' }}
          >
            <div className="popup-header">
              <span style={{ color: 'var(--entity-character)' }}>{t('picker.deleteTitle', 'Delete Project')}</span>
              <button className="popup-close" onClick={() => setDeletingProject(null)}>
                &times;
              </button>
            </div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
              {t('picker.deletePrompt', 'Are you sure you want to permanently delete')} <strong>{deletingProject.name}</strong>?
              <br />
              <br />
              {t('picker.deleteWarning1', 'This will remove all chapters, database files, and character sheets from your hard drive. This action')}{' '}
              <strong style={{ color: 'var(--entity-character)' }}>{t('picker.deleteWarning2', 'cannot')}</strong> {t('picker.deleteWarning3', 'be undone.')}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingProject(null)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12
                }}
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
                style={{
                  padding: '8px 16px',
                  background: 'var(--entity-character)',
                  color: 'var(--bg-deep)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}
              >
                {t('picker.deletePermanently', 'Delete Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Button (Bottom Left, above Changelog) */}
      <button
        onClick={() => setShowAbout(true)}
        style={{
          position: 'absolute',
          bottom: '72px',
          insetInlineStart: '24px',
          padding: '6px 16px',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)'
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>{t('picker.about', 'About')}</span>
      </button>

      {/* Version and Changelog (Bottom Left) */}
      <button
        onClick={() => setShowChangelog(true)}
        style={{
          position: 'absolute',
          bottom: '24px',
          insetInlineStart: '24px',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent-amber)'
          e.currentTarget.style.borderColor = 'var(--accent-amber)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
        }}
      >
        <span style={{ fontWeight: 'bold' }}>v{changelogData.currentVersion}</span>
        <span style={{ opacity: 0.7 }}>—</span>
        <span>{t('picker.whatsNew', 'What\'s New?')}</span>
      </button>

      {/* Language Selector (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          insetInlineEnd: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <select
          value={i18n.language}
          onChange={async (e) => {
            const newLang = e.target.value
            i18n.changeLanguage(newLang)
            window.api.updateGlobalConfig({ language: newLang })

            // Trigger backend NLP load
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
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 24px 6px 12px',
            borderRadius: '4px',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%239b978f%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%223%205%206%208%209%205%22%2F%3E%3C%2Fsvg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            outline: 'none'
          }}
        >
          <option value="en">English (EN)</option>
          <option value="hu">Magyar (HU)</option>
          <option value="pl">Polski (PL)</option>
          <option value="ar">العربية (AR)</option>
        </select>
      </div >

    </div >
  )
}
