import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export default function AddAliasPopup({ selectedText, position, projectPath, onClose, onSuccess }) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState(false)
    const inputRef = useRef(null)

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50)
    }, [])

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

    useEffect(() => {
        doSearch('')
    }, [doSearch])

    const handleQueryChange = (e) => {
        const val = e.target.value
        setQuery(val)
        doSearch(val)
    }

    const handleSelect = async (entity) => {
        setAdding(true)
        try {
            await window.api.addEntityAlias({
                project_path: projectPath,
                entity_type: entity.type,
                entity_id: entity.id,
                alias: selectedText
            })
            onSuccess?.(entity)
            onClose()
        } catch (err) {
            console.error('Failed to add alias:', err)
        }
        setAdding(false)
    }

    const typeColors = {
        character: 'var(--entity-character)',
        location: 'var(--entity-location)',
        lore: 'var(--entity-item)',
        group: 'var(--accent-amber)'
    }

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div
                className="popup-panel"
                onClick={(e) => e.stopPropagation()}
                style={{
                    insetInlineStart: Math.min(position?.x || 0, window.innerWidth - 340),
                    top: Math.min(position?.y || 0, window.innerHeight - 400)
                }}
            >
                <div className="popup-header">
                    <span>{t('popup.addAliasTitle', 'Add Alias To...')}</span>
                    <button className="popup-close" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <div className="popup-subtitle">{t('popup.addAliasSubtitle', 'Add "{{text}}" as an alias to:', { text: selectedText })}</div>

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
                            key={`alias-search-${entity.type}-${entity.id}`}
                            className={`popup-suggestion-item ${i < 2 && !query ? 'smart' : ''}`}
                            onClick={() => handleSelect(entity)}
                            disabled={adding}
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
