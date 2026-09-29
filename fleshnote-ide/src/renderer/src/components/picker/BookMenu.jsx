import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { UNSORTED } from '../../utils/bookshelfLayout'

export default function BookMenu({
  project,
  position,
  shelves,
  currentShelfId,
  onClose,
  onOpen,
  onCustomize,
  onMove,
  onExport,
  onMigrate,
  onDelete,
}) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: position.x, top: position.y })
  const [showMove, setShowMove] = useState(false)

  // Keep the menu inside the viewport (spawn at the raw point first).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(position.x, window.innerWidth - r.width - 8))
    const top = Math.max(8, Math.min(position.y, window.innerHeight - r.height - 8))
    setPos({ left, top })
  }, [position.x, position.y, showMove])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const act = (fn) => () => { onClose(); fn() }
  const targets = shelves.filter((s) => s.id !== currentShelfId)

  return (
    <div className="book-menu-backdrop" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div
        ref={ref}
        className="book-menu"
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.stopPropagation()}
        role="menu"
      >
        <div className="book-menu-title">{project.name}</div>
        <button type="button" role="menuitem" onClick={act(() => onOpen(project))}>
          {t('picker.shelf.open', 'Open')}
        </button>
        {!project.needs_migration && (
          <button type="button" role="menuitem" onClick={act(() => onCustomize(project))}>
            {t('picker.shelf.customize', 'Customize book')}
          </button>
        )}
        {targets.length > 0 && (
          <>
            <button type="button" role="menuitem" aria-expanded={showMove} onClick={() => setShowMove((v) => !v)}>
              {t('picker.shelf.moveTo', 'Move to shelf')} <span className="book-menu-caret">{showMove ? '▾' : '▸'}</span>
            </button>
            {showMove && targets.map((s) => (
              <button key={s.id} type="button" role="menuitem" className="book-menu-sub" onClick={act(() => onMove(project, s.id))}>
                {s.id === UNSORTED ? t('picker.shelf.unsorted', 'Unsorted') : s.name}
              </button>
            ))}
          </>
        )}
        <div className="book-menu-sep" />
        {project.needs_migration && (
          <button type="button" role="menuitem" className="amber" onClick={act(() => onMigrate(project))}>
            {t('picker.migrate', 'Migrate')}
          </button>
        )}
        <button type="button" role="menuitem" onClick={act(() => onExport(project))}>
          {t('picker.shelf.export', 'Export .flnote')}
        </button>
        <button type="button" role="menuitem" className="danger" onClick={act(() => onDelete(project))}>
          {t('picker.deleteTitle', 'Delete Project')}
        </button>
      </div>
    </div>
  )
}
