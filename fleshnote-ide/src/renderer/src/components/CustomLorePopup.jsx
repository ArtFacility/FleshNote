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
  entities,
  onConfigUpdate,
  onClose,
  onCreated // callback: (entity) => void — applies entity mark + refreshes
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(selectedText || '')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  // Auto-focus name input
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [])

  // Parse lore categories from project config and existing entities
  const categories = (() => {
    const cats = new Set()

    // Add from config if any
    try {
      const raw = projectConfig?.lore_categories
      const configCats = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
      configCats.forEach(c => cats.add(c.toLowerCase().trim()))
    } catch { }

    // Add from existing entities
    if (Array.isArray(entities)) {
      entities.forEach(e => {
        if (e.type !== 'character' && e.type !== 'location' && e.type !== 'group' && e.type !== 'quicknote' && e.category) {
          cats.add(e.category.toLowerCase().trim())
        }
      })
    }

    // Default fallback
    if (cats.size === 0) cats.add('item')

    return Array.from(cats).sort()
  })()

  const handleCreate = async () => {
    if (!name.trim() || !projectPath) return

    setSaving(true)
    try {
      const finalCategory = (category === 'new_category' ? customCategory.trim() : category) || 'item'
      const data = await window.api.createLoreEntity({
        project_path: projectPath,
        name: name.trim(),
        category: finalCategory,
        description: description.trim() || ''
      })

      if (category === 'new_category' && finalCategory) {
        try {
          const existingCats = Array.isArray(projectConfig?.lore_categories)
            ? projectConfig.lore_categories
            : (typeof projectConfig?.lore_categories === 'string' ? JSON.parse(projectConfig.lore_categories) : [])

          if (!existingCats.includes(finalCategory)) {
            const newCats = [...existingCats, finalCategory]
            await window.api?.updateProjectConfig?.(projectPath, 'lore_categories', newCats, 'json')
            onConfigUpdate?.({ ...projectConfig, lore_categories: newCats })
          }
        } catch (err) {
          console.error('Failed to append new category to project config:', err)
        }
      }

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
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0
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
            <option value="new_category">{t('popup.newCategoryOption', '+ New Category...')}</option>
          </select>
          {category === 'new_category' && (
            <input
              className="popup-search-input"
              style={{ marginTop: '8px' }}
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder={t('popup.newCategoryPlaceholder', 'Type new category...')}
              autoFocus
            />
          )}
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
