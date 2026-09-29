import { useState, useRef, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Book, { BOOK_DRAG_TYPE } from './Book'
import BookMenu from './BookMenu'
import BookCustomizeModal from './BookCustomizeModal'
import {
  UNSORTED, buildShelves, moveBook, addShelf, renameShelf, moveShelf, deleteShelf,
} from '../../utils/bookshelfLayout'

const isBookDrag = (e) => e.dataTransfer?.types?.includes(BOOK_DRAG_TYPE)

function ShelfName({ shelf, editing, onStartEdit, onCommit }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(shelf.name || '')

  if (shelf.id === UNSORTED) {
    return <span className="shelf-name is-unsorted">{t('picker.shelf.unsorted', 'Unsorted')}</span>
  }
  if (editing) {
    return (
      <input
        className="shelf-name-input"
        autoFocus
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => onCommit(draft.trim() || shelf.name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(shelf.name); onCommit(shelf.name) }
        }}
      />
    )
  }
  return (
    <span
      className="shelf-name"
      title={t('picker.shelf.renameHint', 'Double-click to rename')}
      onDoubleClick={() => { setDraft(shelf.name); onStartEdit() }}
    >
      {shelf.name}
    </span>
  )
}

export default function Bookshelf({
  projects,
  layout,
  onLayoutChange,
  onOpen,
  onExport,
  onMigrate,
  onDelete,
  onCustomizeSave,
}) {
  const { t, i18n } = useTranslation()
  const [menu, setMenu] = useState(null) // { project, position, shelfId }
  const [customizing, setCustomizing] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hint, setHint] = useState(null) // { shelfId, index }
  const hintRef = useRef(null)

  const shelves = useMemo(() => buildShelves(layout, projects), [layout, projects])
  const userShelfCount = layout.shelves.length

  const setDropHint = (next) => {
    const prev = hintRef.current
    if (prev?.shelfId === next?.shelfId && prev?.index === next?.index) return
    hintRef.current = next
    setHint(next)
  }

  const endDrag = () => { setDraggingId(null); setDropHint(null) }

  const handleBookDragOver = (shelfId, index) => (e) => {
    if (!isBookDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const r = e.currentTarget.getBoundingClientRect()
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    const before = rtl ? e.clientX > r.left + r.width / 2 : e.clientX < r.left + r.width / 2
    setDropHint({ shelfId, index: before ? index : index + 1 })
  }

  const handleShelfDragOver = (shelf) => (e) => {
    if (!isBookDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (hintRef.current?.shelfId !== shelf.id) setDropHint({ shelfId: shelf.id, index: shelf.books.length })
  }

  const handleShelfDrop = (shelf) => (e) => {
    if (!isBookDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    const id = e.dataTransfer.getData(BOOK_DRAG_TYPE)
    const h = hintRef.current
    const index = h?.shelfId === shelf.id ? h.index : shelf.books.length
    if (id) onLayoutChange(moveBook(layout, projects, id, shelf.id, index))
    endDrag()
  }

  const handleAddShelf = () => {
    const { layout: next, id } = addShelf(layout, t('picker.shelf.newShelfName', 'New shelf'))
    onLayoutChange(next)
    setEditingId(id)
  }

  const formatWords = (n) => t('picker.shelf.words', '{{n}} words', { n: n.toLocaleString(i18n.language) })

  return (
    <div className="bookshelf">
      {shelves.map((shelf, si) => {
        const isUnsorted = shelf.id === UNSORTED
        if (isUnsorted && shelf.books.length === 0 && !draggingId && userShelfCount > 0) return null
        const totalWords = shelf.books.reduce((sum, b) => sum + (b.word_count || 0), 0)
        const showHint = hint?.shelfId === shelf.id

        return (
          <section key={shelf.id} className={`shelf ${showHint ? 'is-drop-target' : ''}`}>
            <header className="shelf-head">
              <ShelfName
                key={editingId === shelf.id ? 'edit' : 'view'}
                shelf={shelf}
                editing={editingId === shelf.id}
                onStartEdit={() => setEditingId(shelf.id)}
                onCommit={(name) => {
                  if (name && name !== shelf.name) onLayoutChange(renameShelf(layout, shelf.id, name))
                  setEditingId(null)
                }}
              />
              <span className="shelf-meta">
                {t('picker.shelf.bookCount', 'Books: {{n}}', { n: shelf.books.length })}
                {totalWords > 0 && <> · {formatWords(totalWords)}</>}
              </span>
              {!isUnsorted && (
                <span className="shelf-controls">
                  <button type="button" disabled={si === 0} onClick={() => onLayoutChange(moveShelf(layout, shelf.id, -1))}
                    title={t('picker.shelf.moveUp', 'Move shelf up')}>▲</button>
                  <button type="button" disabled={si === userShelfCount - 1} onClick={() => onLayoutChange(moveShelf(layout, shelf.id, 1))}
                    title={t('picker.shelf.moveDown', 'Move shelf down')}>▼</button>
                  <button type="button" className="danger" onClick={() => setConfirmDelete(shelf)}
                    title={t('picker.shelf.deleteShelf', 'Delete shelf')}>&times;</button>
                </span>
              )}
            </header>

            <div
              className="shelf-books"
              onDragOver={handleShelfDragOver(shelf)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget) && hintRef.current?.shelfId === shelf.id) setDropHint(null)
              }}
              onDrop={handleShelfDrop(shelf)}
            >
              {shelf.books.map((proj, i) => (
                <Fragment key={proj.project_id}>
                  {showHint && hint.index === i && <span className="book-drop-marker" />}
                  <Book
                    project={proj}
                    dragging={draggingId === proj.project_id}
                    onOpen={onOpen}
                    onMenu={(project, position) => setMenu({ project, position, shelfId: shelf.id })}
                    onDragStart={() => setDraggingId(proj.project_id)}
                    onDragOver={handleBookDragOver(shelf.id, i)}
                    onDragEnd={endDrag}
                  />
                </Fragment>
              ))}
              {showHint && hint.index >= shelf.books.length && <span className="book-drop-marker" />}
              {shelf.books.length === 0 && (
                <span className="shelf-empty">{t('picker.shelf.emptyShelf', 'Drag books here')}</span>
              )}
            </div>
          </section>
        )
      })}

      <button type="button" className="shelf-add" onClick={handleAddShelf}>
        {t('picker.shelf.newShelf', '+ New shelf')}
      </button>

      {menu && (
        <BookMenu
          project={menu.project}
          position={menu.position}
          shelves={shelves}
          currentShelfId={menu.shelfId}
          onClose={() => setMenu(null)}
          onOpen={onOpen}
          onCustomize={setCustomizing}
          onMove={(project, shelfId) => {
            const target = shelves.find((s) => s.id === shelfId)
            onLayoutChange(moveBook(layout, projects, project.project_id, shelfId, target ? target.books.length : 0))
          }}
          onExport={onExport}
          onMigrate={onMigrate}
          onDelete={onDelete}
        />
      )}

      {customizing && (
        <BookCustomizeModal
          project={customizing}
          onClose={() => setCustomizing(null)}
          onSave={onCustomizeSave}
        />
      )}

      {confirmDelete && (
        <div className="popup-overlay" onClick={() => setConfirmDelete(null)} style={{ zIndex: 9999 }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 400 }}>
            <div className="popup-header">
              <span style={{ color: 'var(--accent-amber)' }}>{t('picker.shelf.deleteShelf', 'Delete shelf')}</span>
              <button className="popup-close" onClick={() => setConfirmDelete(null)}>&times;</button>
            </div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
              {t('picker.shelf.deleteShelfPrompt', 'Remove the shelf "{{name}}"? Its books move back to Unsorted — no project is deleted.', { name: confirmDelete.name })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="button" className="picker-ghost-btn" onClick={() => setConfirmDelete(null)}>
                {t('picker.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="book-primary-btn"
                onClick={() => { onLayoutChange(deleteShelf(layout, confirmDelete.id)); setConfirmDelete(null) }}
              >
                {t('picker.shelf.deleteShelf', 'Delete shelf')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
