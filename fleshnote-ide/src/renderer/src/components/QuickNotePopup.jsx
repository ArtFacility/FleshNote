import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const NOTE_TYPES = [
  { label: 'Note',       color: 'var(--accent-amber)' },
  { label: 'Fix',        color: 'var(--accent-red)'   },
  { label: 'Suggestion', color: 'var(--accent-blue)'  },
  { label: 'Idea',       color: '#4ade80'              },
]

export default function QuickNotePopup({
  selectedText,
  position,
  projectPath,
  onClose,
  onSuccess
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [typeIndex, setTypeIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  const noteType = NOTE_TYPES[typeIndex]
  const cycleType = () => setTypeIndex(i => (i + 1) % NOTE_TYPES.length)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleSave = async () => {
    if (!content.trim() || !projectPath) return
    setSaving(true)
    try {
      const data = await window.api.createQuickNote({
        project_path: projectPath,
        content: content.trim(),
        note_type: noteType.label
      })
      onSuccess?.(data.quick_note)
      onClose()
    } catch (err) {
      console.error('Failed to create quick note:', err)
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      cycleType()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 340),
          top: Math.min(position.y, window.innerHeight - 320)
        }}
      >
        <div className="popup-header">
          <span style={{ color: 'var(--accent-amber)' }}>{t('popup.createQuickNoteTitle', 'Create Quick Note')}</span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-subtitle">
          {t('popup.attachNoteTo', 'Attach note to: "{{text}}"', { text: selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText })}
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button
            onClick={cycleType}
            title="Tab to cycle type"
            style={{
              padding: '3px 10px',
              background: 'transparent',
              border: `1px solid ${noteType.color}`,
              borderRadius: 12,
              color: noteType.color,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            {noteType.label}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Tab to cycle
          </span>
        </div>

        <textarea
          ref={inputRef}
          className="popup-textarea"
          style={{
            width: '100%',
            height: '100px',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            padding: '10px',
            marginTop: '10px',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
            borderRadius: '4px',
            resize: 'none'
          }}
          placeholder={t('popup.writeNotePlaceholder', 'Write your note here... (Ctrl+Enter to save)')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              marginInlineEnd: '8px'
            }}
          >
            {t('popup.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-amber)',
              color: 'var(--bg-deep)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '4px'
            }}
          >
            {saving ? t('popup.saving', 'Saving...') : t('popup.saveNoteBtn', 'Save Note')}
          </button>
        </div>
      </div>
    </div>
  )
}
