import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Editor from './Editor'
import EntityInspectorPanel from './EntityInspectorPanel'
import ProjectSettingsModal from './ProjectSettingsModal'
import ExportModal from './ExportModal'
import changelogData from '../changelog.json'

// ─── ICONS ──────────────────────────────────────────────────────────────────

const Icons = {
  Feather: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  X: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Maximize: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  BookOpen: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Layers: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Settings: () => (
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Download: () => (
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  FileText: () => (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

// ─── MAIN IDE SHELL ─────────────────────────────────────────────────────────

export default function FleshNoteIDE({ projectConfig, projectPath, onCloseProject }) {
  const { t } = useTranslation()
  const [focusMode, setFocusMode] = useState(false)
  const [chapters, setChapters] = useState([])
  const [activeChapter, setActiveChapter] = useState(null)
  const [chapterContent, setChapterContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [characters, setCharacters] = useState([])
  const [entities, setEntities] = useState([])

  // Left panel mode: 'chapters' or 'entity'
  const [leftPanelMode, setLeftPanelMode] = useState('chapters')
  const [inspectedEntity, setInspectedEntity] = useState(null)

  const [hoveredChapterId, setHoveredChapterId] = useState(null)
  const [deletingChapter, setDeletingChapter] = useState(null)

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const toggleFocus = useCallback(() => setFocusMode((prev) => !prev), [])

  const projectName = projectConfig?.project_name || t('ide.untitledProject', 'Untitled Project')

  // ── Load data on mount ──────────────────────────────
  useEffect(() => {
    if (!projectPath) return

    const loadData = async () => {
      try {
        const [chaptersData, charsData, entData, qnData] = await Promise.all([
          window.api.getChapters(projectPath),
          window.api.getCharacters(projectPath),
          window.api.getEntities(projectPath),
          window.api.getQuickNotes(projectPath)
        ])

        const chapterList = chaptersData.chapters || []
        setChapters(chapterList)
        setCharacters(charsData.characters || [])

        const loadedEntities = entData.entities || []
        const loadedQuickNotes = qnData.quick_notes || []
        setEntities([...loadedEntities, ...loadedQuickNotes])

        if (chapterList.length > 0) {
          const writingChapter = chapterList.find((c) => c.status === 'writing')
          const targetChapter = writingChapter || chapterList[chapterList.length - 1]
          await loadChapter(targetChapter)
        }
      } catch (err) {
        console.error('Failed to load project data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [projectPath])

  // ── Load a specific chapter's content ───────────────
  const loadChapter = async (chapter) => {
    setActiveChapter(chapter)
    try {
      const data = await window.api.loadChapterContent(projectPath, chapter.id)
      setChapterContent({
        ...chapter,
        content: data.content || ''
      })
    } catch (err) {
      console.error('Failed to load chapter content:', err)
      setChapterContent({ ...chapter, content: '' })
    }
  }

  // ── Save chapter content ────────────────────────────
  const handleEditorUpdate = useCallback(
    async (html, wordCount) => {
      if (!activeChapter || !projectPath) return
      try {
        await window.api.saveChapterContent({
          project_path: projectPath,
          chapter_id: activeChapter.id,
          content: html,
          word_count: wordCount
        })
        setChapters((prev) =>
          prev.map((ch) => (ch.id === activeChapter.id ? { ...ch, word_count: wordCount } : ch))
        )
      } catch (err) {
        console.error('Failed to save chapter:', err)
      }
    },
    [activeChapter, projectPath]
  )

  // ── Update chapter metadata (POV, status) ──────────
  const handleChapterMetaUpdate = useCallback(
    async (updates) => {
      if (!activeChapter || !projectPath) return
      try {
        const data = await window.api.updateChapter({
          project_path: projectPath,
          chapter_id: activeChapter.id,
          ...updates
        })
        const updated = data.chapter
        if (updated) {
          setChapters((prev) =>
            prev.map((ch) => (ch.id === updated.id ? { ...ch, ...updated } : ch))
          )
          setActiveChapter((prev) => ({ ...prev, ...updated }))
          setChapterContent((prev) => (prev ? { ...prev, ...updated } : prev))
        }
      } catch (err) {
        console.error('Failed to update chapter:', err)
      }
    },
    [activeChapter, projectPath]
  )

  // ── Create a new chapter ────────────────────────────
  const handleCreateChapter = async () => {
    try {
      const nextNum =
        chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapter_number)) + 1 : 1
      const data = await window.api.createChapter({
        project_path: projectPath,
        title: `Chapter ${nextNum}`,
        chapter_number: nextNum,
        target_word_count: parseInt(projectConfig?.default_chapter_target) || 4000,
        status: 'writing'
      })
      const newChapter = data.chapter
      setChapters((prev) => [...prev, newChapter])
      await loadChapter(newChapter)
    } catch (err) {
      console.error('Failed to create chapter:', err)
    }
  }

  const reloadChaptersList = async () => {
    try {
      const data = await window.api.getChapters(projectPath)
      setChapters(data.chapters || [])
    } catch (err) {
      console.error('Failed to reload chapters', err)
    }
  }

  const handleInsertChapter = async (anchorId, direction) => {
    try {
      const data = await window.api.insertChapter({
        project_path: projectPath,
        anchor_chapter_id: anchorId,
        direction
      })
      await reloadChaptersList()
      await loadChapter(data.chapter)
    } catch (err) {
      console.error('Failed to insert', err)
    }
  }

  const handleDeleteChapterConfirm = async () => {
    if (!deletingChapter) return
    try {
      await window.api.deleteChapter({
        project_path: projectPath,
        chapter_id: deletingChapter.id
      })
      setDeletingChapter(null)
      await reloadChaptersList()

      // If we deleted the active chapter, clear editor or load first available
      if (activeChapter?.id === deletingChapter.id) {
        setChapterContent(null)
        setActiveChapter(null)
      }
    } catch (err) {
      console.error('Failed to delete', err)
    }
  }

  // ── Entity click handler (from editor) ─────────────
  const handleEntityClick = useCallback(
    (entityRef) => {
      // entityRef = { type: 'character', id: 5 }
      const entity = entities.find(
        (e) => String(e.id) === String(entityRef.id) && e.type === entityRef.type
      )
      if (entity) {
        setInspectedEntity(entity)
        setLeftPanelMode('entity')
      }
    },
    [entities]
  )

  const handleBackToChapters = useCallback(() => {
    setLeftPanelMode('chapters')
    setInspectedEntity(null)
  }, [])

  useEffect(() => {
    const onForceBack = () => handleBackToChapters()
    window.addEventListener('forceBackToChapters', onForceBack)
    return () => window.removeEventListener('forceBackToChapters', onForceBack)
  }, [handleBackToChapters])

  // ── Refresh entities (after creating new ones) ─────
  const handleEntitiesChanged = useCallback(async () => {
    if (!projectPath) return
    try {
      const [entData, charsData, qnData] = await Promise.all([
        window.api.getEntities(projectPath),
        window.api.getCharacters(projectPath),
        window.api.getQuickNotes(projectPath)
      ])
      const loadedEntities = entData.entities || []
      const loadedQuickNotes = qnData.quick_notes || []
      setEntities([...loadedEntities, ...loadedQuickNotes])
      setCharacters(charsData.characters || [])
    } catch (err) {
      console.error('Failed to refresh entities:', err)
    }
  }, [projectPath])

  return (
    <>
      {/* ── IDE HEADER TOOLBAR ──────────────────────── */}
      <div className="ide-header-toolbar">
        <button className="ide-header-btn" title={t('ide.notes', 'Notes')}>
          <Icons.FileText />
        </button>
        <button
          className="ide-header-btn"
          title={t('ide.export', 'Export')}
          onClick={() => setShowExportModal(true)}
        >
          <Icons.Download />
        </button>
        <div className="ide-header-divider" />
        <button
          className="ide-header-btn"
          title={t('ide.settings', 'Settings')}
          onClick={() => setShowSettings(true)}
        >
          <Icons.Settings />
        </button>
      </div>

      {/* ── PROGRESS BAR ───────────────────────────── */}
      {chapters.length > 0 && (
        <div className="progress-bar-container">
          <div className="progress-label">{t('ide.manuscript', 'Manuscript')}</div>
          <div className="progress-track">
            {chapters.map((ch) => {
              const pct =
                ch.target_word_count > 0
                  ? Math.min(100, (ch.word_count / ch.target_word_count) * 100)
                  : 0
              return (
                <div
                  key={ch.id}
                  className={`progress-chapter status-${ch.status} ${activeChapter?.id === ch.id ? 'active' : ''}`}
                  onClick={() => loadChapter(ch)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="progress-chapter-bg" />
                  <div className="progress-chapter-fill" style={{ width: `${pct}%` }} />
                  <div className="progress-chapter-tooltip">
                    Ch.{ch.chapter_number}: {ch.title}
                    <br />
                    {ch.word_count.toLocaleString()} / {ch.target_word_count.toLocaleString()} —{' '}
                    {ch.status}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="progress-stats">
            <strong>{chapters.reduce((sum, ch) => sum + ch.word_count, 0).toLocaleString()}</strong>
            {' / '}
            {chapters.reduce((sum, ch) => sum + ch.target_word_count, 0).toLocaleString()} {t('ide.words', 'words')}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ──────────────────────────────── */}
      <div className="ide-body">
        {/* ── LEFT PANEL ──────────────────────────── */}
        <div className={`panel-left ${focusMode ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <div className="panel-header-title">
              {leftPanelMode === 'chapters' ? (
                <>
                  <Icons.BookOpen /> {t('ide.chaptersTitle', 'Chapters')}
                </>
              ) : (
                <>
                  <Icons.Layers /> {t('ide.entityInspectorTitle', 'Entity Inspector')}
                </>
              )}
            </div>
            {leftPanelMode === 'chapters' ? (
              <button
                className="ide-titlebar-btn"
                onClick={handleCreateChapter}
                title={t('ide.newChapterBtn', 'New Chapter')}
                style={{ color: 'var(--accent-amber)' }}
              >
                <Icons.Plus />
              </button>
            ) : (
              <button
                className="ide-titlebar-btn"
                onClick={handleBackToChapters}
                title={t('ide.backToChaptersBtn', 'Back to chapters')}
              >
                <Icons.X />
              </button>
            )}
          </div>
          <div className="panel-content">
            {leftPanelMode === 'chapters' && (
              <>
                {loading ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px'
                    }}
                  >
                    {t('ide.loadingChapters', 'Loading chapters...')}
                  </div>
                ) : chapters.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      gap: 12,
                      opacity: 0.5
                    }}
                  >
                    <Icons.BookOpen />
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.6,
                        textAlign: 'center'
                      }}
                    >
                      {t('ide.noChaptersYet', 'No chapters yet.')}
                    </div>
                  </div>
                ) : (
                  chapters.map((ch) => (
                    <div
                      key={ch.id}
                      className={`chapter-list-item ${activeChapter?.id === ch.id ? 'active' : ''}`}
                      onClick={() => loadChapter(ch)}
                      onMouseEnter={() => setHoveredChapterId(ch.id)}
                      onMouseLeave={() => setHoveredChapterId(null)}
                      style={{ position: 'relative' }}
                    >
                      <div className="chapter-num">
                        {String(ch.chapter_number).padStart(2, '0')}
                      </div>
                      <div className="chapter-info">
                        <div className="chapter-title">{ch.title}</div>
                        <div className="chapter-meta">
                          {ch.word_count > 0
                            ? `${ch.word_count.toLocaleString()} / ${ch.target_word_count.toLocaleString()} ${t('ide.words', 'words')}`
                            : '\u2014'}
                        </div>
                      </div>

                      {hoveredChapterId === ch.id ? (
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            position: 'absolute',
                            insetInlineEnd: '12px',
                            background: 'var(--bg-elevated)',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                          }}
                        >
                          <button
                            title={t('ide.insertAboveBtn', 'Insert Above')}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInsertChapter(ch.id, 'above')
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = 'var(--accent-amber)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = 'var(--text-secondary)')
                            }
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            title={t('ide.insertBelowBtn', 'Insert Below')}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInsertChapter(ch.id, 'below')
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = 'var(--accent-amber)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = 'var(--text-secondary)')
                            }
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 5v14M19 12l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            title={t('ide.deleteChapterBtn', 'Delete Chapter')}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingChapter(ch)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = 'var(--entity-character)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = 'var(--text-secondary)')
                            }
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className={`chapter-status ${ch.status}`}>{ch.status}</div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
            {leftPanelMode === 'entity' && inspectedEntity && (
              <EntityInspectorPanel
                entity={inspectedEntity}
                characters={characters}
                entities={entities}
                activeChapter={activeChapter}
                projectPath={projectPath}
                chapters={chapters}
                onEntityUpdated={handleEntitiesChanged}
              />
            )}
          </div>
        </div>

        {/* ── MIDDLE PANEL — EDITOR ────────────────── */}
        {chapters.length === 0 && !loading ? (
          <div className="panel-middle">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 20
              }}
            >
              <Icons.BookOpen />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  lineHeight: 1.8
                }}
              >
                {t('ide.noChaptersYet', 'No chapters yet.')}
                <br />
                {t('ide.createFirstPrompt', 'Create your first chapter to start writing.')}
              </div>
              <button
                onClick={handleCreateChapter}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--accent-amber)',
                  color: 'var(--bg-deep)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600
                }}
              >
                {t('ide.createChapter1Btn', '+ Create Chapter 1')}
              </button>
            </div>
          </div>
        ) : (
          <Editor
            chapter={chapterContent}
            onUpdate={handleEditorUpdate}
            focusMode={focusMode}
            onToggleFocus={toggleFocus}
            characters={characters}
            entities={entities}
            projectPath={projectPath}
            projectConfig={projectConfig}
            chapters={chapters}
            onChapterMetaUpdate={handleChapterMetaUpdate}
            onEntityClick={handleEntityClick}
            onEntitiesChanged={handleEntitiesChanged}
          />
        )}
      </div>

      {/* ── STATUS BAR ─────────────────────────────── */}
      <div className="status-bar">
        <div className="status-bar-item">{projectName}</div>
        <div className="status-bar-right">
          <div className="status-bar-item">Markdown · UTF-8</div>
          <div
            className="status-bar-item"
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={onCloseProject}
            onKeyDown={(e) => e.key === 'Enter' && onCloseProject()}
          >
            {t('ide.closeProject', 'Close Project')}
          </div>
        </div>
      </div>

      {deletingChapter && (
        <div
          className="popup-overlay"
          onClick={() => setDeletingChapter(null)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 400, transform: 'translateY(0)' }}
          >
            <div className="popup-header">
              <span style={{ color: 'var(--entity-character)' }}>
                {t('ide.deleteTitle', 'Delete')} {deletingChapter.title}
              </span>
              <button className="popup-close" onClick={() => setDeletingChapter(null)}>
                &times;
              </button>
            </div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
              {t('ide.deletePrompt1', 'Are you sure you want to delete Chapter')} {deletingChapter.chapter_number}? {t('ide.deletePrompt2', 'This will remove its markdown file and shift all subsequent chapters down by one to fill the gap.')}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingChapter(null)}
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
                {t('ide.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDeleteChapterConfirm}
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
                {t('ide.deleteChapterConfirm', 'Delete Chapter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECT SETTINGS MODAL ────────────────── */}
      <ProjectSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        projectPath={projectPath}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        projectPath={projectPath}
        projectConfig={projectConfig}
        chapters={chapters}
        entities={entities}
      />
    </>
  )
}
