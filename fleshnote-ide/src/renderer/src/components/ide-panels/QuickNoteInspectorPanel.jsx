import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
  Feather: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function TypeIcon({ type }) {
  return <Icons.Feather />
}

export default function QuickNoteInspectorPanel({
  entity, projectPath, onEntityUpdated
}) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [localNoteType, setLocalNoteType] = useState(entity?.note_type || 'Note')

  useEffect(() => {
    if (entity?.type === 'quicknote') {
      setLocalNoteType(entity.note_type || 'Note')
    }
  }, [entity?.id, entity?.type, entity?.note_type])

  if (!entity) return null

  const handleConfirmDeleteQuickNote = async () => {
    setShowDeleteConfirm(false)
    try {
      await window.api.deleteQuickNote({
        project_path: projectPath,
        note_id: entity.id
      })
      onEntityUpdated?.()
      window.dispatchEvent(new CustomEvent('forceBackToChapters'))
    } catch (err) {
      console.error('Failed to delete quick note:', err)
    }
  }

  const NOTE_TYPE_OPTIONS = [
    { label: 'Note',       color: 'var(--accent-amber)' },
    { label: 'Fix',        color: 'var(--accent-red)'   },
    { label: 'Suggestion', color: 'var(--accent-blue)'  },
    { label: 'Idea',       color: '#4ade80'              },
  ]
  const currentNoteType = NOTE_TYPE_OPTIONS.find(o => o.label === localNoteType) || NOTE_TYPE_OPTIONS[0]
  
  const handleChangeNoteType = async (label) => {
    setLocalNoteType(label)
    try {
      await window.api.updateQuickNote({ project_path: projectPath, note_id: entity.id, note_type: label })
      window.dispatchEvent(new CustomEvent('fleshnote:quicknote-type-changed', { detail: { noteId: entity.id, noteType: label } }))
      onEntityUpdated?.()
    } catch (err) {
      console.error('Failed to update note type:', err)
      setLocalNoteType(entity.note_type || 'Note')
    }
  }

  return (
    <div>
      {showDeleteConfirm && (
        <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="popup-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              insetInlineStart: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '320px'
            }}
          >
            <div className="popup-header">
              <span style={{ color: 'var(--accent-red)' }}>{t('inspector.deleteNoteTitle', 'Delete Note?')}</span>
            </div>
            <div
              className="popup-subtitle"
              style={{
                whiteSpace: 'normal',
                lineHeight: '1.5',
                marginTop: '12px',
                marginBottom: '16px'
              }}
            >
              {t('inspector.deleteNoteWarning', 'This action is permanent. Any text bound to this note will automatically lose its reference and revert to normal text.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="entity-edit-btn" onClick={() => setShowDeleteConfirm(false)}>
                {t('inspector.cancel', 'Cancel')}
              </button>
              <button
                className="entity-edit-btn save"
                style={{
                  backgroundColor: 'var(--accent-red)',
                  borderColor: 'var(--accent-red)',
                  color: 'var(--bg-deep)'
                }}
                onClick={handleConfirmDeleteQuickNote}
              >
                {t('inspector.deleteNoteBtn', 'Delete Note')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="entity-header" style={{ marginBottom: '12px' }}>
        <div className={`entity-type-badge quicknote`}>
          <TypeIcon type={entity.type} /> {t('inspector.typeQuickNote', 'Quick Note')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {NOTE_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => handleChangeNoteType(opt.label)}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              border: `1px solid ${opt.label === currentNoteType.label ? opt.color : 'var(--border-subtle)'}`,
              borderRadius: 12,
              color: opt.label === currentNoteType.label ? opt.color : 'var(--text-tertiary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: opt.label === currentNoteType.label ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div
        className="entity-narrative-note"
        style={{
          background: 'var(--bg-elevated)',
          borderInlineStart: `2px solid ${currentNoteType.color}`,
          color: 'var(--text-primary)',
          fontSize: '12px',
          whiteSpace: 'pre-wrap'
        }}
      >
        {entity.content}
      </div>
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="entity-edit-btn"
          style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}
          title={t('inspector.deleteNoteTooltip', 'Delete this quick note')}
        >
          <Icons.Trash /> {t('inspector.deleteNoteBtn', 'Delete Note')}
        </button>
      </div>
    </div>
  )
}
