import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import { EntityLinkMark } from '../extensions/EntityLinkMark'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import EntityContextMenu from './EntityContextMenu'
import AppendDescriptionPopup from './AppendDescriptionPopup'
import MakeConnectionPopup from './MakeConnectionPopup'
import CustomLorePopup from './CustomLorePopup'
import ForeshadowingPopup from './ForeshadowingPopup'
import QuickNotePopup from './QuickNotePopup'
import AddAliasPopup from './AddAliasPopup'

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
      <path d="M16 4H9a3 3 0 0 0-3 3c0 2 1.5 3 3 3" />
      <path d="M12 12h3c1.5 0 3 1 3 3a3 3 0 0 1-3 3H8" />
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

// ── Hover Card Sub-Component ────────────────────────────────────────────────

function EntityHoverCard({ data, position, entities }) {
  const { t } = useTranslation()
  if (!data) return null
  const entity = entities.find(
    (e) => String(e.id) === String(data.entityId) && e.type === data.entityType
  )
  if (!entity) return null

  return (
    <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
      <div className={`hover-card-type ${data.entityType}`}>{data.entityType}</div>
      <div className="hover-card-name">{entity.name}</div>
      {entity.category && <div className="hover-card-detail">{entity.category}</div>}
      {
        data.entityType === 'quicknote' && (
          <div
            className="hover-card-detail"
            style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: '6px' }}
          >
            {entity.content}
          </div>
        )
      }
      <div className="hover-card-hint">{t('editor.clickToInspect', 'Click to inspect')}</div>
    </div >
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Editor({
  chapter,
  onUpdate,
  focusMode,
  onToggleFocus,
  characters = [],
  entities = [],
  projectPath,
  projectConfig,
  chapters = [],
  onChapterMetaUpdate,
  onEntityClick,
  onEntitiesChanged
}) {
  const { t, i18n } = useTranslation()
  const saveTimeoutRef = useRef(null)

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null)
  const [ctxText, setCtxText] = useState('')
  const [entityAtCursor, setEntityAtCursor] = useState(null)

  // Popup state — only one popup active at a time
  const [activePopup, setActivePopup] = useState(null)
  // activePopup = { type: 'appendDescription' | 'quickNote' | 'makeConnection' | 'customLore' | 'foreshadowing', position, data }

  // Hover card state
  const [hoverCard, setHoverCard] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const editor = useEditor({
    extensions: [
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
      EntityLinkMark
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'editor-area',
        dir: i18n.dir()
      },
      handleDOMEvents: {
        // Hover card on entity links
        mouseover: (_view, event) => {
          const target = event.target.closest('[data-entity-type]')
          if (target) {
            const entityType = target.getAttribute('data-entity-type')
            const entityId = target.getAttribute('data-entity-id')
            const rect = target.getBoundingClientRect()
            setHoverCard({ entityType, entityId })
            setHoverPos({ x: rect.left, y: rect.bottom + 4 })
          } else {
            setHoverCard(null)
          }
          return false
        },
        mouseout: (_view, event) => {
          const target = event.target.closest('[data-entity-type]')
          if (target) {
            setHoverCard(null)
          }
          return false
        },
        // Click on entity links opens inspector
        click: (_view, event) => {
          const target = event.target.closest('[data-entity-type]')
          if (target) {
            const entityType = target.getAttribute('data-entity-type')
            const entityId = target.getAttribute('data-entity-id')
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

            return true
          }
          return false
        }
      }
    },
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => {
          const html = editor.getHTML()
          const words = editor.storage.characterCount.words()
          onUpdate(html, words)
        }, 500)
      }
    }
  })

  // When chapter changes, load new content
  useEffect(() => {
    if (editor && chapter?.content !== undefined) {
      editor.commands.setContent(chapter.content || '')
    }
  }, [editor, chapter?.id])

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

  // Update TipTap layout direction based on active language
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dom.setAttribute('dir', i18n.dir())
    }
  }, [editor, i18n.language])

  // ── Context menu handlers ───────────────────────────

  const closeContextMenu = useCallback(() => {
    setCtxMenu(null)
    setCtxText('')
    setEntityAtCursor(null)
  }, [])

  const handleCreateEntity = useCallback(
    async (type) => {
      if (!editor || !projectPath || !ctxText) return

      try {
        let result
        if (type === 'character') {
          result = await window.api.createCharacter({
            project_path: projectPath,
            name: ctxText
          })
          result = { ...result.character, type: 'character' }
        } else if (type === 'location') {
          result = await window.api.createLocation({
            project_path: projectPath,
            name: ctxText
          })
          result = { ...result.location, type: 'location' }
        } else if (type === 'lore') {
          result = await window.api.createLoreEntity({
            project_path: projectPath,
            name: ctxText,
            category: 'item'
          })
          result = { ...result.entity, type: 'lore' }
        }

        if (result) {
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

      closeContextMenu()
    },
    [editor, projectPath, ctxText, closeContextMenu, onEntitiesChanged]
  )

  const handleLinkEntity = useCallback(
    (entity) => {
      if (!editor) return

      editor
        .chain()
        .focus()
        .setEntityLink({
          entityType: entity.type,
          entityId: String(entity.id)
        })
        .run()

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

        case 'makeConnection':
          setActivePopup({ type: 'makeConnection', position: pos, data })
          break

        case 'customLore':
          setActivePopup({ type: 'customLore', position: pos, data })
          break

        case 'foreshadowing':
          setActivePopup({ type: 'foreshadowing', position: pos, data })
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

      editor
        .chain()
        .focus()
        .setEntityLink({
          entityType: 'quicknote',
          entityId: String(note.id)
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
          <input
            className="editor-toolbar-input"
            type="text"
            placeholder={t('editor.worldTimePlaceholder', 'World time...')}
            value={chapter.world_time || ''}
            onChange={(e) => {
              onChapterMetaUpdate?.({ world_time: e.target.value })
            }}
            title={t('editor.timeTooltip', 'In-universe date/time for this chapter')}
          />
        </div>

        <div className="editor-toolbar-right">
          <div className="editor-wordcount">
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
          </div>
          <button className={`focus-btn ${focusMode ? 'active' : ''}`} onClick={onToggleFocus}>
            {focusMode ? t('editor.exitFocus', 'Exit Focus') : t('editor.focusBtn', 'Focus')}
          </button>
        </div>
      </div>

      {/* ── Formatting Toolbar ────────────────────────────── */}
      <div className="editor-format-toolbar">
        <button
          className={`format-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <FormatIcons.Bold />
        </button>
        <button
          className={`format-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <FormatIcons.Italic />
        </button>
        <button
          className={`format-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <FormatIcons.UnderlineIcon />
        </button>
        <button
          className={`format-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
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
      </div>

      {/* ── Scrollable Editor Content ─────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: focusMode ? `0 ${projectConfig?.editor_padding || '15%'}` : '0',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
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
          <EditorContent editor={editor} />
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
      />
      <EntityHoverCard data={hoverCard} position={hoverPos} entities={entities} />

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

      {activePopup?.type === 'makeConnection' && (
        <MakeConnectionPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          activeChapter={chapter}
          characters={characters}
          chapters={chapters}
          entities={entities}
          onClose={closePopup}
        />
      )}

      {activePopup?.type === 'customLore' && (
        <CustomLorePopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          projectConfig={projectConfig}
          onClose={closePopup}
          onCreated={handleCustomLoreCreated}
        />
      )}

      {activePopup?.type === 'foreshadowing' && (
        <ForeshadowingPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          activeChapter={chapter}
          onClose={closePopup}
        />
      )}

      {activePopup?.type === 'addAliasSearch' && (
        <AddAliasPopup
          selectedText={activePopup.data?.text || ctxText}
          position={activePopup.position}
          projectPath={projectPath}
          onClose={closePopup}
          onSuccess={handleAliasCreated}
        />
      )}
    </div>
  )
}
