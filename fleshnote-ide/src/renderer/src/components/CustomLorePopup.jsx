import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Popup for creating a custom lore entity with category selection.
 * Allows writers to create entities with a specific category
 * (from project config lore_categories) and optional description.
 */
export default function CustomLorePopup({
  selectedText,
  position,
  projectPath,
  projectConfig,
  onClose,
  onCreated // callback: (entity) => void — applies entity mark + refreshes
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(selectedText || '')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  // Auto-focus name input
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [])

  // Parse lore categories from project config
  const categories = (() => {
    try {
      const raw = projectConfig?.lore_categories
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return ['item', 'spell', 'artifact', 'concept', 'organization', 'event', 'custom']
  })()

  const handleCreate = async () => {
    if (!name.trim() || !projectPath) return

    setSaving(true)
    try {
      const data = await window.api.createLoreEntity({
        project_path: projectPath,
        name: name.trim(),
        category: category || 'item',
        description: description.trim() || ''
      })
      onCreated?.(data.entity)
      onClose()
    } catch (err) {
      console.error('Failed to create custom lore entity:', err)
    }
    setSaving(false)
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 340),
          top: Math.min(position.y, window.innerHeight - 350)
        }}
      >
        <div className="popup-header">
          <span>{t('popup.createLoreTitle', 'Create Custom Lore')}</span>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="popup-subtitle">{t('popup.createLoreSubtitle', 'Create a new lore entity with a specific category.')}</div>

        {/* Name */}
        <div className="popup-field">
          <label className="popup-label">{t('popup.nameLabel', 'Name')}</label>
          <input
            ref={nameRef}
            className="popup-search-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('popup.entityNamePlaceholder', 'Entity name...')}
          />
        </div>

        {/* Category */}
        <div className="popup-field">
          <label className="popup-label">{t('popup.categoryLabel', 'Category')}</label>
          <select
            className="popup-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t('popup.selectCategory', 'Select category...')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="popup-field">
          <label className="popup-label">
            {t('popup.descriptionLabel', 'Description')}
            <span className="popup-optional">{t('popup.optional', '(optional)')}</span>
          </label>
          <textarea
            className="popup-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t('popup.briefDescPlaceholder', 'Brief description...')}
          />
        </div>

        {/* Actions */}
        <div className="popup-actions">
          <button className="popup-btn cancel" onClick={onClose}>
            {t('popup.cancel', 'Cancel')}
          </button>
          <button
            className="popup-btn save"
            onClick={handleCreate}
            disabled={saving || !name.trim()}
          >
            {saving ? t('popup.creating', 'Creating...') : t('popup.createAndLink', 'Create & Link')}
          </button>
        </div>
      </div>
    </div>
  )
}
