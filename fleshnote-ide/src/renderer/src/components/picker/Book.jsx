import { useTranslation } from 'react-i18next'
import { bookColor, bookDepth } from '../../utils/bookshelfLayout'

export const BOOK_DRAG_TYPE = 'application/x-fleshnote-book'

const SPARKS = 7

// Face-out cover; manuscript length shows as the depth of the page block.
export default function Book({
  project,
  onOpen,
  onMenu,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragging = false,
  preview = false,
}) {
  const { t, i18n } = useTranslation()
  const words = project.word_count || 0
  const finished = !!project.finished
  const migrate = !!project.needs_migration
  // a cover made in the cover editor replaces the drawn binding
  const coverArt = project.cover_image ? `fleshnote-asset://load/${project.cover_image.replace(/\\/g, '/')}` : null
  const wordsLabel = t('picker.shelf.words', '{{n}} words', { n: words.toLocaleString(i18n.language) })

  const title = [
    project.name,
    wordsLabel,
    project.chapter_count
      ? t('picker.shelf.chapters', '{{done}}/{{total}} chapters final', { done: project.final_count || 0, total: project.chapter_count })
      : null,
    finished ? t('picker.shelf.finished', 'Finished') : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className={`book ${coverArt ? 'has-cover-art' : ''} ${finished ? 'is-finished' : ''} ${migrate ? 'needs-migration' : ''} ${dragging ? 'is-dragging' : ''} ${preview ? 'is-preview' : ''}`}
      style={{
        '--book-color': bookColor(project),
        '--book-depth': `${bookDepth(words)}px`,
      }}
      title={preview ? undefined : title}
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
      draggable={!preview}
      onClick={preview ? undefined : () => onOpen?.(project)}
      onKeyDown={preview ? undefined : (e) => {
        if (e.target !== e.currentTarget) return // keys on the ⋯ button
        if (e.key === 'Enter') onOpen?.(project)
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault()
          const r = e.currentTarget.getBoundingClientRect()
          onMenu?.(project, { x: r.left + r.width / 2, y: r.top + 24 })
        }
      }}
      onContextMenu={preview ? undefined : (e) => { e.preventDefault(); onMenu?.(project, { x: e.clientX, y: e.clientY }) }}
      onDragStart={preview ? undefined : (e) => {
        e.dataTransfer.setData(BOOK_DRAG_TYPE, project.project_id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(project)
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="book-body">
        <div className="book-cover">
          {coverArt && <img className="book-cover-art" src={coverArt} alt="" draggable={false} />}
          <span className="book-hinge" />
          <span className="book-frame" />
          {project.book_rune
            ? <span className="book-rune">{project.book_rune}</span>
            : <span className="book-ornament" />}
          <span className="book-title">{project.name}</span>
          <span className="book-words">{wordsLabel}</span>
          {migrate && <span className="book-badge" aria-label={t('picker.needsMigrationLabel', 'Needs Migration')}>!</span>}
        </div>
        <span className="book-pages" aria-hidden="true" />
      </div>
      {finished && (
        <div className="book-sparks" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <span key={i} style={{ '--i': i, '--n': SPARKS }} />
          ))}
        </div>
      )}
      {!preview && (
        <button
          type="button"
          className="book-menu-btn"
          draggable={false}
          aria-label={t('picker.shelf.bookActions', 'Book actions')}
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            onMenu?.(project, { x: r.left, y: r.bottom })
          }}
        >
          ⋯
        </button>
      )}
    </div>
  )
}
