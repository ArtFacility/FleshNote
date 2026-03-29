import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { matchesHotkey } from '../utils/hotkeyMatcher'
import Editor from './Editor'
import EntityInspectorPanel from './EntityInspectorPanel'
import TwistInspectorPanel from './TwistInspectorPanel'
import FleshNotePlannerDesktop from './FleshNotePlannerDesktop'
import ProjectSettingsModal from './ProjectSettingsModal'
import ExportModal from './ExportModal'
import StatsDashboard from './StatsDashboard'
import EntityManager from './EntityManager'
import WorldbuildAndHistory from './WorldbuildAndHistory'
import JanitorPanel from './JanitorPanel'
import changelogData from '../changelog.json'
import WelcomeBackPrompt from './WelcomeBackPrompt'

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
  ),
  Calendar: () => (
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  ),
  Users: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  ),
  Menu: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
}

// ─── MAIN IDE SHELL ─────────────────────────────────────────────────────────

export default function FleshNoteIDE({ projectConfig, projectPath, onCloseProject, onConfigUpdate }) {
  const { t } = useTranslation()
  const [mainView, setMainView] = useState('editor') // 'editor' | 'planner' | 'calendar'
  const [focusMode, setFocusMode] = useState(null)
  const [chapters, setChapters] = useState([])
  const [activeChapter, setActiveChapter] = useState(null)
  const [chapterContent, setChapterContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [characters, setCharacters] = useState([])
  const [entities, setEntities] = useState([])
  const [twistIds, setTwistIds] = useState([])
  const [calConfig, setCalConfig] = useState(null)

  // Left panel mode: 'chapters' or 'entity'
  const [leftPanelMode, setLeftPanelMode] = useState('chapters')
  const [inspectedEntity, setInspectedEntity] = useState(null)
  const [inspectedTwistId, setInspectedTwistId] = useState(null)
  const [inspectorInitialTab, setInspectorInitialTab] = useState(null)
  const [scrollToWordOffset, setScrollToWordOffset] = useState(null)

  const [hoveredChapterId, setHoveredChapterId] = useState(null)
  const [deletingChapter, setDeletingChapter] = useState(null)

  // Welcome-back writing prompt
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // UI Toggles & Header Menu
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showProgressBar, setShowProgressBar] = useState(() => {
    const saved = localStorage.getItem('fn_showProgressBar')
    return saved !== null ? saved === 'true' : true
  })
  const [showStatusBar, setShowStatusBar] = useState(() => {
    const saved = localStorage.getItem('fn_showStatusBar')
    return saved !== null ? saved === 'true' : true
  })

  // App scale settings
  const [scale, setScale] = useState(1.0)
  const isAltPressed = useRef(false)

  // ── Janitor Panel State ────────────────────────────
  const [janitorCollapsed, setJanitorCollapsed] = useState(
    () => localStorage.getItem('fn_janitorCollapsed') !== 'false' // default closed
  )
  const [janitorSuggestions, setJanitorSuggestions] = useState([])
  const [janitorLoading, setJanitorLoading] = useState(false)
  const [janitorFocusSignal, setJanitorFocusSignal] = useState(0)
  const janitorActionsRef = useRef(null)
  const lastAnalyzedHtmlRef = useRef('')

  // ── IDE-level configurable hotkeys ────────────────
  const [ideHotkeys, setIdeHotkeys] = useState({ janitor_open: 'Alt+j', focus_normal: 'Alt+f' })
  const janitorPanelActivityRef = useRef(0) // timestamp of last user interaction inside the panel
  const janitorPendingRetryRef = useRef(null) // deferred retry when panel is active

  // ── Stat Tracking: Time Auditing & Sprint Recovery ────────
  const lastTickTimeRef = useRef(Date.now())
  const processedSprintRef = useRef(null)

  // Check for abandoned sprint on load
  useEffect(() => {
    if (projectPath && projectConfig?.active_sprint) {
      if (processedSprintRef.current !== projectConfig.active_sprint) {
        processedSprintRef.current = projectConfig.active_sprint
        // App was closed during a sprint
        window.api.updateStat({
          project_path: projectPath,
          stat_key: 'sprints_abandoned',
          increment_by: 1
        })
        window.api.updateProjectConfig(projectPath, 'active_sprint', '', 'string')
      }
    }
  }, [projectPath, projectConfig?.active_sprint])

  // Welcome-back prompt: show if last open was 24h+ ago
  useEffect(() => {
    if (loading || !projectPath) return
    const now = Date.now()
    const lastOpened = projectConfig?.last_opened_at
    // Update the timestamp immediately so the next launch uses today's value
    window.api.updateProjectConfig(projectPath, 'last_opened_at', now.toString(), 'string').catch(() => { })
    if (lastOpened && (now - parseInt(lastOpened)) > 24 * 60 * 60 * 1000) {
      setShowWelcomeBack(true)
    }
  }, [loading, projectPath])

  // 60-second time tracking tick
  useEffect(() => {
    if (!projectPath) return

    const tickInterval = setInterval(() => {
      const now = Date.now()
      const elapsedMs = now - lastTickTimeRef.current
      lastTickTimeRef.current = now

      // If more than 5 minutes elapsed between ticks, the system probably slept.
      // Do not count that as active time.
      if (elapsedMs > 5 * 60 * 1000) return

      // Generic active time
      window.api.updateStat({ project_path: projectPath, stat_key: 'time_total_minutes', increment_by: 1 })

      // Specific module time
      if (mainView === 'editor') {
        window.api.updateStat({ project_path: projectPath, stat_key: 'time_editor_minutes', increment_by: 1 })
      } else if (mainView === 'planner') {
        window.api.updateStat({ project_path: projectPath, stat_key: 'time_planner_minutes', increment_by: 1 })
      } else if (mainView === 'stats') {
        window.api.updateStat({ project_path: projectPath, stat_key: 'time_stats_minutes', increment_by: 1 })
      } else if (mainView === 'calendar') {
        window.api.updateStat({ project_path: projectPath, stat_key: 'time_calendar_minutes', increment_by: 1 })
      }
    }, 60000) // 1 minute

    return () => clearInterval(tickInterval)
  }, [projectPath, mainView])

  const toggleFocus = useCallback((mode) => setFocusMode(mode), [])

  const projectName = projectConfig?.project_name || t('ide.untitledProject', 'Untitled Project')

  // ── Load data on mount ──────────────────────────────
  useEffect(() => {
    if (!projectPath) return

    const loadData = async () => {
      try {
        const [chaptersData, charsData, entData, qnData, annData, twistsData, calData] = await Promise.all([
          window.api.getChapters(projectPath),
          window.api.getCharacters(projectPath),
          window.api.getEntities(projectPath),
          window.api.getQuickNotes(projectPath),
          window.api.getAnnotations(projectPath),
          window.api.getTwists(projectPath),
          window.api.getCalendarConfig(projectPath),
        ])

        const chapterList = chaptersData.chapters || []
        setChapters(chapterList)
        setCharacters(charsData.characters || [])
        setTwistIds((twistsData.twists || []).map(tw => tw.id))

        const loadedEntities = entData.entities || []
        const loadedQuickNotes = qnData.quick_notes || []
        const loadedAnnotations = annData.annotations || []
        setEntities([...loadedEntities, ...loadedQuickNotes, ...loadedAnnotations])
        setCalConfig(calData.config || {})

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
        content: data.content || '',
        _rev: Date.now()
      })
    } catch (err) {
      console.error('Failed to load chapter content:', err)
      setChapterContent({ ...chapter, content: '', _rev: Date.now() })
    }
  }

  // ── Save chapter content ────────────────────────────
  const handleEditorUpdate = useCallback(
    async (html, wordCount) => {
      if (!activeChapter || !projectPath) return
      setIsSaving(true)
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
        // CRITICAL: Sync the local state so navigating back and forth doesn't revert to stale data
        setChapterContent((prev) =>
          (prev && prev.id === activeChapter.id) ? { ...prev, content: html, word_count: wordCount } : prev
        )
      } catch (err) {
        console.error('Failed to save chapter:', err)
      } finally {
        // Just a small delay so it doesn't flicker too fast
        setTimeout(() => setIsSaving(false), 1000)
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
      // entityRef = { type: 'character', id: 5, tab?: 'knowledge' | 'relationships' }
      const entity = entities.find(
        (e) => String(e.id) === String(entityRef.id) && e.type === entityRef.type
      )
      if (entity) {
        setInspectedEntity(entity)
        setLeftPanelMode('entity')
        if (entityRef.tab) {
          setInspectorInitialTab(entityRef.tab)
        } else {
          setInspectorInitialTab(null)
        }
      }
    },
    [entities]
  )

  const handleBackToChapters = useCallback(() => {
    setLeftPanelMode('chapters')
    setInspectedEntity(null)
    setInspectedTwistId(null)
  }, [])

  useEffect(() => {
    const onForceBack = () => handleBackToChapters()
    window.addEventListener('forceBackToChapters', onForceBack)
    return () => window.removeEventListener('forceBackToChapters', onForceBack)
  }, [handleBackToChapters])

  // ── Twist click handler (from editor) ───────────────
  const handleTwistClick = useCallback(
    (twistRef) => {
      // twistRef = { twistType: 'twist'|'foreshadow', twistId: 5 }
      setInspectedTwistId(twistRef.twistId)
      setLeftPanelMode('twist')
    },
    []
  )

  // ── Navigate to mark (from inspector click) ────────
  const handleNavigateToMark = useCallback(
    async ({ chapterId, wordOffset }) => {
      const targetChapter = chapters.find(ch => ch.id === chapterId)
      if (!targetChapter) return
      // Load the chapter if it's not the current one
      if (!activeChapter || activeChapter.id !== chapterId) {
        await loadChapter(targetChapter)
      }
      // Signal editor to scroll to word offset
      setScrollToWordOffset({ wordOffset, timestamp: Date.now() })
    },
    [chapters, activeChapter]
  )

  // ── Refresh entities (after creating new ones) ─────
  const handleEntitiesChanged = useCallback(async () => {
    if (!projectPath) return
    try {
      const [entData, charsData, qnData, annData, twistsData] = await Promise.all([
        window.api.getEntities(projectPath),
        window.api.getCharacters(projectPath),
        window.api.getQuickNotes(projectPath),
        window.api.getAnnotations(projectPath),
        window.api.getTwists(projectPath)
      ])
      const loadedEntities = entData.entities || []
      const loadedQuickNotes = qnData.quick_notes || []
      const loadedAnnotations = annData.annotations || []
      setEntities([...loadedEntities, ...loadedQuickNotes, ...loadedAnnotations])
      setCharacters(charsData.characters || [])
      setTwistIds((twistsData.twists || []).map(tw => tw.id))
    } catch (err) {
      console.error('Failed to refresh entities/twists:', err)
    }
  }, [projectPath])

  // ── Janitor Analysis ──────────────────────────────
  const triggerJanitorAnalysis = useCallback(async () => {
    if (focusMode) return
    if (!activeChapter || !projectPath) return
    if (mainView !== 'editor') return
    if (!chapterContent?.content) return
    // Skip if content hasn't changed since last analysis (prevents 10s timer re-analyzing same text)
    if (chapterContent.content === lastAnalyzedHtmlRef.current) return
    // Don't refresh while user is actively browsing the panel — defer until they're done
    if (Date.now() - janitorPanelActivityRef.current < 8000) {
      if (janitorPendingRetryRef.current) clearTimeout(janitorPendingRetryRef.current)
      janitorPendingRetryRef.current = setTimeout(() => triggerJanitorAnalysis(), 8000)
      return
    }

    const htmlToAnalyze = chapterContent.content
    setJanitorLoading(true)
    try {
      const result = await window.api.janitorAnalyze({
        project_path: projectPath,
        chapter_id: activeChapter.id,
        html: htmlToAnalyze,
        language: projectConfig?.story_language || 'en',
        confidence_threshold: projectConfig?.janitor_sdt_confidence ?? 0.5,
      })
      if (result?.status === 'ok') {
        lastAnalyzedHtmlRef.current = htmlToAnalyze
        // Filter out already-dismissed suggestions so badge count matches panel count
        const dismissKey = `fn_janitor_dismissed_${btoa(projectPath.slice(-20))}_${activeChapter.id}`
        const dismissed = new Set(
          JSON.parse(localStorage.getItem(dismissKey) || '[]').map(i => i.id)
        )
        setJanitorSuggestions((result.suggestions || []).filter(s => !dismissed.has(s.id)))
      }
    } catch (err) {
      console.error('Janitor analysis failed:', err)
    } finally {
      setJanitorLoading(false)
    }
  }, [focusMode, activeChapter, projectPath, chapterContent, mainView, projectConfig])

  const handleJanitorDismiss = useCallback((suggestion) => {
    if (!projectPath || !activeChapter) return
    const key = `fn_janitor_dismissed_${btoa(projectPath.slice(-20))}_${activeChapter.id}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.push({ id: suggestion.id })
    localStorage.setItem(key, JSON.stringify(existing))
    setJanitorSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }, [projectPath, activeChapter])

  const handleJanitorAccept = useCallback(async (suggestion) => {
    const actions = janitorActionsRef.current
    if (!actions) return

    switch (suggestion.type) {
      case 'link_existing':
        actions.linkEntityAtOffset(suggestion.char_offset, suggestion.matched_text, suggestion.entity_type, suggestion.entity_id)
        break
      case 'create_entity': {
        const createFn = {
          character: window.api.createCharacter,
          location: window.api.createLocation,
          lore: window.api.createLoreEntity,
        }[suggestion.entity_type]
        if (createFn) {
          const result = await createFn({ project_path: projectPath, name: suggestion.matched_text })
          // Each API returns the id nested: { character: {id} }, { location: {id} }, { entity: {id} }
          const newId = result?.character?.id ?? result?.location?.id ?? result?.entity?.id
          if (newId) {
            actions.linkEntityAtOffset(suggestion.char_offset, suggestion.matched_text, suggestion.entity_type, newId)
            handleEntitiesChanged()
            // Reset last-analyzed so the next trigger re-analyzes with the newly created entity
            lastAnalyzedHtmlRef.current = ''
          }
        }
        break
      }
      case 'alias':
        await window.api.addEntityAlias({
          project_path: projectPath,
          entity_type: suggestion.entity_type,
          entity_id: suggestion.entity_id,
          alias: suggestion.matched_text
        })
        handleEntitiesChanged()
        break
      case 'typo':
      case 'synonym':
        if (suggestion.replacement) {
          actions.replaceAtOffset(suggestion.char_offset, suggestion.matched_text, suggestion.replacement)
        }
        break
      case 'show_dont_tell':
      case 'pacing':
        actions.navigateToCharOffset(suggestion.char_offset, suggestion.matched_text || '')
        break
      case 'five_senses':
      case 'readability':
        // Advisory only — just dismiss
        break
    }
    handleJanitorDismiss(suggestion)
  }, [janitorActionsRef, projectPath, handleEntitiesChanged, handleJanitorDismiss])

  // Clear janitor on chapter change or focus mode entry
  useEffect(() => {
    setJanitorSuggestions([])
    setJanitorLoading(false)
    lastAnalyzedHtmlRef.current = ''
  }, [activeChapter?.id])

  useEffect(() => {
    if (focusMode) {
      setJanitorSuggestions([])
      setJanitorLoading(false)
    }
  }, [focusMode])

  // ── Load IDE-level hotkeys from global config ─────
  useEffect(() => {
    window.api?.getGlobalConfig?.().then(cfg => {
      if (cfg?.hotkeys) setIdeHotkeys(prev => ({ ...prev, ...cfg.hotkeys }))
    })
    const onChanged = (e) => setIdeHotkeys(prev => ({ ...prev, ...e.detail }))
    window.addEventListener('fleshnote:hotkeys-changed', onChanged)
    return () => window.removeEventListener('fleshnote:hotkeys-changed', onChanged)
  }, [])

  // ── Alt+J global hotkey: open janitor and focus it ────
  useEffect(() => {
    const handleAltJ = (e) => {
      if (matchesHotkey(e, ideHotkeys.janitor_open) && !focusMode) {
        e.preventDefault()
        if (janitorCollapsed) {
          setJanitorCollapsed(false)
          localStorage.setItem('fn_janitorCollapsed', 'false')
          setJanitorFocusSignal(s => s + 1)
        } else {
          setJanitorCollapsed(true)
          localStorage.setItem('fn_janitorCollapsed', 'true')
        }
      }
    }
    window.addEventListener('keydown', handleAltJ)
    return () => window.removeEventListener('keydown', handleAltJ)
  }, [focusMode, janitorCollapsed, ideHotkeys.janitor_open])

  return (
    <>
      {/* ── IDE HEADER TOOLBAR ──────────────────────── */}
      <div className="ide-header-toolbar" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>

        {/* ── LEFT SIDE BUTTONS ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="ide-header-btn"
            title={focusMode?.active ? t('ide.focusModeLocked', 'Finish your sprint to access this') : mainView === 'stats' ? t('ide.backToWriting', 'Back to writing') : t('ide.stats', 'Stats & Analytics')}
            onClick={() => { if (!focusMode?.active) setMainView(mainView === 'stats' ? 'editor' : 'stats') }}
            style={{
              color: focusMode?.active ? 'var(--text-tertiary)' : mainView === 'stats' ? 'var(--accent-amber)' : 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              border: !focusMode?.active && mainView === 'stats' ? '1px solid var(--accent-amber)' : 'none',
              borderRadius: 0,
              opacity: focusMode?.active ? 0.4 : 1,
              cursor: focusMode?.active ? 'not-allowed' : 'pointer'
            }}
          >
            <Icons.Activity />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {mainView === 'stats' ? t('ide.backToWriting', 'Back to writing') : t('ide.stats', 'Stats & Analytics')}
            </span>
          </button>

          <button
            className="ide-header-btn"
            title={focusMode?.active ? t('ide.focusModeLocked', 'Finish your sprint to access this') : t('ide.worldinfo', 'World & History')}
            onClick={() => { if (!focusMode?.active) setMainView(mainView === 'worldinfo' ? 'editor' : 'worldinfo') }}
            style={{
              color: focusMode?.active ? 'var(--text-tertiary)' : mainView === 'worldinfo' ? 'var(--accent-amber)' : 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              border: !focusMode?.active && mainView === 'worldinfo' ? '1px solid var(--accent-amber)' : 'none',
              borderRadius: 0,
              opacity: focusMode?.active ? 0.4 : 1,
              cursor: focusMode?.active ? 'not-allowed' : 'pointer'
            }}
          >
            <Icons.Globe />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {mainView === 'worldinfo' ? t('ide.backToWriting', 'Back to writing') : t('ide.worldinfo', 'World & History')}
            </span>
          </button>
          <button
            className="ide-header-btn"
            title={focusMode?.active ? t('ide.focusModeLocked', 'Finish your sprint to access this') : t('ide.entityManager', 'Entity Manager')}
            onClick={() => { if (!focusMode?.active) setMainView(mainView === 'entities' ? 'editor' : 'entities') }}
            style={{
              color: focusMode?.active ? 'var(--text-tertiary)' : mainView === 'entities' ? 'var(--accent-amber)' : 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              border: !focusMode?.active && mainView === 'entities' ? '1px solid var(--accent-amber)' : 'none',
              borderRadius: 0,
              opacity: focusMode?.active ? 0.4 : 1,
              cursor: focusMode?.active ? 'not-allowed' : 'pointer'
            }}
          >
            <Icons.Users />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {mainView === 'entities' ? t('ide.backToWriting', 'Back to writing') : t('ide.entityManager', 'Entity Manager')}
            </span>
          </button>
        </div>

        {/* ── RIGHT SIDE BUTTONS ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          {!focusMode && mainView === 'editor' && (
            <button
              className="ide-header-btn"
              title={t('janitor.toggleTitle', 'Toggle Janitor Panel')}
              onClick={() => {
                const next = !janitorCollapsed
                setJanitorCollapsed(next)
                localStorage.setItem('fn_janitorCollapsed', next)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                color: janitorSuggestions.length > 0 ? 'var(--accent-amber)' : 'inherit'
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>𐲟</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {t('janitor.title', 'Janitor')}
              </span>
              {janitorSuggestions.length > 0 && (
                <span className="janitor-badge">{janitorSuggestions.length}</span>
              )}
            </button>
          )}

          <button
            className="ide-header-btn"
            title={t('ide.optionsMenu', 'Options')}
            onClick={() => setShowHeaderMenu(!showHeaderMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px'
            }}
          >
            <Icons.Menu />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t('ide.optionsMenu', 'Options')}
            </span>
          </button>

          {showHeaderMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowHeaderMenu(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '8px 0',
                minWidth: '220px',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <button
                  onClick={() => { setShowHeaderMenu(false); setShowExportModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icons.Download /> {t('ide.export', 'Export Project...')}
                </button>
                <button
                  onClick={() => { setShowHeaderMenu(false); setShowSettings(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icons.Settings /> {t('ide.settings', 'Project Settings...')}
                </button>

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />

                <button
                  onClick={() => {
                    const next = !showProgressBar;
                    setShowProgressBar(next);
                    localStorage.setItem('fn_showProgressBar', next);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>{showProgressBar && <Icons.Check />}</div>
                  {t('ide.toggleProgressBar', 'Show Progress Bar')}
                </button>

                <button
                  onClick={() => {
                    const next = !showStatusBar;
                    setShowStatusBar(next);
                    localStorage.setItem('fn_showStatusBar', next);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>{showStatusBar && <Icons.Check />}</div>
                  {t('ide.toggleStatusBar', 'Show Status Bar')}
                </button>

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />

                <button
                  onClick={() => { setShowHeaderMenu(false); onCloseProject(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icons.X /> {t('ide.closeProject', 'Close Project...')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PROGRESS BAR ───────────────────────────── */}
      {(chapters.length > 0 && showProgressBar) && (
        <div className="progress-bar-container">
          <button
            className="progress-label"
            onClick={() => setMainView(mainView === 'planner' ? 'editor' : 'planner')}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              padding: '4px 10px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            {mainView === 'planner' ? t('ide.backToWriting', 'Back to writing') : t('ide.planner', 'Planner')}
          </button>
          <div className="progress-track">
            {chapters.map((ch) => {
              const pct =
                ch.status === 'final'
                  ? 100
                  : ch.target_word_count > 0
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
        {mainView === 'worldinfo' ? (
          <WorldbuildAndHistory
            projectPath={projectPath}
            chapters={chapters}
            entities={entities}
            characters={characters}
            projectConfig={projectConfig}
            onConfigUpdate={onConfigUpdate}
            calConfig={calConfig}
            onCalendarChanged={() => {
              window.api.getCalendarConfig(projectPath)
                .then(res => setCalConfig(res.config || {}))
                .catch(err => console.error("Failed to refresh calendar config:", err))
            }}
          />
        ) : mainView === 'entities' ? (
          <EntityManager
            projectPath={projectPath}
            chapters={chapters}
            entities={entities}
            characters={characters}
            projectConfig={projectConfig}
            onEntityUpdated={handleEntitiesChanged}
            onConfigUpdate={onConfigUpdate}
            onNavigate={(chapterId, wordOffset) => {
              setMainView('editor')
              handleNavigateToMark({ chapterId, wordOffset })
            }}
          />
        ) : mainView === 'stats' ? (
          <StatsDashboard
            projectPath={projectPath}
            chapters={chapters}
            entities={entities}
            characters={characters}
            projectConfig={projectConfig}
            onEntityUpdated={handleEntitiesChanged}
            onConfigUpdate={onConfigUpdate}
          />
        ) : mainView === 'planner' ? (
          <FleshNotePlannerDesktop
            projectPath={projectPath}
            chapters={chapters}
            activeChapter={activeChapter}
          />
        ) : (
          <>
            {/* ── LEFT PANEL ──────────────────────────── */}
            <div className={`panel-left ${focusMode ? 'collapsed' : ''}`}>
              <div className="panel-header">
                <div className="panel-header-title">
                  {leftPanelMode === 'chapters' ? (
                    <>
                      <Icons.BookOpen /> {t('ide.chaptersTitle', 'Chapters')}
                    </>
                  ) : leftPanelMode === 'twist' ? (
                    <>
                      <Icons.Layers /> {t('ide.twistInspectorTitle', 'Twist Inspector')}
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

                          <div
                            className={`chapter-status ${ch.status}`}
                            style={{ visibility: hoveredChapterId === ch.id ? 'hidden' : 'visible' }}
                          >
                            {t(`editor.status${ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}`, ch.status)}
                          </div>

                          {hoveredChapterId === ch.id && (
                            <div
                              style={{
                                display: 'flex',
                                gap: '4px',
                                position: 'absolute',
                                insetInlineEnd: '12px',
                                background: 'var(--bg-elevated)',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                zIndex: 10
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
                    projectConfig={projectConfig}
                    calConfig={calConfig}
                    chapters={chapters}
                    onEntityUpdated={handleEntitiesChanged}
                    onReloadCurrentChapter={() => { if (activeChapter) loadChapter(activeChapter) }}
                    onFlushEditorSave={async () => { await janitorActionsRef.current?.flushSave?.() }}
                    onConfigUpdate={onConfigUpdate}
                    initialTab={inspectorInitialTab}
                    onNavigateToMark={handleNavigateToMark}
                  />
                )}
                {leftPanelMode === 'twist' && inspectedTwistId && (
                  <TwistInspectorPanel
                    twistId={inspectedTwistId}
                    projectPath={projectPath}
                    characters={characters}
                    chapters={chapters}
                    onNavigateChapter={(ch) => loadChapter(ch)}
                    onTwistDeleted={async () => {
                      setInspectedTwistId(null)
                      setLeftPanelMode('inspector')
                      // Refresh twist ID list so editor can strip dead links
                      try {
                        const twistsData = await window.api.getTwists(projectPath)
                        setTwistIds((twistsData.twists || []).map(tw => tw.id))
                      } catch (e) { console.error('Failed to refresh twists', e) }
                      // Reload current chapter to reflect stripped markers
                      if (activeChapter) loadChapter(activeChapter)
                    }}
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
              <>
                <Editor
                  chapter={chapterContent}
                  onUpdate={handleEditorUpdate}
                  focusMode={focusMode}
                  onToggleFocus={toggleFocus}
                  characters={characters}
                  entities={entities}
                  twistIds={twistIds}
                  projectPath={projectPath}
                  projectConfig={projectConfig}
                  calConfig={calConfig}
                  chapters={chapters}
                  onChapterMetaUpdate={handleChapterMetaUpdate}
                  onEntityClick={handleEntityClick}
                  onTwistClick={handleTwistClick}
                  onEntitiesChanged={handleEntitiesChanged}
                  onConfigUpdate={onConfigUpdate}
                  scrollToWordOffset={scrollToWordOffset}
                  janitorActionsRef={janitorActionsRef}
                  onJanitorTrigger={focusMode ? null : triggerJanitorAnalysis}
                />
                {!focusMode && (
                  <JanitorPanel
                    suggestions={janitorSuggestions}
                    isLoading={janitorLoading}
                    isCollapsed={janitorCollapsed}
                    onToggle={() => {
                      const next = !janitorCollapsed
                      setJanitorCollapsed(next)
                      localStorage.setItem('fn_janitorCollapsed', next)
                    }}
                    onDismiss={handleJanitorDismiss}
                    onAccept={handleJanitorAccept}
                    onNavigate={(suggestion) => {
                      janitorActionsRef.current?.navigateToCharOffset(suggestion.char_offset, suggestion.matched_text || '')
                    }}
                    chapterId={activeChapter?.id}
                    projectPath={projectPath}
                    projectConfig={projectConfig}
                    autoFocusSignal={janitorFocusSignal}
                    onReturnFocus={() => janitorActionsRef.current?.focusEditor()}
                    onActivity={() => { janitorPanelActivityRef.current = Date.now() }}
                    hotkeys={ideHotkeys}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── STATUS BAR ─────────────────────────────── */}
      {showStatusBar && (
        <div className="status-bar">
          <div className="status-bar-item">
            <span style={{
              opacity: isSaving ? 1 : 0,
              transition: 'opacity 0.3s ease',
              color: 'var(--accent-amber)',
              fontWeight: 'bold'
            }}>
              {t('ide.saving', 'Saving...')}
            </span>
          </div>
          <div className="status-bar-right">
            <div className="status-bar-item">{t('ide.statusBarFormat', 'Markdown \u00b7 UTF-8')}</div>
          </div>
        </div>
      )}

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

      {/* ── WELCOME BACK WRITING PROMPT ───────────── */}
      {showWelcomeBack && (
        <WelcomeBackPrompt
          projectPath={projectPath}
          chapters={chapters}
          characters={characters}
          twistIds={twistIds}
          onClose={() => setShowWelcomeBack(false)}
          onEntitiesChanged={handleEntitiesChanged}
          onChapterModified={(chapterId) => {
            // Reload the active chapter if it matches, so the quicknote link appears
            if (activeChapter?.id === chapterId) {
              const ch = chapters.find(c => c.id === chapterId)
              if (ch) loadChapter(ch)
            }
          }}
        />
      )}

      {/* ── PROJECT SETTINGS MODAL ────────────────── */}
      <ProjectSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        projectPath={projectPath}
        onConfigUpdate={onConfigUpdate}
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
