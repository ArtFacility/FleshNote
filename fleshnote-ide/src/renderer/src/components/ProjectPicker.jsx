import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import changelogData from '../changelog.json'
import ideIcon from '../assets/ide_icon.svg'

// ─── Rovásírás → Latin title animation ───────────────────────────────────────
// Old Hungarian Unicode block (U+10C80–U+10CFF)
//
// FLESH = 𐳌(F) 𐳖(L) 𐳉(E) 𐳤(SH)   ← single rovás glyph expands to two latin chars
// NOTE  = 𐳙(N) 𐳛(O) 𐳦(T) 𐳉(E)

const TITLE_CHARS = [
  { rovas: '𐳌', latin: 'F', word: 0 },
  { rovas: '𐳖', latin: 'L', word: 0 },
  { rovas: '𐳉', latin: 'E', word: 0 },
  { rovas: '𐳤', latin: 'SH', word: 0 },
  { rovas: '𐳙', latin: 'N', word: 1 },
  { rovas: '𐳛', latin: 'O', word: 1 },
  { rovas: '𐳦', latin: 'T', word: 1 },
  { rovas: '𐳉', latin: 'E', word: 1 },
]

// Phases: 'rovás' → 'exit' → 'latin'
function useTitleAnimation(count, startDelay = 700, stagger = 140) {
  const [phases, setPhases] = useState(Array(count).fill('rovás'))

  useEffect(() => {
    TITLE_CHARS.forEach((_, i) => {
      const t1 = setTimeout(() => {
        setPhases(p => { const n = [...p]; n[i] = 'exit'; return n })
      }, startDelay + i * stagger)

      const t2 = setTimeout(() => {
        setPhases(p => { const n = [...p]; n[i] = 'latin'; return n })
      }, startDelay + i * stagger + 160)

      return () => { clearTimeout(t1); clearTimeout(t2) }
    })
  }, [])

  return phases
}

function LogoMark({ size = 44 }) {
  const w = Math.round(size * 357 / 417)
  return (
    <img
      src={ideIcon}
      width={w}
      height={size}
      alt="FleshNote Logo"
      style={{ flexShrink: 0 }}
    />
  )
}

function AnimatedTitle() {
  const phases = useTitleAnimation(TITLE_CHARS.length)

  const word0 = TITLE_CHARS.filter(c => c.word === 0)
  const word1 = TITLE_CHARS.filter(c => c.word === 1)

  const renderChar = (char, absIdx) => {
    const phase = phases[absIdx]
    const isLatin = phase === 'latin'
    const isExit = phase === 'exit'

    return (
      <span
        key={absIdx}
        style={{
          display: 'inline-block',
          fontFamily: isLatin
            ? 'var(--font-sans)'
            : '"Segoe UI Historic", "Noto Serif", serif',
          color: isLatin ? 'var(--text-primary)' : 'var(--accent-amber)',
          opacity: isExit ? 0 : 1,
          transform: isExit ? 'scaleY(0.4) translateY(-6px)' : 'scaleY(1) translateY(0px)',
          transition: isExit
            ? 'opacity 0.12s ease-in, transform 0.12s ease-in'
            : 'opacity 0.18s ease-out, transform 0.18s ease-out, color 0s',
          fontSize: isLatin ? 'inherit' : '0.92em',
          letterSpacing: isLatin && char.latin === 'SH' ? '-0.02em' : 'inherit',
        }}
      >
        {isLatin ? char.latin : char.rovas}
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        marginBottom: '8px',
        userSelect: 'none',
        direction: 'ltr',
      }}
    >
      <LogoMark size={44} />

      <h1
        style={{
          margin: 0,
          fontSize: '36px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: 1,
          display: 'flex',
          gap: '0.28em',
        }}
      >
        {/* FLESH */}
        <span style={{ display: 'inline-flex' }}>
          {word0.map((char, i) => renderChar(char, i))}
        </span>
        {/* NOTE */}
        <span style={{ display: 'inline-flex' }}>
          {word1.map((char, i) => renderChar(char, i + 4))}
        </span>
      </h1>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
    if (workspacePath) fetchProjects(workspacePath)
  }, [workspacePath])

  useEffect(() => {
    if (window.api.onDownloadProgress) {
      const unsub = window.api.onDownloadProgress((progress) => setDownloadProgress(progress))
      return () => unsub()
    }
  }, [])

  const handleSelectWorkspace = async () => {
    const newPath = await window.api.selectFolder()
    if (newPath) setWorkspacePath(newPath)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        backgroundColor: 'var(--bg-deep)',
        position: 'relative',
        gap: '24px',
      }}
    >

      {/* ── Title block (outside the card) ── */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        <AnimatedTitle />
        <p
          style={{
            color: 'var(--text-tertiary)',
            fontSize: '13px',
            marginTop: '6px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
          }}
        >
          {t('picker.subtitle', 'Write first. Note second.')}
        </p>
      </div>

      {/* ── Project card ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          padding: '32px 40px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >

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
              fontSize: '12px',
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
              textTransform: 'uppercase',
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
            maxHeight: '40vh',
            overflowY: 'auto',
            paddingInlineEnd: '4px'
          }}
        >
          {!workspacePath ? (
            <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '40px', fontStyle: 'italic' }}>
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
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-amber)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelectProject(proj.path)}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{proj.name}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    {t('picker.lastEdited', 'Last edited:')} {proj.lastModified}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingProject(proj) }}
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
                    borderRadius: '4px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--entity-character)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
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
              letterSpacing: '1px',
            }}
          >
            {t('picker.createNew', '+ Create New Project')}
          </button>

          <button
            onClick={async () => {
              try {
                const tutorialPath = await window.api.getTutorialPath()
                onSelectProject(tutorialPath)
              } catch (err) {
                console.error('Failed to load tutorial path', err)
                alert('Could not load the tutorial project!')
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
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
          >
            {t('picker.loadTutorial', 'Load Tutorial')}
          </button>
        </div>
      </div>

      {/* ── Changelog Modal ── */}
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
                    {log.changes.map((change, cIdx) => <li key={cIdx}>{change}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── About Modal ── */}
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

              <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px', fontStyle: 'italic' }}>
                  "{t('picker.kofiSubtitle', 'Creating this app took a lot of work, if you found this app helped you write, please consider throwing me a bone')}"
                </p>
                <a href="https://ko-fi.com/artfacility" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-amber)', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.724c-.404 0-.724.32-.724.724v10.138c0 .404.32.724.724.724h1.087c.308 0 1.259 1.517 2.16 3.1 1.2 2.108 3.03 2.108 3.03 2.108h7.243s1.829 0 3.03-2.108c.901-1.583 1.852-3.1 2.16-3.1h.431c4.102 0 4.894-3.064 4.894-4.894 0-1.042-.143-1.638-.143-1.638zM19.1 12.013h-1.6.05V6.444h1.55c.01 0 2.222.08 2.222 2.76 0 2.726-2.215 2.809-2.222 2.809z" />
                  </svg>
                  {t('picker.kofiLink', 'Support me on Ko-fi')}
                </a>
              </div>

              <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px', fontStyle: 'italic' }}>
                  "{t('picker.discordSubtitle', 'You found a bug/have a feature idea? join our discord!')}"
                </p>
                <a href="https://discord.gg/T3xCjrmj2x" target="_blank" rel="noreferrer" style={{ color: '#5865F2', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 11.74 11.74 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42.001 1.333-.956 2.419-2.157 2.419z" />
                  </svg>
                  {t('picker.discordLink', 'Join our Discord')}
                </a>
              </div>

              <a href="https://artfacility.xyz" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-amber)', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* ── Delete Confirmation Modal ── */}
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
                style={{ padding: '8px 16px', background: 'var(--entity-character)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 'bold' }}
              >
                {t('picker.deletePermanently', 'Delete Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── About button (bottom left, above changelog) ── */}
      <button
        onClick={() => setShowAbout(true)}
        style={{ position: 'absolute', bottom: '72px', insetInlineStart: '24px', padding: '6px 16px', backgroundColor: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>{t('picker.about', 'About')}</span>
      </button>

      {/* ── Version / Changelog button (bottom left) ── */}
      <button
        onClick={() => setShowChangelog(true)}
        style={{ position: 'absolute', bottom: '24px', insetInlineStart: '24px', padding: '8px 16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-amber)'; e.currentTarget.style.borderColor = 'var(--accent-amber)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
      >
        <span style={{ fontWeight: 'bold' }}>v{changelogData.currentVersion}</span>
        <span style={{ opacity: 0.7 }}>—</span>
        <span>{t('picker.whatsNew', "What's New?")}</span>
      </button>

      {/* ── Language Selector (bottom right) ── */}
      <div style={{ position: 'absolute', bottom: '24px', insetInlineEnd: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            outline: 'none',
          }}
        >
          <option value="en">English (EN)</option>
          <option value="hu">Magyar (HU)</option>
          <option value="pl">Polski (PL)</option>
          <option value="ar">العربية (AR)</option>
        </select>
      </div>

    </div>
  )
}