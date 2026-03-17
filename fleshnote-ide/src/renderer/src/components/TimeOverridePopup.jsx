import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from './CalendarDatePicker'

const PALETTE = ['#d49200', '#5b8dd9', '#c75d3a', '#6bb57a', '#b06abf', '#d4d430', '#3abac7', '#d97070']

/**
 * TimeOverridePopup — Simple popup to create a time override mark on selected text.
 * Opened from the context menu "Time Override" action.
 *
 * Props:
 *   selectedText     - The text being marked
 *   position         - { x, y } for positioning
 *   projectPath      - string
 *   chapterId        - int
 *   defaultWorldDate - string (chapter world_time or active override at cursor)
 *   calConfig        - calendar config object
 *   existingMarkers  - array of existing world_times markers (to auto-pick color_index)
 *   onClose          - () => void
 *   onCreated        - (marker) => void  called on success
 */
export default function TimeOverridePopup({
  selectedText,
  position,
  projectPath,
  chapterId,
  defaultWorldDate = '',
  calConfig,
  existingMarkers = [],
  onClose,
  onCreated,
}) {
  const [worldDate, setWorldDate] = useState(defaultWorldDate)
  const [label, setLabel] = useState('')
  const [colorIndex, setColorIndex] = useState(existingMarkers.length % 8)
  const [saving, setSaving] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    setWorldDate(defaultWorldDate)
  }, [defaultWorldDate])

  const handleSave = async () => {
    if (!worldDate.trim() || !projectPath || !chapterId) return
    setSaving(true)
    try {
      const res = await window.api.createWorldTime({
        project_path: projectPath,
        chapter_id: chapterId,
        world_date: worldDate.trim(),
        label: label.trim() || null,
        color_index: colorIndex,
      })
      if (res?.marker) {
        onCreated?.(res.marker)
      }
    } catch (e) {
      console.error('Failed to create time override:', e)
    }
    setSaving(false)
  }

  const truncated = selectedText
    ? selectedText.length > 32 ? selectedText.slice(0, 32) + '\u2026' : selectedText
    : ''

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 360),
          top: Math.min(position.y, window.innerHeight - 320),
          width: 340,
        }}
      >
        <div className="popup-header">
          <span>{t('timeGutter.timeOverrideHeader', 'Time Override')}</span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>

        {truncated && (
          <div className="popup-subtitle" style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
            &ldquo;{truncated}&rdquo;
          </div>
        )}

        {/* World Date */}
        <div className="popup-field">
          <label className="popup-label">{t('timeGutter.inUniverseDateLabel', 'In-universe date at this point')}</label>
          <CalendarDatePicker
            value={worldDate}
            onChange={setWorldDate}
            calConfig={calConfig}
            projectPath={projectPath}
            compact
          />
        </div>

        {/* Label */}
        <div className="popup-field">
          <label className="popup-label">
            {t('timeGutter.labelLabel', 'Label')}
            <span className="popup-optional">{t('timeGutter.optional', '(optional)')}</span>
          </label>
          <input
            className="popup-search-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('timeGutter.createPlaceholder', 'e.g. Flashback to siege, Memory')}
          />
        </div>

        {/* Color */}
        <div className="popup-field">
          <label className="popup-label">{t('timeGutter.colorLabel', 'Color')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PALETTE.map((color, i) => (
              <button
                key={i}
                onClick={() => setColorIndex(i)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: color,
                  border: colorIndex === i ? `2px solid var(--text-primary)` : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  outline: colorIndex === i ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                  transition: 'border 0.1s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="popup-actions">
          <button className="popup-btn cancel" onClick={onClose}>
            {t('timeGutter.cancel', 'Cancel')}
          </button>
          <button
            className="popup-btn save"
            onClick={handleSave}
            disabled={saving || !worldDate.trim()}
          >
            {saving ? t('timeGutter.saving', 'Saving\u2026') : t('timeGutter.markSelection', 'Mark Selection')}
          </button>
        </div>
      </div>
    </div>
  )
}
