import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * AnnotationPopup — used for both creating a new annotation and viewing an existing one.
 *
 * Create mode: pass selectedText + onSuccess callback
 * View mode:   pass annotation = { id, content } + onDelete callback
 */
export default function AnnotationPopup({
  selectedText,
  position,
  projectPath,
  onClose,
  onSuccess,
  // View mode props
  annotation,
  onDelete
}) {
  const { t } = useTranslation()
  const isViewMode = !!annotation
  const [content, setContent] = useState(annotation?.content || '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isViewMode || editing) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isViewMode, editing])

  const handleSave = async () => {
    if (!content.trim() || !projectPath) return
    setSaving(true)
    try {
      if (isViewMode && editing) {
        await window.api.updateAnnotation({
          project_path: projectPath,
          annotation_id: annotation.id,
          content: content.trim()
        })
        onClose()
      } else {
        const data = await window.api.createAnnotation({
          project_path: projectPath,
          content: content.trim()
        })
        onSuccess?.(data.annotation)
        onClose()
      }
    } catch (err) {
      console.error('Failed to save annotation:', err)
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 360),
          top: Math.min(position.y, window.innerHeight - 320)
        }}
      >
        <div className="popup-header">
          <span style={{ color: 'var(--accent-annotation)' }}>
            {isViewMode
              ? t('popup.viewAnnotationTitle', 'Annotation')
              : t('popup.createAnnotationTitle', 'Create Annotation')}
          </span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>

        {!isViewMode && selectedText && (
          <div className="popup-subtitle">
            {t('popup.attachAnnotationTo', 'Footnote on: "{{text}}"', {
              text: selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText
            })}
          </div>
        )}

        <textarea
          ref={inputRef}
          className="popup-textarea"
          style={{
            width: '100%',
            height: '110px',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: `1px solid ${isViewMode && !editing ? 'var(--border-subtle)' : 'var(--accent-annotation)'}`,
            padding: '10px',
            marginTop: '10px',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
            borderRadius: '4px',
            resize: 'none',
            cursor: isViewMode && !editing ? 'default' : 'text'
          }}
          placeholder={t('popup.writeAnnotationPlaceholder', 'Write your annotation note... (Ctrl+Enter to save)')}
          value={content}
          onChange={(e) => {
            if (!isViewMode || editing) setContent(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          disabled={saving}
          readOnly={isViewMode && !editing}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isViewMode && onDelete && (
              <button
                onClick={onDelete}
                style={{
                  padding: '7px 14px',
                  background: 'transparent',
                  border: '1px solid var(--accent-red)',
                  color: 'var(--accent-red)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  borderRadius: '2px'
                }}
              >
                {t('popup.removeAnnotation', 'Remove Marker')}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px'
              }}
            >
              {t('popup.cancel', 'Cancel')}
            </button>

            {isViewMode && !editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '7px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-annotation)',
                  color: 'var(--accent-annotation)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  borderRadius: '2px'
                }}
              >
                {t('popup.editAnnotation', 'Edit')}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !content.trim()}
                style={{
                  padding: '7px 14px',
                  background: content.trim() ? 'var(--accent-annotation)' : 'var(--bg-elevated)',
                  color: content.trim() ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                  border: 'none',
                  cursor: content.trim() ? 'pointer' : 'default',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderRadius: '2px'
                }}
              >
                {saving
                  ? t('popup.saving', 'Saving...')
                  : isViewMode
                    ? t('popup.saveAnnotation', 'Save Changes')
                    : t('popup.saveAnnotationBtn', 'Save Annotation')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
