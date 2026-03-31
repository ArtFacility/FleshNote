import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Annotation: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  )
}

function TypeIcon({ type }) {
  return <Icons.Annotation />
}

export default function AnnotationInspectorPanel({
  entity, projectPath, onEntityUpdated
}) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!entity) return null

  const handleConfirmDeleteAnnotation = async () => {
    setShowDeleteConfirm(false)
    try {
      await window.api.deleteAnnotation({
        project_path: projectPath,
        annotation_id: entity.id
      })
      onEntityUpdated?.()
      window.dispatchEvent(new CustomEvent('forceBackToChapters'))
    } catch (err) {
      console.error('Failed to delete annotation:', err)
    }
  }

  return (
    <div>
      {showDeleteConfirm && (
        <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ insetInlineStart: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px' }}
          >
            <div className="popup-header">
              <span style={{ color: 'var(--accent-red)' }}>{t('inspector.deleteAnnotationTitle', 'Delete Annotation?')}</span>
            </div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '12px', marginBottom: '16px' }}>
              {t('inspector.deleteAnnotationWarning', 'This action is permanent. The annotation will be removed and its anchor in the text will lose its reference.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="entity-edit-btn" onClick={() => setShowDeleteConfirm(false)}>
                {t('inspector.cancel', 'Cancel')}
              </button>
              <button
                className="entity-edit-btn save"
                style={{ backgroundColor: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: 'var(--bg-deep)' }}
                onClick={handleConfirmDeleteAnnotation}
              >
                {t('inspector.deleteAnnotationBtn', 'Delete Annotation')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="entity-header" style={{ marginBottom: '12px' }}>
        <div className="entity-type-badge annotation">
          <TypeIcon type="annotation" /> {t('inspector.typeAnnotation', 'Footnote Annotation')}
        </div>
      </div>
      <div
        className="entity-narrative-note"
        style={{
          background: 'var(--bg-elevated)',
          borderInlineStart: '2px solid var(--accent-annotation)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          whiteSpace: 'pre-wrap'
        }}
      >
        {entity.content}
      </div>
      <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {t('inspector.annotationExportNote', 'This annotation will appear as a footnote at the bottom of its page when exported.')}
      </div>
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="entity-edit-btn"
          style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}
        >
          <Icons.Trash /> {t('inspector.deleteAnnotationBtn', 'Delete Annotation')}
        </button>
      </div>
    </div>
  )
}
