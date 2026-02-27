import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Popup for "Make Connection" action.
 * Creates a knowledge_state entry — who learned what, about which entity,
 * in which chapter, and whether it's a secret.
 */
export default function MakeConnectionPopup({
  selectedText,
  position,
  projectPath,
  activeChapter,
  characters = [],
  chapters = [],
  entities = [],
  onClose
}) {
  const { t } = useTranslation()
  const [characterId, setCharacterId] = useState('')
  const [fact, setFact] = useState(selectedText || '')
  const [entitySearch, setEntitySearch] = useState('')
  const [entityResults, setEntityResults] = useState([])
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [learnedInChapter, setLearnedInChapter] = useState(activeChapter?.chapter_number || '')
  const [isSecret, setIsSecret] = useState(false)
  const [revealChapter, setRevealChapter] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEntitySearch, setShowEntitySearch] = useState(false)
  const factRef = useRef(null)

  // Auto-focus fact textarea
  useEffect(() => {
    setTimeout(() => factRef.current?.focus(), 50)
  }, [])

  // Default to POV character if set
  useEffect(() => {
    if (activeChapter?.pov_character_id) {
      setCharacterId(String(activeChapter.pov_character_id))
    }
  }, [activeChapter])

  // Search entities when query changes
  useEffect(() => {
    if (!entitySearch.trim() || !projectPath) {
      setEntityResults([])
      return
    }
    const search = async () => {
      try {
        const data = await window.api.searchEntities({
          project_path: projectPath,
          query: entitySearch,
          limit: 8
        })
        setEntityResults(data?.entities || [])
      } catch (err) {
        console.error('Entity search failed:', err)
      }
    }
    search()
  }, [entitySearch, projectPath])

  const handleSave = async () => {
    if (!characterId || !fact.trim() || !projectPath) return

    setSaving(true)
    try {
      await window.api.createKnowledge({
        project_path: projectPath,
        character_id: parseInt(characterId),
        fact: fact.trim(),
        source_entity_type: selectedEntity?.type || null,
        source_entity_id: selectedEntity?.id || null,
        learned_in_chapter: learnedInChapter ? parseInt(learnedInChapter) : null,
        is_secret: isSecret ? 1 : 0
      })
      onClose()
    } catch (err) {
      console.error('Failed to create knowledge:', err)
    }
    setSaving(false)
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
        className="popup-panel popup-wide"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 400),
          top: Math.min(position.y, window.innerHeight - 500)
        }}
      >
        <div className="popup-header">
          <span>{t('popup.makeConnectionTitle', 'Make Connection')}</span>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="popup-subtitle">{t('popup.makeConnectionSubtitle', 'Create a knowledge entry from the selected text.')}</div>

        {/* Who learned this? */}
        <div className="popup-field">
          <label className="popup-label">{t('popup.whoLearned', 'Who learned this?')}</label>
          <select
            className="popup-select"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
          >
            <option value="">{t('popup.selectCharacter', 'Select character...')}</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* What did they learn? */}
        <div className="popup-field">
          <label className="popup-label">{t('popup.whatDidTheyLearn', 'What did they learn?')}</label>
          <textarea
            ref={factRef}
            className="popup-textarea"
            value={fact}
            onChange={(e) => setFact(e.target.value)}
            rows={3}
            placeholder={t('popup.describeFact', 'Describe the fact or knowledge...')}
          />
        </div>

        {/* About which entity? (optional) */}
        <div className="popup-field">
          <label className="popup-label">
            {t('popup.aboutWhichEntity', 'About which entity?')}
            <span className="popup-optional">{t('popup.optional', '(optional)')}</span>
          </label>
          {selectedEntity ? (
            <div className="popup-selected-entity">
              <span
                className="popup-entity-dot"
                style={{ background: typeColors[selectedEntity.type] || 'var(--text-tertiary)' }}
              />
              <span>{selectedEntity.name}</span>
              <span className="popup-entity-type">{selectedEntity.type}</span>
              <button
                className="popup-entity-clear"
                onClick={() => {
                  setSelectedEntity(null)
                  setShowEntitySearch(true)
                }}
              >
                &times;
              </button>
            </div>
          ) : showEntitySearch ? (
            <>
              <input
                className="popup-search-input"
                type="text"
                placeholder={t('popup.searchEntitiesPlaceholder', 'Search entities...')}
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                autoFocus
              />
              {entityResults.length > 0 && (
                <div className="popup-entity-dropdown">
                  {entityResults.map((ent) => (
                    <button
                      key={`${ent.type}-${ent.id}`}
                      className="popup-suggestion-item"
                      onClick={() => {
                        setSelectedEntity(ent)
                        setShowEntitySearch(false)
                        setEntitySearch('')
                      }}
                    >
                      <span
                        className="popup-entity-dot"
                        style={{ background: typeColors[ent.type] || 'var(--text-tertiary)' }}
                      />
                      <span className="popup-entity-name">{ent.name}</span>
                      <span className="popup-entity-type">{ent.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button className="popup-link-btn" onClick={() => setShowEntitySearch(true)}>
              {t('popup.linkToEntity', '+ Link to entity')}
            </button>
          )}
        </div>

        {/* Learned in chapter */}
        <div className="popup-field-row">
          <div className="popup-field" style={{ flex: 1 }}>
            <label className="popup-label">{t('popup.learnedInChapter', 'Learned in chapter')}</label>
            <select
              className="popup-select"
              value={learnedInChapter}
              onChange={(e) => setLearnedInChapter(e.target.value)}
            >
              <option value="">{t('popup.fromStart', 'From the start')}</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.chapter_number}>
                  {t('popup.chapterPrefixShort', 'Ch.')}{ch.chapter_number}: {ch.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secret toggle */}
        <div className="popup-field">
          <label className="popup-toggle-row">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
            />
            <span>{t('popup.thisIsSecret', 'This is a secret')}</span>
          </label>
        </div>

        {/* Reveal chapter (only if secret) */}
        {isSecret && (
          <div className="popup-field">
            <label className="popup-label">{t('popup.plannedReveal', 'Planned reveal chapter')}</label>
            <select
              className="popup-select"
              value={revealChapter}
              onChange={(e) => setRevealChapter(e.target.value)}
            >
              <option value="">{t('popup.notDecided', 'Not decided')}</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.chapter_number}>
                  {t('popup.chapterPrefixShort', 'Ch.')}{ch.chapter_number}: {ch.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="popup-actions">
          <button className="popup-btn cancel" onClick={onClose}>
            {t('popup.cancel', 'Cancel')}
          </button>
          <button
            className="popup-btn save"
            onClick={handleSave}
            disabled={saving || !characterId || !fact.trim()}
          >
            {saving ? t('popup.saving', 'Saving...') : t('popup.createConnectionBtn', 'Create Connection')}
          </button>
        </div>
      </div>
    </div>
  )
}
