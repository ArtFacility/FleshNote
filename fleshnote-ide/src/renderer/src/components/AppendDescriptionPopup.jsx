import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Popup for "Append Description" and "Quick Note" actions.
 * Provides entity search with smart suggestions, then appends
 * the selected text to the chosen entity's bio/description/notes field.
 */
export default function AppendDescriptionPopup({
  selectedText,
  position,
  projectPath,
  activeChapter,
  targetField = 'description', // 'description' or 'notes'
  onClose,
  onSuccess
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [appending, setAppending] = useState(false)
  const inputRef = useRef(null)

  // Auto-focus search input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Search entities
  const doSearch = useCallback(
    async (searchQuery) => {
      if (!projectPath) return
      setLoading(true)
      try {
        const data = await window.api.searchEntities({
          project_path: projectPath,
          query: searchQuery,
          selected_text: selectedText,
          limit: 15
        })
        setResults(data?.entities || [])
      } catch (err) {
        console.error('Entity search failed:', err)
      }
      setLoading(false)
    },
    [projectPath, selectedText]
  )

  // Initial load: show all entities
  useEffect(() => {
    doSearch('')
  }, [doSearch])

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    doSearch(val)
  }

  const handleSelect = async (entity) => {
    setAppending(true)
    try {
      await window.api.appendEntityDescription({
        project_path: projectPath,
        entity_type: entity.type,
        entity_id: entity.id,
        text: selectedText,
        target_field: targetField,
        source_chapter_id: activeChapter?.id || null
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to append description:', err)
    }
    setAppending(false)
  }

  const typeColors = {
    character: 'var(--entity-character)',
    location: 'var(--entity-location)',
    lore: 'var(--entity-item)',
    group: 'var(--accent-amber)'
  }

  const title = targetField === 'notes' ? t('popup.quickNoteTitle', 'Quick Note') : t('popup.appendDescTitle', 'Append Description')

  const truncatedText = selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText
  const subtitle =
    targetField === 'notes'
      ? t('popup.appendToNotes', 'Append to entity notes: "{{text}}"', { text: truncatedText })
      : t('popup.appendToBio', 'Append to entity bio: "{{text}}"', { text: truncatedText })

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 340),
          top: Math.min(position.y, window.innerHeight - 400)
        }}
      >
        <div className="popup-header">
          <span>{title}</span>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="popup-subtitle">{subtitle}</div>

        <input
          ref={inputRef}
          className="popup-search-input"
          type="text"
          placeholder={t('popup.searchEntitiesPlaceholder', 'Search entities...')}
          value={query}
          onChange={handleQueryChange}
        />

        <div className="popup-results">
          {loading && <div className="popup-loading">{t('popup.searching', 'Searching...')}</div>}
          {!loading && results.length === 0 && (
            <div className="popup-loading">{t('popup.noEntitiesFound', 'No entities found.')}</div>
          )}
          {results.map((entity, i) => (
            <button
              key={`${entity.type}-${entity.id}`}
              className={`popup-suggestion-item ${i < 2 && !query ? 'smart' : ''}`}
              onClick={() => handleSelect(entity)}
              disabled={appending}
            >
              <span
                className="popup-entity-dot"
                style={{ background: typeColors[entity.type] || 'var(--text-tertiary)' }}
              />
              <span className="popup-entity-name">{entity.name}</span>
              <span className="popup-entity-type">{entity.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
