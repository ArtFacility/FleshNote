import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import Mention from '@tiptap/extension-mention'
import { EntityLinkMark } from '../extensions/EntityLinkMark'
import { TwistLinkMark } from '../extensions/TwistLinkMark'
import { KnowledgeLinkMark } from '../extensions/KnowledgeLinkMark'
import { RelationshipLinkMark } from '../extensions/RelationshipLinkMark'
import { TimeLinkMark } from '../extensions/TimeLinkMark'
import { TodoHighlighter } from '../extensions/TodoHighlighter'
import { SearchAndReplace } from '../extensions/SearchAndReplace'
import EditorSearchBar from './EditorSearchBar'
import getSuggestionConfig from '../extensions/mentionSuggestion'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import EntityContextMenu from './EntityContextMenu'
import AppendDescriptionPopup from './AppendDescriptionPopup'
import MakeConnectionPopup from './MakeConnectionPopup'
import CustomLorePopup from './CustomLorePopup'
import ForeshadowingPopup from './ForeshadowingPopup'
import QuickNotePopup from './QuickNotePopup'
import AnnotationPopup from './AnnotationPopup'
import RelationshipTurningPointPopup from './RelationshipTurningPointPopup'
import TimeOverridePopup from './TimeOverridePopup'
import CalendarDatePicker from './CalendarDatePicker'
import AddAliasPopup from './AddAliasPopup'
import FocusSelectorPopup from './FocusSelectorPopup'
import DuplicateEntityPopup from './DuplicateEntityPopup'
import PartialMatchEntityPopup from './PartialMatchEntityPopup'
import HemingwayMode from './focus-modes/HemingwayMode'
import ComboMode from './focus-modes/ComboMode'
import ZenMode from './focus-modes/ZenMode'
import KamikazeMode from './focus-modes/KamikazeMode'
import FogMode from './focus-modes/FogMode'
import MomentumMode from './focus-modes/MomentumMode'
import SynonymPopup from './SynonymPopup'
import TimeGutter from './TimeGutter'
import { matchesHotkey } from '../utils/hotkeyMatcher'
import KarolyEasterEgg from './KarolyEasterEgg'
import EntityCommandPalette from './EntityCommandPalette'
import EntityHoverCard from './EntityHoverCard'
import { clearEntityHoverCaches } from '../utils/hoverCache'


// ── Inline SVG Icons ────────────────────────────────────────────────────────

const FormatIcons = {
  Bold: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  ),
  Italic: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  ),
  UnderlineIcon: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  ),
  Strikethrough: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 4H9a3 3 0 0 0-3 3v1c0 2 1.5 3 3 3h6a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H8" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  ClearFormat: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7V4h16v3" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// ── Status color helper ─────────────────────────────────────────────────────

function statusColor(status) {
  switch (status) {
    case 'revised':
    case 'final':
      return 'var(--accent-green)'
    case 'draft':
    case 'writing':
      return 'var(--accent-amber)'
    default:
      return 'var(--text-tertiary)'
  }
}


// ── Main Component ──────────────────────────────────────────────────────────

export default function Editor({
  chapter,
  onUpdate,
  focusMode, // { active: boolean, type: string, goal: number | null, startWordCount: number | null }
  onToggleFocus,
  onChapterMetaUpdate,
  projectPath,
  entities,
  twistIds,
  characters,
  chapters,
  onEntityClick,
  onTwistClick,
  onEntitiesChanged,
  projectConfig,
  calConfig,
  onConfigUpdate,
  scrollToWordOffset, // { wordOffset, timestamp } — triggers scroll to word position
  janitorActionsRef,  // ref that receives { navigateToCharOffset, linkEntityAtOffset, replaceAtOffset }
  onJanitorTrigger,   // called when 100-word boundary crossed or 10s idle
  onEffectiveTimeChange // called when cursor time changes
}) {
  const { t, i18n } = useTranslation()
  const saveTimeoutRef = useRef(null)

  const latestContentRef = useRef({ html: '', words: 0, isDirty: false })
  const onUpdateRef = useRef(onUpdate)
  const lastJanitorWordCountRef = useRef(0)
  const janitorInactivityTimerRef = useRef(null)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  // Expose flush method via janitorActionsRef (shared ref for editor actions)
  useEffect(() => {
    if (janitorActionsRef) {
      const prev = janitorActionsRef.current || {}
      janitorActionsRef.current = {
        ...prev,
        flushSave: async () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
            saveTimeoutRef.current = null
          }
          if (latestContentRef.current.isDirty && onUpdateRef.current) {
            await onUpdateRef.current(latestContentRef.current.html, latestContentRef.current.words)
            latestContentRef.current.isDirty = false
          }
        }
      }
    }
  }, [janitorActionsRef])

  useEffect(() => {
    return () => {
      // Flush any unsaved changes on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (latestContentRef.current.isDirty && onUpdateRef.current) {
        onUpdateRef.current(latestContentRef.current.html, latestContentRef.current.words)
        latestContentRef.current.isDirty = false
      }
    }
  }, [])

  // Search state: false | 'search' | 'replace'
  const [showSearch, setShowSearch] = useState(false)

  // Link visibility state
  const [showEyeDropdown, setShowEyeDropdown] = useState(false)
  const [linkVisibility, setLinkVisibility] = useState(() => {
    return projectConfig?.link_visibility || {
      character: true,
      location: true,
      lore: true,
      twist: true,
      quicknote: true,
      annotation: true,
      knowledge: true,
      relationship: true,
      spellcheck: true
    }
  })

  useEffect(() => {
    if (projectPath && linkVisibility) {
      window.api.updateProjectConfig(
        projectPath,
        'link_visibility',
        linkVisibility,
        'json'
      ).catch(err => console.error("Failed saving link visibility", err))
    }
  }, [linkVisibility, projectPath])

  // Track latest entities for Mention suggestion
  const entitiesRef = useRef(entities)
  useEffect(() => {
    entitiesRef.current = entities
    // Bust the hover-card icon/age cache so stale icons don't show after edits
    clearEntityHoverCaches()
  }, [entities])

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null)
  const [ctxText, setCtxText] = useState('')
  const [entityAtCursor, setEntityAtCursor] = useState(null)
  const [twistAtCursor, setTwistAtCursor] = useState(null)
  const [knowledgeAtCursor, setKnowledgeAtCursor] = useState(null)
  const [relationshipAtCursor, setRelationshipAtCursor] = useState(null)

  // Popup state — only one popup active at a time
  const [activePopup, setActivePopup] = useState(null)
  // activePopup = { type: 'appendDescription' | 'quickNote' | 'makeConnection' | 'customLore' | 'foreshadowing' | 'focusSelector', position, data }

  // Entity command palette state
  const [entityPalette, setEntityPalette] = useState(null) // { x, y, text }
  // Saved selection for hotkey-triggered popups (restored before applying marks)
  const savedSelectionRef = useRef(null) // { from, to } | null

  // Synonym popup state (context-menu-style, separate from modal-style activePopup)
  const [synonymState, setSynonymState] = useState(null)
  // synonymState = { word, position, groups: [], loading: bool, error: bool }
  const [typoSuggestions, setTypoSuggestions] = useState(null)
  // typoSuggestions = { word, suggestions: [] } | null
  const [showKaroly, setShowKaroly] = useState(false)


  // Configurable hotkeys from global config
  const [hotkeys, setHotkeys] = useState({ synonym_lookup: 'Alt+s', search: 'Ctrl+f', todo_marker: 'Alt+t', entity_palette: 'Alt+e', quick_note_popup: 'Alt+q', focus_normal: 'Alt+f' })
  useEffect(() => {
    window.api.getGlobalConfig().then(config => {
      if (config?.hotkeys) setHotkeys(config.hotkeys)
    })
    const onHotkeysChanged = (e) => setHotkeys(prev => ({ ...prev, ...e.detail }))
    window.addEventListener('fleshnote:hotkeys-changed', onHotkeysChanged)
    return () => window.removeEventListener('fleshnote:hotkeys-changed', onHotkeysChanged)
  }, [])

  // Hover card state
  const [hoverCard, setHoverCard] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  // Planner beats for current chapter
  const BEAT_COLORS = {
    beat: 'var(--accent-amber)', reveal: 'var(--accent-purple)',
    twist: 'var(--accent-red)', climax: 'var(--accent-blue)',
    development: 'var(--accent-purple)', change: 'var(--accent-red)',
    move: 'var(--accent-blue)',
  }
  const [chapterBeats, setChapterBeats] = useState([])
  const [gutterVisible, setGutterVisible] = useState(false)
  const [timeMarkers, setTimeMarkers] = useState([])
  const [activeTimeMarkerId, setActiveTimeMarkerId] = useState(null)
  const [gutterMeasureTick, setGutterMeasureTick] = useState(0)
  const editorColumnRef = useRef(null)
  const gutterMeasureTimeoutRef = useRef(null)

  useEffect(() => {
    if (!projectPath || !chapter?.id) { setTimeMarkers([]); return }
    window.api.getWorldTimes({ project_path: projectPath, chapter_id: chapter.id })
      .then(res => setTimeMarkers(res.markers || []))
      .catch(() => { })
  }, [projectPath, chapter?.id])

  const effectiveWorldTime = useMemo(() => {
    if (activeTimeMarkerId) {
      const m = timeMarkers.find(m => String(m.id) === String(activeTimeMarkerId))
      if (m) return m.world_date
    }
    return chapter?.world_time || ''
  }, [activeTimeMarkerId, timeMarkers, chapter?.world_time])

  useEffect(() => {
    onEffectiveTimeChange?.(effectiveWorldTime)
  }, [effectiveWorldTime, onEffectiveTimeChange])

  useEffect(() => {
    if (!projectPath || !chapter?.id) { setChapterBeats([]); return }
    window.api.loadPlanner(projectPath).then(res => {
      if (res?.status === 'ok') {
        const beats = (res.blocks || [])
          .filter(b => b.chapter_id === chapter.id && b.layer === 'surface')
          .sort((a, b) => a.pct - b.pct)
        setChapterBeats(beats)
      }
    }).catch(() => { })
  }, [projectPath, chapter?.id])

  const extensions = useMemo(() => [
    StarterKit.configure({
      codeBlock: false,
      blockquote: false
    }),
    Underline,
    Placeholder.configure({
      placeholder: t('editor.beginWriting', 'Begin writing...'),
      emptyEditorClass: 'is-editor-empty'
    }),
    CharacterCount,
    EntityLinkMark,
    TwistLinkMark,
    KnowledgeLinkMark,
    RelationshipLinkMark,
    TimeLinkMark,
    TodoHighlighter,
    SearchAndReplace,
    Mention.configure({
      suggestion: getSuggestionConfig(() => entitiesRef.current),
    })
  ], [t])

  const editor = useEditor({
    extensions,
    content: '',
    editorProps: {
      attributes: {
        class: `editor-area ${focusMode?.active && focusMode?.type === 'normal' ? 'focus-mode-active' : ''}`,
        dir: i18n.dir()
      },
      handleDOMEvents: {
          mouseover: (view, event) => {
            const entityTarget = event.target.closest('[data-entity-type]')
            const twistTarget = event.target.closest('[data-twist-id]')

            if (entityTarget) {
              const rect = entityTarget.getBoundingClientRect()
              const pos = view.posAtDOM(entityTarget, 0)
              const resolvedPos = view.state.doc.resolve(pos)
              const timeMark = resolvedPos.marks().find(m => m.type.name === 'timeLink')
              const timeId = timeMark?.attrs.timeId
              
              let hoverTime = chapter?.world_time || ''
              if (timeId) {
                const marker = timeMarkers.find(m => String(m.id) === String(timeId))
                if (marker) hoverTime = marker.world_date
              }

              setHoverPos({ x: rect.left, y: rect.bottom + 8 })
              setHoverCard({
                entityType: entityTarget.getAttribute('data-entity-type'),
                entityId: entityTarget.getAttribute('data-entity-id'),
                effectiveWorldTime: hoverTime
              })
            } else if (twistTarget) {
              const rect = twistTarget.getBoundingClientRect()
              setHoverPos({ x: rect.left, y: rect.bottom + 8 })
              setHoverCard({
                entityType: 'twist',
                twistId: twistTarget.getAttribute('data-twist-id'),
                twistType: twistTarget.getAttribute('data-twist-type'),
                isForeshadow: twistTarget.hasAttribute('data-foreshadow')
              })
            } else {
              setHoverCard(null)
            }
            return false
          },
        // Click on entity links or twist links opens inspector
        click: (_view, event) => {
          // Check knowledge links first
          const knowledgeTarget = event.target.closest('[data-knowledge-id]')
          if (knowledgeTarget) {
            const characterId = knowledgeTarget.getAttribute('data-character-id')
            if (characterId) {
              onEntityClick?.({ type: 'character', id: parseInt(characterId), tab: 'knowledge' })
            }
            return true
          }
          // Check relationship links
          const relTarget = event.target.closest('[data-relationship-id]')
          if (relTarget) {
            const characterId = relTarget.getAttribute('data-character-id')
            if (characterId) {
              onEntityClick?.({ type: 'character', id: parseInt(characterId), tab: 'relationships' })
            }
            return true
          }
          // Check twist links
          const twistTarget = event.target.closest('[data-twist-type]')
          if (twistTarget) {
            const twistType = twistTarget.getAttribute('data-twist-type')
            const twistId = twistTarget.getAttribute('data-twist-id')
            onTwistClick?.({ twistType, twistId: parseInt(twistId) })
            return true
          }
          // Then entity links
          const target = event.target.closest('[data-entity-type]')
          if (target) {
            const entityType = target.getAttribute('data-entity-type')
            const entityId = target.getAttribute('data-entity-id')

            if (entityType === 'annotation') {
              const rect = target.getBoundingClientRect()
              setActivePopup({
                type: 'annotationView',
                position: { x: rect.left, y: rect.bottom + 6 },
                data: { entityId, entityType }
              })
              return true
            }

            onEntityClick?.({ type: entityType, id: parseInt(entityId) })
            return true
          }
          return false
        },
        // Right-click context menu for entity creation
        contextmenu: (_view, event) => {
          const selection = window.getSelection()
          let text = selection ? selection.toString().trim() : ''

          if (!text && document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(event.clientX, event.clientY)
            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
              const rect = range.getBoundingClientRect()
              // If click is roughly inside the text
              selection.removeAllRanges()
              selection.addRange(range)
              selection.modify('move', 'backward', 'word')
              selection.modify('extend', 'forward', 'word')
              text = selection.toString().trim()
            }
          }

          if (text.length > 0) {
            event.preventDefault()
            setCtxText(text)
            setCtxMenu({ x: event.clientX, y: event.clientY })

            // Detect if right-click was on an entity link
            const target = event.target.closest('[data-entity-type]')
            if (target) {
              setEntityAtCursor({
                type: target.getAttribute('data-entity-type'),
                id: parseInt(target.getAttribute('data-entity-id'))
              })
            } else {
              setEntityAtCursor(null)
            }

            // Detect if right-click was on a twist/foreshadow link
            const twistTarget = event.target.closest('[data-twist-type]')
            if (twistTarget) {
              setTwistAtCursor({
                twistType: twistTarget.getAttribute('data-twist-type'),
                twistId: parseInt(twistTarget.getAttribute('data-twist-id'))
              })
            } else {
              setTwistAtCursor(null)
            }

            // Detect if right-click was on a knowledge link
            const knowledgeTarget = event.target.closest('[data-knowledge-id]')
            if (knowledgeTarget) {
              setKnowledgeAtCursor({
                knowledgeId: parseInt(knowledgeTarget.getAttribute('data-knowledge-id'))
              })
            } else {
              setKnowledgeAtCursor(null)
            }

            // Detect if right-click was on a relationship link
            const relTarget = event.target.closest('[data-relationship-id]')
            if (relTarget) {
              setRelationshipAtCursor({
                relationshipId: parseInt(relTarget.getAttribute('data-relationship-id'))
              })
            } else {
              setRelationshipAtCursor(null)
            }

            // Fetch typo suggestions for the right-clicked word (single word only)
            const singleWord = text.trim().split(/\s+/)
            if (singleWord.length === 1 && projectPath) {
              const word = singleWord[0].replace(/[^a-zA-ZÀ-ÿ\u0600-\u06FF\u0100-\u017E]/g, '')
              if (word.length >= 2) {
                window.api.spellCheck({ project_path: projectPath, word })
                  .then(res => {
                    if (res && !res.is_correct && res.suggestions.length > 0) {
                      setTypoSuggestions({ word, suggestions: res.suggestions })
                    } else {
                      setTypoSuggestions(null)
                    }
                  })
                  .catch(() => setTypoSuggestions(null))
              } else {
                setTypoSuggestions(null)
              }
            } else {
              setTypoSuggestions(null)
            }

            return true
          }
          return false
        }
      }
    },
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        const html = editor.getHTML()
        const words = editor.storage.characterCount.words()

        latestContentRef.current = { html, words, isDirty: true }

        saveTimeoutRef.current = setTimeout(() => {
          onUpdate(html, words)
          latestContentRef.current.isDirty = false
        }, 500)

        // Janitor: trigger at 100-word boundaries
        const prevBoundary = Math.floor(lastJanitorWordCountRef.current / 100)
        const currBoundary = Math.floor(words / 100)
        if (currBoundary > prevBoundary) {
          lastJanitorWordCountRef.current = words
          onJanitorTrigger?.()
        }
      }
      // Janitor: 10-second inactivity trigger
      if (janitorInactivityTimerRef.current) clearTimeout(janitorInactivityTimerRef.current)
      janitorInactivityTimerRef.current = setTimeout(() => onJanitorTrigger?.(), 10000)

      // Debounced gutter re-measure on content change
      if (gutterMeasureTimeoutRef.current) clearTimeout(gutterMeasureTimeoutRef.current)
      gutterMeasureTimeoutRef.current = setTimeout(() => setGutterMeasureTick(t => t + 1), 100)
    },
    onSelectionUpdate: ({ editor }) => {
      try {
        const { from } = editor.state.selection
        const resolvedPos = editor.state.doc.resolve(from)
        const timeMark = resolvedPos.marks().find(m => m.type.name === 'timeLink')
        setActiveTimeMarkerId(timeMark?.attrs.timeId || null)
      } catch (e) { /* ignore */ }
    },
  })

  // Update quicknote type on all matching marks when changed from inspector
  useEffect(() => {
    const handler = (e) => {
      const { noteId, noteType } = e.detail
      if (!editor) return
      editor.chain().command(({ tr, state }) => {
        state.doc.descendants((node, pos) => {
          node.marks.forEach(mark => {
            if (mark.type.name === 'entityLink' && mark.attrs.entityType === 'quicknote' && String(mark.attrs.entityId) === String(noteId)) {
              const newMark = mark.type.create({ ...mark.attrs, noteType })
              tr.addMark(pos, pos + node.nodeSize, newMark)
            }
          })
        })
        return true
      }).run()
    }
    window.addEventListener('fleshnote:quicknote-type-changed', handler)
    return () => window.removeEventListener('fleshnote:quicknote-type-changed', handler)
  }, [editor])

  // Keyboard shortcuts (configurable via global config)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (matchesHotkey(e, hotkeys.search)) {
        e.preventDefault()
        setShowSearch(prev => prev ? false : 'search')
        return
      }
      if (matchesHotkey(e, 'Ctrl+h')) {
        e.preventDefault()
        setShowSearch(prev => prev ? false : 'replace')
        return
      }
      if (matchesHotkey(e, hotkeys.synonym_lookup)) {
        e.preventDefault()
        triggerSynonymLookup()
        return
      }
      if (matchesHotkey(e, 'Ctrl+Alt+Shift+k') && i18n.language === 'hu') {
        e.preventDefault()
        setShowKaroly(true)
        return
      }
      // TODO marker
      if (matchesHotkey(e, hotkeys.todo_marker)) {
        e.preventDefault()
        if (editor) {
          editor.chain().focus().insertContent('#TODO ').run()
        }
        return
      }
      // Entity palette
      if (matchesHotkey(e, hotkeys.entity_palette)) {
        e.preventDefault()
        if (editor) {
          const { from, to } = editor.state.selection
          let selFrom = from, selTo = to, text = ''
          if (from !== to) {
            text = editor.state.doc.textBetween(from, to)
            selFrom = from; selTo = to
          } else {
            // find word boundaries at cursor
            const $pos = editor.state.doc.resolve(from)
            const nodeText = $pos.parent.textContent
            const offset = $pos.parentOffset
            let start = offset
            while (start > 0 && !/\s/.test(nodeText[start - 1])) start--
            let end = offset
            while (end < nodeText.length && !/\s/.test(nodeText[end])) end++
            text = nodeText.slice(start, end)
            const nodeStart = from - offset
            selFrom = nodeStart + start; selTo = nodeStart + end
          }
          // Select the word so TipTap knows what to mark
          if (selFrom !== selTo) {
            editor.chain().setTextSelection({ from: selFrom, to: selTo }).run()
          }
          savedSelectionRef.current = { from: selFrom, to: selTo }
          const coords = editor.view.coordsAtPos(selFrom)
          setEntityPalette({ x: coords.left, y: coords.bottom + 4, text })
        }
        return
      }
      // Quick note popup from hotkey
      if (matchesHotkey(e, hotkeys.quick_note_popup)) {
        e.preventDefault()
        if (editor) {
          const { from, to } = editor.state.selection
          let selFrom = from, selTo = to, text = ''
          if (from !== to) {
            text = editor.state.doc.textBetween(from, to)
          } else {
            // select word under cursor
            const $pos = editor.state.doc.resolve(from)
            const nodeText = $pos.parent.textContent
            const offset = $pos.parentOffset
            let start = offset
            while (start > 0 && !/\s/.test(nodeText[start - 1])) start--
            let end = offset
            while (end < nodeText.length && !/\s/.test(nodeText[end])) end++
            text = nodeText.slice(start, end)
            const nodeStart = from - offset
            selFrom = nodeStart + start; selTo = nodeStart + end
            if (selFrom !== selTo) {
              editor.chain().setTextSelection({ from: selFrom, to: selTo }).run()
            }
          }
          savedSelectionRef.current = { from: selFrom, to: selTo }
          const coords = editor.view.coordsAtPos(selFrom)
          setActivePopup({ type: 'quickNote', position: { x: coords.left, y: coords.bottom + 4 }, data: { text } })
        }
        return
      }
      // Focus normal mode toggle
      if (matchesHotkey(e, hotkeys.focus_normal)) {
        e.preventDefault()
        if (focusMode?.active) {
          onToggleFocus(null)
        } else {
          onToggleFocus({ active: true, type: 'normal', goal: null, startWordCount: editor ? editor.storage.characterCount.words() : 0 })
        }
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [hotkeys, editor, focusMode, onToggleFocus])

  // Clear search highlights when search bar is closed
  useEffect(() => {
    if (!showSearch && editor) {
      editor.commands.clearSearch()
    }
  }, [showSearch, editor])

  // When chapter changes (or is reloaded from disk), load new content
  useEffect(() => {
    if (editor && chapter?.content !== undefined) {
      editor.commands.setContent(chapter.content || '')
    }
  }, [editor, chapter?.id, chapter?._rev])

  // Cleanup dead links when entities update (e.g. deletion)
  useEffect(() => {
    if (!editor || !entities) return
    const tm = setTimeout(() => {
      let needsUpdate = false
      const { state, view } = editor
      let tr = state.tr

      state.doc.descendants((node, pos) => {
        if (node.marks) {
          node.marks.forEach((mark) => {
            if (mark.type.name === 'entityLink') {
              const id = mark.attrs.entityId
              const type = mark.attrs.entityType
              const exists = entities.some((e) => String(e.id) === String(id) && e.type === type)
              if (!exists) {
                tr = tr.removeMark(pos, pos + node.nodeSize, mark.type)
                needsUpdate = true
              }
            }
          })
        }
      })

      if (needsUpdate && !view.isDestroyed) {
        view.dispatch(tr)
      }
    }, 300)
    return () => clearTimeout(tm)
  }, [editor, entities])

  // Cleanup dead twist/foreshadow links when twistIds update or chapter loads
  useEffect(() => {
    if (!editor || !twistIds) return
    const tm = setTimeout(() => {
      let needsUpdate = false
      const { state, view } = editor
      let tr = state.tr

      state.doc.descendants((node, pos) => {
        if (node.marks) {
          node.marks.forEach((mark) => {
            if (mark.type.name === 'twistLink') {
              const id = mark.attrs.twistId
              const exists = twistIds.some((tid) => String(tid) === String(id))
              if (!exists) {
                tr = tr.removeMark(pos, pos + node.nodeSize, mark.type)
                needsUpdate = true
              }
            }
          })
        }
      })

      if (needsUpdate && !view.isDestroyed) {
        view.dispatch(tr)
      }
    }, 300)
    return () => clearTimeout(tm)
  }, [editor, twistIds])

  // Update TipTap layout direction based on active language
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dom.setAttribute('dir', i18n.dir())
    }
  }, [editor, i18n.language])

  // Toggle native browser spellcheck based on visibility setting
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dom.setAttribute('spellcheck', linkVisibility.spellcheck !== false ? 'true' : 'false')
    }
  }, [editor, linkVisibility.spellcheck])

  // Scroll to word offset when requested (from inspector navigation)
  useEffect(() => {
    if (!editor || !scrollToWordOffset || !scrollToWordOffset.wordOffset) return

    // Walk the document to find the text position at the given word offset
    const targetOffset = scrollToWordOffset.wordOffset
    let wordCount = 0
    let targetPos = null

    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false // already found
      if (node.isText) {
        const words = node.text.split(/\s+/).filter(w => w.length > 0)
        for (let i = 0; i < words.length; i++) {
          wordCount++
          if (wordCount >= targetOffset) {
            targetPos = pos
            return false
          }
        }
      }
    })

    if (targetPos !== null) {
      // Set selection and scroll into view
      setTimeout(() => {
        editor.commands.setTextSelection(targetPos)
        editor.commands.scrollIntoView()

        // Brief highlight flash via a temporary CSS class
        const domPos = editor.view.domAtPos(targetPos)
        if (domPos && domPos.node) {
          const el = domPos.node.nodeType === Node.TEXT_NODE ? domPos.node.parentElement : domPos.node
          if (el) {
            el.style.transition = 'background 0.3s'
            el.style.background = 'rgba(196, 167, 76, 0.3)'
            setTimeout(() => {
              el.style.background = ''
            }, 2000)
          }
        }
      }, 100)
    }
  }, [editor, scrollToWordOffset])

  // ── Janitor actions ref population ──────────────────
  useEffect(() => {
    if (!janitorActionsRef) return

    janitorActionsRef.current = {
      navigateToCharOffset(charOffset, matchedText = '') {
        if (!editor || editor.isDestroyed) return
        let plain = 0
        let approxPos = null
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText) return
          const end = plain + node.text.length
          if (charOffset >= plain && charOffset <= end && approxPos === null) {
            approxPos = pos + Math.min(charOffset - plain, node.text.length)
          }
          plain = end
        })
        if (approxPos === null) return

        let targetFrom = approxPos
        let targetTo = approxPos + (matchedText ? matchedText.length : 0)

        if (matchedText) {
          const radius = 40
          const searchFrom = Math.max(0, approxPos - radius)
          const searchTo = Math.min(editor.state.doc.content.size, approxPos + matchedText.length + radius)
          let foundFrom = null
          let foundTo = null
          editor.state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
            if (foundFrom !== null) return false
            if (!node.isText) return
            const nodeFrom = Math.max(0, searchFrom - pos)
            const slice = node.text.slice(nodeFrom)
            const idx = slice.toLowerCase().indexOf(matchedText.toLowerCase())
            if (idx !== -1) {
              foundFrom = pos + nodeFrom + idx
              foundTo = foundFrom + matchedText.length
            }
          })
          if (foundFrom !== null) {
            targetFrom = foundFrom
            targetTo = foundTo
          }
        }

        setTimeout(() => {
          editor.commands.focus()
          if (matchedText && targetTo > targetFrom) {
            editor.commands.setTextSelection({ from: targetFrom, to: targetTo })
          } else {
            editor.commands.setTextSelection(targetFrom)
          }
          editor.commands.scrollIntoView()
        }, 100)
      },
      linkEntityAtOffset(charOffset, matchedText, entityType, entityId) {
        if (!editor || editor.isDestroyed) return
        // Walk text nodes to find approximate TipTap position
        let plain = 0
        let approxPos = null
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText) return
          const end = plain + node.text.length
          if (charOffset >= plain && charOffset <= end && approxPos === null) {
            approxPos = pos + Math.min(charOffset - plain, node.text.length)
          }
          plain = end
        })
        if (approxPos === null) return
        // Search for matchedText in a window around approxPos (handles minor offset drift)
        const radius = 40
        const searchFrom = Math.max(0, approxPos - radius)
        const searchTo = Math.min(editor.state.doc.content.size, approxPos + matchedText.length + radius)
        let foundFrom = null
        let foundTo = null
        editor.state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
          if (foundFrom !== null) return false
          if (!node.isText) return
          // Skip nodes already carrying an entityLink mark
          if (node.marks.some(m => m.type.name === 'entityLink')) return
          const nodeFrom = Math.max(0, searchFrom - pos)
          const slice = node.text.slice(nodeFrom)
          const idx = slice.toLowerCase().indexOf(matchedText.toLowerCase())
          if (idx !== -1) {
            foundFrom = pos + nodeFrom + idx
            foundTo = foundFrom + matchedText.length
          }
        })
        if (foundFrom !== null) {
          editor.chain()
            .setTextSelection({ from: foundFrom, to: foundTo })
            .setEntityLink({ entityType, entityId })
            .run()
        }
      },
      replaceAtOffset(charOffset, matchedText, replacement) {
        if (!editor || editor.isDestroyed) return
        let plain = 0
        let approxPos = null
        editor.state.doc.descendants((node, pos) => {
          if (!node.isText) return
          const end = plain + node.text.length
          if (charOffset >= plain && charOffset <= end && approxPos === null) {
            approxPos = pos + Math.min(charOffset - plain, node.text.length)
          }
          plain = end
        })
        if (approxPos === null) return
        const radius = 40
        const searchFrom = Math.max(0, approxPos - radius)
        const searchTo = Math.min(editor.state.doc.content.size, approxPos + matchedText.length + radius)
        let foundFrom = null
        let foundTo = null
        editor.state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
          if (foundFrom !== null) return false
          if (!node.isText) return
          const nodeFrom = Math.max(0, searchFrom - pos)
          const slice = node.text.slice(nodeFrom)
          const idx = slice.toLowerCase().indexOf(matchedText.toLowerCase())
          if (idx !== -1) {
            foundFrom = pos + nodeFrom + idx
            foundTo = foundFrom + matchedText.length
          }
        })
        if (foundFrom !== null) {
          editor.chain()
            .setTextSelection({ from: foundFrom, to: foundTo })
            .insertContent(replacement)
            .run()
        }
      },
      focusEditor() {
        if (!editor || editor.isDestroyed) return
        editor.commands.focus()
      }
    }
  }, [editor, janitorActionsRef])

  // ── Context menu handlers ───────────────────────────

  const closeContextMenu = useCallback(() => {
    setCtxMenu(null)
    setCtxText('')
    setEntityAtCursor(null)
    setKnowledgeAtCursor(null)
    setRelationshipAtCursor(null)
    setTypoSuggestions(null)
  }, [])

  const handleCreateEntity = useCallback(
    async (type, force = false, textToCreate = ctxText) => {
      if (!editor || !projectPath || !textToCreate) return

      if (['character', 'location', 'lore'].includes(type) && !force) {
        const textLower = textToCreate.toLowerCase().trim()
        const existingEntities = entities.filter(e => e.type === type)

        const exactMatch = existingEntities.find(e =>
          e.name?.toLowerCase().trim() === textLower ||
          (e.aliases && e.aliases.some(a => a.toLowerCase().trim() === textLower))
        )

        if (exactMatch) {
          setActivePopup({
            type: 'duplicateEntityExact',
            position: ctxMenu || { x: 300, y: 300 },
            data: { text: textToCreate, match: exactMatch, entityType: type }
          })
          closeContextMenu()
          return
        }

        if (textLower.length > 3) {
          const partialMatch = existingEntities.find(e => {
            const nameLower = e.name?.toLowerCase().trim() || ''
            if (nameLower.includes(textLower) || textLower.includes(nameLower)) return true
            if (e.aliases) {
              return e.aliases.some(a => {
                const aLower = a.toLowerCase().trim()
                return aLower.includes(textLower) || textLower.includes(aLower)
              })
            }
            return false
          })

          if (partialMatch) {
            setActivePopup({
              type: 'duplicateEntityPartial',
              position: ctxMenu || { x: 300, y: 300 },
              data: { text: textToCreate, match: partialMatch, entityType: type }
            })
            closeContextMenu()
            return
          }
        }
      }

      try {
        let result
        if (type === 'character') {
          result = await window.api.createCharacter({
            project_path: projectPath,
            name: textToCreate
          })
          result = { ...result.character, type: 'character' }
        } else if (type === 'location') {
          result = await window.api.createLocation({
            project_path: projectPath,
            name: textToCreate
          })
          result = { ...result.location, type: 'location' }
        } else if (type === 'lore') {
          result = await window.api.createLoreEntity({
            project_path: projectPath,
            name: textToCreate,
            category: 'item'
          })
          result = { ...result.entity, type: 'lore' }
        }

        if (result) {
          // Send an update stat ping!
          window.api.updateStat({
            project_path: projectPath,
            stat_key: 'new_entities',
            increment_by: 1
          });

          editor
            .chain()
            .focus()
            .setEntityLink({
              entityType: result.type,
              entityId: String(result.id)
            })
            .run()

          onEntitiesChanged?.()
        }
      } catch (err) {
        console.error('Failed to create entity:', err)
      }

      savedSelectionRef.current = null
      closeContextMenu()
    },
    [editor, projectPath, ctxText, closeContextMenu, onEntitiesChanged]
  )

  const handleLinkEntity = useCallback(
    (entity) => {
      if (!editor) return

      const chain = editor.chain().focus()
      if (savedSelectionRef.current) {
        chain.setTextSelection(savedSelectionRef.current)
        savedSelectionRef.current = null
      }
      chain.setEntityLink({ entityType: entity.type, entityId: String(entity.id) }).run()

      closeContextMenu()
    },
    [editor, closeContextMenu]
  )

  // ── Action handler (from context menu) ────────────────

  const handleAction = useCallback(
    (actionType, data) => {
      const pos = ctxMenu || { x: 300, y: 300 }

      switch (actionType) {
        case 'appendDescription':
          setActivePopup({ type: 'appendDescription', position: pos, data })
          break

        case 'quickNote':
          setActivePopup({ type: 'quickNote', position: pos, data })
          break

        case 'annotation':
          setActivePopup({ type: 'annotation', position: pos, data })
          break

        case 'makeConnection':
          setActivePopup({ type: 'makeConnection', position: pos, data })
          break

        case 'timeOverride':
          setActivePopup({ type: 'timeOverride', position: pos, data })
          break

        case 'relationshipTurningPoint': {
          let wordOffset = 0
          if (editor) {
            const selectionFrom = editor.state.selection.from
            const textBefore = editor.state.doc.textBetween(0, selectionFrom, ' ')
            wordOffset = textBefore.trim().split(/\s+/).filter(w => w.length > 0).length
          }
          setActivePopup({ type: 'relationshipTurningPoint', position: pos, data: { ...data, wordOffset } })
          break
        }

        case 'customLore':
          setActivePopup({ type: 'customLore', position: pos, data })
          break

        case 'foreshadowing':
          setActivePopup({ type: 'foreshadowing', position: pos, data })
          break

        case 'twistReveal':
          setActivePopup({ type: 'twistReveal', position: pos, data })
          break

        case 'addAliasSearch':
          setActivePopup({ type: 'addAliasSearch', position: pos, data })
          break

        case 'addAliasDirect': {
          const attachAlias = async () => {
            try {
              const result = await window.api.addEntityAlias({
                project_path: projectPath,
                entity_type: data.entity.type,
                entity_id: data.entity.id,
                alias: data.text
              })
              if (result && result.status === 'ok') {
                editor
                  .chain()
                  .focus()
                  .setEntityLink({
                    entityType: data.entity.type,
                    entityId: String(data.entity.id)
                  })
                  .run()
                onEntitiesChanged?.()
              }
            } catch (err) {
              console.error('Failed to add direct alias', err)
            }
          }
          attachAlias()
          break
        }

        case 'setAsPov':
          if (data?.entityId) {
            onChapterMetaUpdate?.({ pov_character_id: data.entityId })
          }
          break

        case 'removeLink':
          if (editor) {
            editor.chain().focus().unsetEntityLink().run()
          }
          break

        case 'removeTwistLink':
          if (editor) {
            editor.chain().focus().unsetTwistLink().run()
          }
          break

        case 'removeKnowledgeLink':
          if (editor) {
            editor.chain().focus().unsetKnowledgeLink().run()
          }
          break

        case 'removeRelationshipLink':
          if (editor) {
            editor.chain().focus().unsetRelationshipLink().run()
          }
          break

        default:
          break
      }

      closeContextMenu()
    },
    [ctxMenu, editor, closeContextMenu, onChapterMetaUpdate]
  )

  const closePopup = useCallback(() => {
    setActivePopup(null)
  }, [])

  // ── Synonym lookup ──────────────────────────────────────

  // Map story language codes to WordNet language codes
  const WORDNET_LANG_MAP = { en: 'eng', pl: 'pol', hu: 'hun', ar: 'ara' }

  const triggerSynonymLookup = useCallback(() => {
    if (!editor) return

    const { from, to, empty } = editor.state.selection
    let word = ''

    if (!empty) {
      word = editor.state.doc.textBetween(from, to, ' ').trim()
    } else {
      // Expand to word boundaries
      const $pos = editor.state.doc.resolve(from)
      const textBefore = $pos.parent.textBetween(0, $pos.parentOffset)
      const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size)
      const beforeMatch = textBefore.match(/\w+$/)
      const afterMatch = textAfter.match(/^\w+/)
      word = (beforeMatch ? beforeMatch[0] : '') + (afterMatch ? afterMatch[0] : '')
    }

    if (!word) return

    // Get cursor screen position for popup placement
    const coords = editor.view.coordsAtPos(from)
    const position = { x: coords.left, y: coords.bottom + 4 }

    // Determine WordNet language from project config
    const storyLang = projectConfig?.story_language || 'en'
    const wnLang = WORDNET_LANG_MAP[storyLang] || 'eng'

    setSynonymState({ word, position, groups: [], loading: true, error: false })

    window.api
      .synonymLookup({ word, lang: wnLang })
      .then((result) => {
        if (result?.status === 'ok') {
          setSynonymState((prev) =>
            prev ? { ...prev, groups: result.groups || [], loading: false } : null
          )
        }
      })
      .catch((err) => {
        console.error('Synonym lookup failed:', err)
        setSynonymState((prev) =>
          prev ? { ...prev, loading: false, error: true } : null
        )
      })
  }, [editor, projectConfig])

  const handleSynonymSelect = useCallback(
    (synonym) => {
      if (!editor) return

      const { from, to, empty } = editor.state.selection
      if (!empty) {
        // Replace the current selection
        editor.chain().focus().deleteSelection().insertContent(synonym).run()
      } else {
        // Select the word at cursor, then replace
        const $pos = editor.state.doc.resolve(from)
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset)
        const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size)
        const beforeMatch = textBefore.match(/\w+$/)
        const afterMatch = textAfter.match(/^\w+/)
        const wordStart = from - (beforeMatch ? beforeMatch[0].length : 0)
        const wordEnd = from + (afterMatch ? afterMatch[0].length : 0)

        editor
          .chain()
          .focus()
          .setTextSelection({ from: wordStart, to: wordEnd })
          .deleteSelection()
          .insertContent(synonym)
          .run()
      }

      setSynonymState(null)
    },
    [editor]
  )

  // ── Custom lore creation callback ─────────────────────

  const handleCustomLoreCreated = useCallback(
    (entity) => {
      if (!editor || !entity) return

      editor
        .chain()
        .focus()
        .setEntityLink({
          entityType: 'lore',
          entityId: String(entity.id)
        })
        .run()

      onEntitiesChanged?.()
    },
    [editor, onEntitiesChanged]
  )

  const handleQuickNoteCreated = useCallback(
    (note) => {
      if (!editor || !note) return

      const chain = editor.chain().focus()
      if (savedSelectionRef.current) {
        chain.setTextSelection(savedSelectionRef.current)
        savedSelectionRef.current = null
      }
      chain.setEntityLink({ entityType: 'quicknote', entityId: String(note.id), noteType: note.note_type || 'Note' }).run()

      onEntitiesChanged?.()
    },
    [editor, onEntitiesChanged]
  )

  const handleAnnotationCreated = useCallback(
    (annotation) => {
      if (!editor || !annotation) return

      editor
        .chain()
        .focus()
        .setEntityLink({
          entityType: 'annotation',
          entityId: String(annotation.id)
        })
        .run()

      onEntitiesChanged?.()
    },
    [editor, onEntitiesChanged]
  )

  const handleAliasCreated = useCallback(
    (entity) => {
      if (!editor || !entity) return

      editor
        .chain()
        .focus()
        .setEntityLink({
          entityType: entity.type,
          entityId: String(entity.id)
        })
        .run()

      onEntitiesChanged?.()
    },
    [editor, onEntitiesChanged]
  )

  // ── Empty state ─────────────────────────────────────

  if (!editor || !chapter) {
    return (
      <div className="panel-middle">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px'
          }}
        >
          {t('editor.selectChapterPrompt', 'Select a chapter to begin writing...')}
        </div>
      </div>
    )
  }

  const wordCount = editor.storage.characterCount.words()
  const targetWords = chapter.target_word_count || 4000
  const chapterStatus = chapter.status || 'planned'

  let remainingWords = null;
  let canExitFocus = true;

  if (focusMode?.active && focusMode.goal && focusMode.startWordCount !== undefined) {
    const wordsWritten = wordCount - focusMode.startWordCount;
    remainingWords = Math.max(0, focusMode.goal - wordsWritten);
    if (remainingWords > 0) {
      canExitFocus = false;
    }
  }

  return (
    <div className="panel-middle">
      {/* ── Metadata Toolbar (POV, Status, Word Count) ────── */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-group">
          <span className="editor-toolbar-label">{t('editor.povLabel', 'POV:')}</span>
          <select
            className="editor-toolbar-select character"
            value={chapter.pov_character_id || ''}
            onChange={(e) => {
              const val = e.target.value
              onChapterMetaUpdate?.({
                pov_character_id: val ? parseInt(val) : 0
              })
            }}
          >
            <option value="">{t('editor.noPov', 'No POV')}</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <span className="editor-toolbar-label">{t('editor.statusLabel', 'STATUS:')}</span>
          <select
            className="editor-toolbar-select"
            value={chapterStatus}
            style={{ color: statusColor(chapterStatus) }}
            onChange={(e) => {
              const newStatus = e.target.value
              const updates = { status: newStatus }
              if (newStatus === 'final') {
                updates.target_word_count = wordCount
              }
              onChapterMetaUpdate?.(updates)
            }}
          >
            <option value="planned">{t('editor.statusPlanned', 'Planned')}</option>
            <option value="writing">{t('editor.statusWriting', 'Writing')}</option>
            <option value="draft">{t('editor.statusDraft', 'Draft')}</option>
            <option value="revised">{t('editor.statusRevised', 'Revised')}</option>
            <option value="final">{t('editor.statusFinal', 'Final')}</option>
          </select>
        </div>

        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <span className="editor-toolbar-label">{t('editor.timeLabel', 'TIME:')}</span>
          <CalendarDatePicker
            value={chapter.world_time || ''}
            onChange={(v) => onChapterMetaUpdate?.({ world_time: v })}
            calConfig={calConfig}
            projectPath={projectPath}
            compact={true}
            placeholder={t('editor.worldTimePlaceholder', 'World time...')}
          />
        </div>

        <div className="editor-toolbar-right">
          <div className="editor-wordcount" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>
              <strong>{wordCount.toLocaleString()}</strong> /
              <input
                className="editor-target-words"
                type="number"
                value={chapter.target_word_count || ''}
                onChange={(e) =>
                  onChapterMetaUpdate?.({ target_word_count: parseInt(e.target.value) || 0 })
                }
                title={t('editor.targetWordsTooltip', 'Target Word Count')}
              />
              {t('editor.wordsContext', 'words')}
            </span>
            {remainingWords !== null && (
              <span style={{ color: remainingWords > 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 'bold', marginLeft: '8px' }}>
                ({remainingWords > 0 ? `-${remainingWords} to goal` : 'Goal Met!'})
              </span>
            )}
          </div>
          <button
            className={`focus-btn ${focusMode?.active ? 'active' : ''}`}
            onClick={() => {
              if (focusMode?.active) {
                if (canExitFocus) {
                  // SPRINT COMPLETED: Calculate velocity and log success!
                  if (focusMode.goal && focusMode.startTime) {
                    const elapsedMs = Date.now() - focusMode.startTime;
                    const elapsedMinutes = elapsedMs / 60000;
                    const wordsWritten = wordCount - focusMode.startWordCount;

                    // Only track velocity if they actually spent at least 1 minute writing
                    if (elapsedMinutes > 1 && wordsWritten > 0) {
                      const wpm = Math.round(wordsWritten / elapsedMinutes);
                      window.api.updateStat({ project_path: projectPath, stat_key: 'sprint_velocity_sum', increment_by: wpm });
                      window.api.updateStat({ project_path: projectPath, stat_key: 'sprint_velocity_count', increment_by: 1 });
                    }
                    window.api.updateStat({ project_path: projectPath, stat_key: 'sprints_completed', increment_by: 1 });

                    // Easter egg stats
                    if (focusMode.id === 'zen' && wordsWritten >= 400) {
                      window.api.updateStat({ project_path: projectPath, stat_key: 'zen_sprints_400', increment_by: 1 });
                    }
                    if (focusMode.id === 'hemingway' && wordsWritten >= 1000) {
                      window.api.updateStat({ project_path: projectPath, stat_key: 'hemingway_sprints_1000', increment_by: 1 });
                    }
                  }

                  // Clear the recovery token
                  window.api.updateProjectConfig(projectPath, 'active_sprint', '', 'string');
                  onToggleFocus(null) // Exit focus mode
                } else {
                  // Provide feedback that they can't exit yet? Could add a toast later.
                }
              } else {
                setActivePopup({ type: 'focusSelector' })
              }
            }}
            disabled={!canExitFocus}
            style={!canExitFocus ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            title={!canExitFocus ? t('editor.focusExitDisabled', 'Complete word goal to exit') : undefined}
          >
            {focusMode?.active ? t('editor.exitFocus', 'Exit Focus') : t('editor.focusBtn', 'Focus')}
          </button>
        </div>
      </div>


      {/* ── Formatting Toolbar ────────────────────────────── */}
      <div className="editor-format-toolbar">
        <button
          className={`format-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={t('editor.boldTooltip', 'Bold (Ctrl+B)')}
        >
          <FormatIcons.Bold />
        </button>
        <button
          className={`format-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={t('editor.italicTooltip', 'Italic (Ctrl+I)')}
        >
          <FormatIcons.Italic />
        </button>
        <button
          className={`format-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title={t('editor.underlineTooltip', 'Underline (Ctrl+U)')}
        >
          <FormatIcons.UnderlineIcon />
        </button>
        <button
          className={`format-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title={t('editor.strikethroughTooltip', 'Strikethrough')}
        >
          <FormatIcons.Strikethrough />
        </button>
        <div className="editor-toolbar-divider" />
        <button
          className="format-btn"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title={t('editor.clearFormatting', 'Clear Formatting')}
        >
          <FormatIcons.ClearFormat />
        </button>

        <div className="editor-toolbar-divider" style={{ margin: '0 4px' }} />

        {/* Visibility Toggle Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className={`format-btn ${showEyeDropdown ? 'active' : ''}`}
            onClick={() => setShowEyeDropdown(!showEyeDropdown)}
            title={t('editor.toggleLinksTooltip', 'Highlight Options')}
          >
            <FormatIcons.Eye />
          </button>
          {showEyeDropdown && (
            <div
              className="popup-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '180px',
                zIndex: 50,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {[
                { key: 'character', label: t('editor.visCharacter', 'Characters') },
                { key: 'location', label: t('editor.visLocation', 'Locations') },
                { key: 'lore', label: t('editor.visLore', 'Items & Lore') },
                { key: 'twist', label: t('editor.visTwist', 'Twists & Foreshadows') },
                { key: 'quicknote', label: t('editor.visQuicknote', 'Quick Notes') },
                { key: 'annotation', label: t('editor.visAnnotation', 'Annotations') },
                { key: 'knowledge', label: t('editor.visKnowledge', 'Knowledge Markers') },
                { key: 'relationship', label: t('editor.visRelationship', 'Relationship Markers') },
                { key: 'spellcheck', label: t('editor.visSpellcheck', 'Spell Check Underlines') }
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={linkVisibility[item.key]}
                    onChange={(e) => setLinkVisibility(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-amber)' }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="editor-toolbar-divider" style={{ margin: '0 4px' }} />
        <button
          className={`format-btn ${gutterVisible ? 'active' : ''}`}
          onClick={() => setGutterVisible(v => !v)}
          title="Toggle Timeline Gutter"
          style={{ fontFamily: 'inherit', fontSize: '14px', lineHeight: 1 }}
        >
          𐲎
        </button>
      </div>

      {/* ── Focus Mode Overlays ────────────────────────────── */}
      {focusMode?.active && focusMode.type === 'momentum' && <MomentumMode editor={editor} />}
      {focusMode?.active && focusMode.type === 'hemingway' && <HemingwayMode editor={editor} />}
      {focusMode?.active && focusMode.type === 'combo' && <ComboMode editor={editor} projectPath={projectPath} />}
      {focusMode?.active && focusMode.type === 'zen' && (
        <ZenMode
          currentWords={editor.storage.characterCount.words()}
          currentChars={editor.storage.characterCount.characters()}
          startWordCount={focusMode.startWordCount}
          targetWordCount={focusMode.startWordCount + focusMode.goal}
        />
      )}
      {focusMode?.active && focusMode.type === 'kamikaze' && (
        <KamikazeMode editor={editor} />
      )}
      {focusMode?.active && focusMode.type === 'fog' && (
        <FogMode editor={editor} />
      )}

      {/* ── Scrollable Editor Content ─────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

        {/* Search & Replace Bar */}
        {showSearch && (
          <EditorSearchBar
            editor={editor}
            initialMode={showSearch}
            onClose={() => setShowSearch(false)}
          />
        )}

        <div
          className={`editor-content-wrapper ${!linkVisibility.character ? 'hide-character-links' : ''} ${!linkVisibility.location ? 'hide-location-links' : ''} ${!linkVisibility.lore ? 'hide-lore-links' : ''} ${!linkVisibility.twist ? 'hide-twist-links' : ''} ${!linkVisibility.quicknote ? 'hide-quicknote-links' : ''} ${!linkVisibility.annotation ? 'hide-annotation-links' : ''} ${!linkVisibility.knowledge ? 'hide-knowledge-links' : ''} ${!linkVisibility.relationship ? 'hide-relationship-links' : ''}`}
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'row'
          }}
        >
          {gutterVisible && chapter?.id && (
            <TimeGutter
              markers={timeMarkers}
              onMarkersChange={setTimeMarkers}
              projectPath={projectPath}
              chapterId={chapter.id}
              calConfig={calConfig}
              editorColumnRef={editorColumnRef}
              measureTick={gutterMeasureTick}
              onRemoveById={(id) => editor?.commands.removeTimeLinkById(id)}
              onUpdateColorById={(id, ci) => editor?.commands.updateTimeLinkColorById(id, ci)}
            />
          )}
          <div
            ref={editorColumnRef}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: focusMode ? `0 ${projectConfig?.editor_padding || '15%'}` : '0',
            }}
          >
            <div className="editor-chapter-heading" style={{ padding: '40px 64px 0' }}>
              {t('editor.chapterPrefix', 'Chapter ')}{chapter.chapter_number}
            </div>
            <div className="editor-chapter-title" style={{ padding: '0 64px', marginBottom: '0' }}>
              <input
                type="text"
                value={chapter.title || ''}
                placeholder={`${t('editor.chapterPrefix', 'Chapter ')}${chapter.chapter_number}`}
                onChange={(e) => onChapterMetaUpdate?.({ title: e.target.value })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'bold',
                  width: '100%',
                  outline: 'none',
                  padding: '0'
                }}
              />
            </div>
            {chapterBeats.length > 0 && (
              <div style={{
                padding: '6px 64px 0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginRight: '2px',
                }}>Beats</span>
                {chapterBeats.map(beat => (
                  <span key={beat.id} title={`${beat.block_type} · ${Math.round(beat.pct)}%`} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    padding: '2px 6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: BEAT_COLORS[beat.block_type] || 'var(--accent-amber)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>
                    {beat.label}
                  </span>
                ))}
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────── */}
      <EntityContextMenu
        position={ctxMenu}
        selectedText={ctxText}
        entities={entities}
        onClose={closeContextMenu}
        onCreateEntity={handleCreateEntity}
        onLinkEntity={handleLinkEntity}
        onAction={handleAction}
        entityAtCursor={entityAtCursor}
        twistAtCursor={twistAtCursor}
        knowledgeAtCursor={knowledgeAtCursor}
        relationshipAtCursor={relationshipAtCursor}
        typoSuggestions={typoSuggestions}
        onApplyTypoFix={(word, fix) => {
          if (!editor) return
          const { from, to, empty } = editor.state.selection
          if (!empty) {
            editor.chain().focus().deleteSelection().insertContent(fix).run()
          } else {
            // Find and replace the word around cursor
            const $pos = editor.state.doc.resolve(from)
            const textBefore = $pos.parent.textBetween(0, $pos.parentOffset)
            const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size)
            const beforeMatch = textBefore.match(/\w+$/)
            const afterMatch = textAfter.match(/^\w+/)
            const wordStart = from - (beforeMatch ? beforeMatch[0].length : 0)
            const wordEnd = from + (afterMatch ? afterMatch[0].length : 0)
            editor.chain().focus().setTextSelection({ from: wordStart, to: wordEnd }).deleteSelection().insertContent(fix).run()
          }
          closeContextMenu()
        }}
        onMarkNotTypo={(word) => {
          if (!projectPath) return
          window.api.spellCheckIgnore({ project_path: projectPath, word })
            .catch(err => console.error('Failed to add to ignore list:', err))
          closeContextMenu()
        }}
      />
      <EntityHoverCard
        data={hoverCard}
        position={hoverPos}
        entities={entities}
        projectPath={projectPath}
        effectiveWorldTime={hoverCard?.effectiveWorldTime || effectiveWorldTime}
        calConfig={calConfig}
      />

      {/* ── Synonym Popup ──────────────────────────────────── */}
      {synonymState && (
        <SynonymPopup
          word={synonymState.word}
          position={synonymState.position}
          synonymGroups={synonymState.groups}
          loading={synonymState.loading}
          error={synonymState.error}
          onSelect={handleSynonymSelect}
          onClose={() => setSynonymState(null)}
        />
      )}

      {/* ── Popup Overlays ─────────────────────────────────── */}
      {activePopup?.type === 'appendDescription' && (
        <AppendDescriptionPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          activeChapter={chapter}
          targetField="description"
          onClose={closePopup}
          onSuccess={() => onEntitiesChanged?.()}
        />
      )}

      {activePopup?.type === 'quickNote' && (
        <QuickNotePopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          onClose={closePopup}
          onSuccess={handleQuickNoteCreated}
        />
      )}

      {activePopup?.type === 'annotation' && (
        <AnnotationPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          onClose={closePopup}
          onSuccess={handleAnnotationCreated}
        />
      )}

      {activePopup?.type === 'annotationView' && (() => {
        const ann = entities?.find(
          e => String(e.id) === String(activePopup.data?.entityId) && e.type === 'annotation'
        )
        return (
          <AnnotationPopup
            selectedText=""
            position={activePopup.position}
            projectPath={projectPath}
            onClose={closePopup}
            annotation={ann}
            onDelete={() => {
              if (editor) {
                editor.chain().focus().unsetEntityLink().run()
              }
              closePopup()
              onEntitiesChanged?.()
            }}
          />
        )
      })()}

      {activePopup?.type === 'makeConnection' && (
        <MakeConnectionPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          activeChapter={{ ...chapter, world_time: effectiveWorldTime }}
          characters={characters}
          chapters={chapters}
          entities={entities}
          calConfig={calConfig}
          onClose={(result) => {
            if (result && result.knowledgeId && result.characterId && editor) {
              editor
                .chain()
                .focus()
                .setKnowledgeLink({
                  knowledgeId: String(result.knowledgeId),
                  characterId: String(result.characterId)
                })
                .run()
              onEntitiesChanged?.()
            }
            setActivePopup(null)
          }}
        />
      )}

      {activePopup?.type === 'relationshipTurningPoint' && (
        <RelationshipTurningPointPopup
          selectedText={activePopup.data?.text || ctxText}
          wordOffset={activePopup.data?.wordOffset}
          chapterId={chapter?.id}
          worldTime={effectiveWorldTime}
          position={activePopup.position}
          projectPath={projectPath}
          calConfig={calConfig}
          onClose={closePopup}
          onSuccess={(result) => {
            if (result && result.relationshipId && result.characterId && editor) {
              editor
                .chain()
                .focus()
                .setRelationshipLink({
                  relationshipId: String(result.relationshipId),
                  characterId: String(result.characterId)
                })
                .run()
            }
            onEntitiesChanged?.()
          }}
        />
      )}

      {activePopup?.type === 'timeOverride' && (
        <TimeOverridePopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          chapterId={chapter?.id}
          defaultWorldDate={effectiveWorldTime}
          calConfig={calConfig}
          existingMarkers={timeMarkers}
          onClose={() => setActivePopup(null)}
          onCreated={(marker) => {
            setTimeMarkers(prev => [...prev, marker])
            editor?.chain().focus().setTimeLink({
              timeId: String(marker.id),
              colorIndex: marker.color_index,
            }).run()
            setActivePopup(null)
          }}
        />
      )}

      {activePopup?.type === 'customLore' && (
        <CustomLorePopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          projectConfig={projectConfig}
          entities={entities}
          onClose={closePopup}
          onCreated={handleCustomLoreCreated}
          onConfigUpdate={onConfigUpdate}
        />
      )}

      {(activePopup?.type === 'foreshadowing' || activePopup?.type === 'twistReveal') && (
        <ForeshadowingPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          activeChapter={chapter}
          twistMode={activePopup.type === 'twistReveal' ? 'reveal' : 'foreshadow'}
          onClose={(result) => {
            if (result && result.twistId && editor) {
              const markerType = result.markerType // 'twist' or 'foreshadow'
              const twistId = result.twistId
              const text = result.selectedText

              // Apply the twist mark to the selected text
              editor
                .chain()
                .focus()
                .setTwistLink({
                  twistType: markerType,
                  twistId: String(twistId)
                })
                .run()

              if (result.isNew) {
                onEntitiesChanged?.()
              }
            }
            setActivePopup(null)
          }}
        />
      )}

      {activePopup?.type === 'addAliasSearch' && (
        <AddAliasPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          entities={Object.values(entities)}
          onClose={closePopup}
          onAliasAdded={handleAliasCreated}
        />
      )}

      {activePopup?.type === 'duplicateEntityExact' && (
        <DuplicateEntityPopup
          selectedText={activePopup.data.text}
          match={activePopup.data.match}
          position={activePopup.position}
          onClose={closePopup}
          onForceCreate={() => {
            const { entityType, text } = activePopup.data
            closePopup()
            handleCreateEntity(entityType, true, text)
          }}
        />
      )}

      {activePopup?.type === 'duplicateEntityPartial' && (
        <PartialMatchEntityPopup
          selectedText={activePopup.data.text}
          match={activePopup.data.match}
          position={activePopup.position}
          onClose={closePopup}
          onForceCreate={() => {
            const { entityType, text } = activePopup.data
            closePopup()
            handleCreateEntity(entityType, true, text)
          }}
          onAddAlias={async () => {
            const { match, text } = activePopup.data
            closePopup()
            handleAction('addAliasDirect', { entity: match, text })
          }}
          onJustLink={() => {
            const { match } = activePopup.data
            closePopup()
            handleLinkEntity(match)
          }}
        />
      )}

      {activePopup?.type === 'focusSelector' && (
        <FocusSelectorPopup
          onClose={closePopup}
          onSelectMode={({ type, goal }) => {
            const startTime = Date.now()
            onToggleFocus({
              active: true,
              type,
              goal,
              startWordCount: editor ? editor.storage.characterCount.words() : 0,
              startTime
            })
            if (goal) {
              window.api.updateProjectConfig(projectPath, 'active_sprint', startTime.toString(), 'string')
              window.api.updateStat({ project_path: projectPath, stat_key: 'sprints_started', increment_by: 1 })
            }
            closePopup()
          }}
        />
      )}
      {showKaroly && <KarolyEasterEgg onComplete={() => setShowKaroly(false)} />}
      {entityPalette && (
        <EntityCommandPalette
          position={entityPalette}
          selectedText={entityPalette.text}
          entities={entities || []}
          onClose={() => setEntityPalette(null)}
          onLink={(entity) => {
            handleLinkEntity(entity)
            setEntityPalette(null)
          }}
          onCreate={(type) => {
            if (entityPalette.text) {
              handleCreateEntity(type, false, entityPalette.text)
            }
            setEntityPalette(null)
          }}
        />
      )}
    </div>
  )
}

