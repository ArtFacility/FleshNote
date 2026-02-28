import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * EntityExtractor — Batch NER extraction wizard.
 *
 * Two modes:
 *   Auto:   chapterTexts provided -> auto-run NER on mount
 *   Manual: no chapterTexts -> paste/load text, then analyze
 *
 * Shows all detected entities in a card list, user classifies
 * each as Character/Location/Lore(subtype)/Skip, then bulk-creates.
 *
 * Features:
 *   - Editable entity names (nameOverride)
 *   - Add lore categories on-the-fly
 *   - Processed items sidebar
 *   - Focus view with keyboard shortcuts
 */

// ─── ICONS ──────────────────────────────────────────────

const Icons = {
  User: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Gem: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M2 9h20" />
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Upload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  X: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Sidebar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  Focus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

// ─── ENTITY TYPE COLORS ─────────────────────────────────

const TYPE_COLORS = {
  character: { css: 'var(--entity-character)', raw: '#d4a052' },
  location: { css: 'var(--entity-location)', raw: '#5c9e6e' },
  lore: { css: 'var(--entity-item)', raw: '#5c8ec4' },
  skip: { css: 'var(--text-tertiary)', raw: '#6b6860' }
}

// ─── SUB-COMPONENTS ─────────────────────────────────────

function SummaryBar({ counts, t }) {
  const items = [
    { key: 'character', label: t('extractor.summaryCharacters'), count: counts.character },
    { key: 'location', label: t('extractor.summaryLocations'), count: counts.location },
    { key: 'lore', label: t('extractor.summaryLore'), count: counts.lore },
    { key: 'skip', label: t('extractor.summarySkipped'), count: counts.skip },
    { key: 'unclassified', label: t('extractor.summaryUnclassified'), count: counts.unclassified }
  ]

  return (
    <div className="ner-summary-bar">
      {items.map((item) => (
        <div key={item.key} className="ner-summary-item" data-type={item.key}>
          <span className="ner-summary-count">{item.count}</span>
          <span className="ner-summary-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function TypeBadge({ type, loreCategory, loreCategories, t }) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.skip
  let label
  if (type === 'character') label = t('extractor.typeCharacter')
  else if (type === 'location') label = t('extractor.typeLocation')
  else if (type === 'lore') {
    const catLabel = loreCategory
      ? loreCategory.charAt(0).toUpperCase() + loreCategory.slice(1)
      : t('extractor.typeLore')
    label = catLabel
  } else if (type === 'skip') label = t('extractor.typeSkip')
  else label = t('extractor.typeUnclassified')

  return (
    <span
      className="ner-type-badge"
      style={{
        background: `${color.raw}18`,
        borderColor: `${color.raw}40`,
        color: color.css
      }}
    >
      {label}
    </span>
  )
}

function FrequencyBar({ frequency, maxFreq }) {
  const pct = Math.min((frequency / maxFreq) * 100, 100)
  return (
    <div className="ner-freq-bar">
      <div className="ner-freq-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function AliasChip({ name, accepted, onToggle }) {
  return (
    <button
      className={`ner-alias-chip ${accepted ? 'accepted' : 'rejected'}`}
      onClick={onToggle}
    >
      {accepted ? <Icons.Check /> : <Icons.X />}
      {name}
    </button>
  )
}

// ─── EDITABLE NAME ──────────────────────────────────────

function EditableName({ entityName, nameOverride, onNameChange, large, t }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const displayName = nameOverride || entityName

  const startEditing = () => {
    setDraft(displayName)
    setEditing(true)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== entityName) {
      onNameChange(entityName, trimmed)
    } else if (!trimmed || trimmed === entityName) {
      onNameChange(entityName, null)
    }
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`ner-name-input ${large ? 'ner-name-input-lg' : ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <span
      className={`ner-entity-name ner-entity-name-editable ${large ? 'ner-entity-name-lg' : ''}`}
      onClick={startEditing}
      title={t('extractor.clickToEditName')}
    >
      {displayName}
      {nameOverride && <span className="ner-name-edited-badge">*</span>}
    </span>
  )
}

// ─── TYPE SELECTOR ──────────────────────────────────────

function TypeSelector({
  entityName, currentType, currentLoreCategory, loreCategories,
  onTypeChange, onLoreCategoryChange, onAddCategory, t
}) {
  const [loreExpanded, setLoreExpanded] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const addInputRef = useRef(null)

  const handleLoreSelect = (category) => {
    onTypeChange(entityName, 'lore')
    onLoreCategoryChange(entityName, category)
    setLoreExpanded(false)
  }

  const handleAddSubmit = () => {
    const trimmed = newCatName.trim().toLowerCase()
    if (trimmed && onAddCategory) {
      onAddCategory(trimmed)
      handleLoreSelect(trimmed)
    }
    setAddingCategory(false)
    setNewCatName('')
  }

  useEffect(() => {
    if (addingCategory && addInputRef.current) addInputRef.current.focus()
  }, [addingCategory])

  return (
    <div className="ner-type-row">
      <button
        className={`ner-type-btn ${currentType === 'character' ? 'active-character' : ''}`}
        onClick={() => onTypeChange(entityName, 'character')}
      >
        {t('extractor.typeCharacter')}
      </button>
      <button
        className={`ner-type-btn ${currentType === 'location' ? 'active-location' : ''}`}
        onClick={() => onTypeChange(entityName, 'location')}
      >
        {t('extractor.typeLocation')}
      </button>
      <button
        className={`ner-type-btn ${currentType === 'lore' ? 'active-lore' : ''}`}
        onClick={() => setLoreExpanded(!loreExpanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {t('extractor.typeLore')}
        <span
          style={{
            fontSize: 8,
            transform: loreExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          &#x25BC;
        </span>
      </button>
      <button
        className={`ner-type-btn ${currentType === 'skip' ? 'active-skip' : ''}`}
        onClick={() => onTypeChange(entityName, 'skip')}
      >
        {t('extractor.typeSkip')}
      </button>

      {loreExpanded && (
        <div className="ner-lore-dropdown">
          {loreCategories.map((cat) => (
            <button
              key={cat}
              className={`ner-lore-option ${currentLoreCategory === cat ? 'active' : ''}`}
              onClick={() => handleLoreSelect(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}

          {/* Add new category */}
          {!addingCategory ? (
            <button
              className="ner-lore-option ner-lore-add-btn"
              onClick={(e) => { e.stopPropagation(); setAddingCategory(true) }}
            >
              + {t('extractor.addCategory')}
            </button>
          ) : (
            <div className="ner-lore-add-row">
              <input
                ref={addInputRef}
                className="ner-lore-add-input"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubmit()
                  if (e.key === 'Escape') { setAddingCategory(false); setNewCatName('') }
                }}
                onBlur={() => { if (!newCatName.trim()) { setAddingCategory(false); setNewCatName('') } }}
                placeholder={t('extractor.newCategoryPlaceholder')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ENTITY CARD ────────────────────────────────────────

function EntityCard({
  entity, edit, maxFreq, loreCategories, isLowConfidence,
  onTypeChange, onLoreCategoryChange, onToggleAlias, onNameChange, onAddCategory, t
}) {
  const isSkipped = edit.type === 'skip'
  const color = TYPE_COLORS[edit.type] || TYPE_COLORS.skip

  return (
    <div className="ner-entity-card" data-skipped={isSkipped}>
      {/* Accent bar at top */}
      {!isSkipped && edit.type && (
        <div
          className="ner-entity-card-accent"
          style={{ background: `linear-gradient(90deg, ${color.raw}80, transparent)` }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Left: name, snippet, aliases, type selector */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div className="ner-entity-header">
            <EditableName
              entityName={entity.name}
              nameOverride={edit.nameOverride}
              onNameChange={onNameChange}
              t={t}
            />
            {edit.type && !isSkipped && (
              <TypeBadge
                type={edit.type}
                loreCategory={edit.loreCategory}
                loreCategories={loreCategories}
                t={t}
              />
            )}
            {isLowConfidence && !edit.type && (
              <span className="ner-low-conf-label">{t('extractor.lowConfSection').toLowerCase()}</span>
            )}
          </div>

          {/* Snippet */}
          <div className="ner-entity-snippet">
            &ldquo;{entity.snippet}&rdquo;
          </div>

          {/* Aliases */}
          {entity.aliases && entity.aliases.length > 0 && !isSkipped && (
            <div className="ner-alias-row">
              <span className="ner-alias-label">{t('extractor.aliases')}:</span>
              {entity.aliases.map((alias, i) => (
                <AliasChip
                  key={alias}
                  name={alias}
                  accepted={edit.aliasesAccepted?.[i] !== false}
                  onToggle={() => onToggleAlias(entity.name, i)}
                />
              ))}
            </div>
          )}

          {/* Type selector */}
          <TypeSelector
            entityName={entity.name}
            currentType={edit.type}
            currentLoreCategory={edit.loreCategory}
            loreCategories={loreCategories}
            onTypeChange={onTypeChange}
            onLoreCategoryChange={onLoreCategoryChange}
            onAddCategory={onAddCategory}
            t={t}
          />
        </div>

        {/* Right: frequency, chapter count */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flexShrink: 0,
            paddingTop: 2
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
            <FrequencyBar frequency={entity.frequency} maxFreq={maxFreq} />
            <span className="ner-freq-label">{entity.frequency}</span>
          </div>
          <span className="ner-freq-label">
            {t('extractor.chapters', { count: entity.chapter_count })}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── PROCESSED ITEMS SIDEBAR ────────────────────────────

function ProcessedSidebar({ entities, entityEdits, loreCategories, t }) {
  if (entities.length === 0) {
    return (
      <div className="ner-sidebar-empty">
        {t('extractor.sidebarEmpty')}
      </div>
    )
  }

  return (
    <div className="ner-sidebar-list">
      {entities.map((entity) => {
        const edit = entityEdits[entity.name] || {}
        const displayName = edit.nameOverride || entity.name
        const aliasCount = (entity.aliases || []).filter(
          (_, i) => edit.aliasesAccepted?.[i] !== false
        ).length

        return (
          <div key={entity.name} className="ner-sidebar-item">
            <TypeBadge
              type={edit.type}
              loreCategory={edit.loreCategory}
              loreCategories={loreCategories}
              t={t}
            />
            <span className="ner-sidebar-name" title={displayName}>{displayName}</span>
            {aliasCount > 0 && (
              <span className="ner-sidebar-alias-count">+{aliasCount}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── FOCUS VIEW ─────────────────────────────────────────

function FocusView({
  entity, edit, index, total, classifiedCount, maxFreq,
  loreCategories, onTypeChange, onLoreCategoryChange,
  onToggleAlias, onNameChange, onAddCategory, onPrev, onNext, t
}) {
  if (!entity) {
    return (
      <div className="ner-focus-done">
        <Icons.Check />
        <span>{t('extractor.allClassified')}</span>
      </div>
    )
  }

  const isLowConf = !entity.suggested_type || entity.frequency < 2

  return (
    <div className="ner-focus-card">
      {/* Progress */}
      <div className="ner-focus-progress">
        <span className="ner-focus-progress-text">
          {classifiedCount} / {total} {t('extractor.focusClassified')}
        </span>
        <div className="ner-focus-progress-bar">
          <div
            className="ner-focus-progress-fill"
            style={{ width: `${(classifiedCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Entity name (large) */}
      <div className="ner-focus-name-row">
        <EditableName
          entityName={entity.name}
          nameOverride={edit.nameOverride}
          onNameChange={onNameChange}
          large
          t={t}
        />
        {edit.type && edit.type !== 'skip' && (
          <TypeBadge type={edit.type} loreCategory={edit.loreCategory} loreCategories={loreCategories} t={t} />
        )}
        {isLowConf && !edit.type && (
          <span className="ner-low-conf-label">{t('extractor.lowConfSection').toLowerCase()}</span>
        )}
      </div>

      {/* Snippet */}
      <div className="ner-focus-snippet">
        &ldquo;{entity.snippet}&rdquo;
      </div>

      {/* Frequency + chapter info */}
      <div className="ner-focus-meta">
        <FrequencyBar frequency={entity.frequency} maxFreq={maxFreq} />
        <span className="ner-freq-label">{entity.frequency}x</span>
        <span className="ner-freq-label">&middot;</span>
        <span className="ner-freq-label">{t('extractor.chapters', { count: entity.chapter_count })}</span>
      </div>

      {/* Aliases */}
      {entity.aliases && entity.aliases.length > 0 && edit.type !== 'skip' && (
        <div className="ner-alias-row" style={{ justifyContent: 'center' }}>
          <span className="ner-alias-label">{t('extractor.aliases')}:</span>
          {entity.aliases.map((alias, i) => (
            <AliasChip
              key={alias}
              name={alias}
              accepted={edit.aliasesAccepted?.[i] !== false}
              onToggle={() => onToggleAlias(entity.name, i)}
            />
          ))}
        </div>
      )}

      {/* Large type selector buttons */}
      <div className="ner-focus-type-selector">
        <TypeSelector
          entityName={entity.name}
          currentType={edit.type}
          currentLoreCategory={edit.loreCategory}
          loreCategories={loreCategories}
          onTypeChange={onTypeChange}
          onLoreCategoryChange={onLoreCategoryChange}
          onAddCategory={onAddCategory}
          t={t}
        />
      </div>

      {/* Hotkey hints */}
      <div className="ner-focus-hotkeys">
        <span className="ner-focus-hotkey"><kbd>1</kbd> {t('extractor.typeCharacter')}</span>
        <span className="ner-focus-hotkey"><kbd>2</kbd> {t('extractor.typeLocation')}</span>
        <span className="ner-focus-hotkey"><kbd>3</kbd> {t('extractor.typeLore')}</span>
        <span className="ner-focus-hotkey"><kbd>4</kbd> {t('extractor.typeSkip')}</span>
        <span className="ner-focus-hotkey"><kbd>E</kbd> {t('extractor.editHotkey')}</span>
        <span className="ner-focus-hotkey"><kbd>&larr;</kbd><kbd>&rarr;</kbd> {t('extractor.navigateHotkey')}</span>
      </div>

      {/* Navigation */}
      <div className="ner-focus-nav">
        <button className="ner-type-btn" disabled={index <= 0} onClick={onPrev}>
          &larr; {t('extractor.focusPrev')}
        </button>
        <span className="ner-freq-label">{index + 1} / {total}</span>
        <button className="ner-type-btn" disabled={index >= total - 1} onClick={onNext}>
          {t('extractor.focusNext')} &rarr;
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function EntityExtractor({ projectPath, projectConfig, onDone, onBack, chapterTexts }) {
  const { t } = useTranslation()

  // Phase: 'input' | 'analyzing' | 'review' | 'creating' | 'error'
  const [phase, setPhase] = useState(chapterTexts ? 'analyzing' : 'input')
  const [rawText, setRawText] = useState('')
  const [confidentEntities, setConfidentEntities] = useState([])
  const [lowConfEntities, setLowConfEntities] = useState([])
  const [entityEdits, setEntityEdits] = useState({})
  const [lowConfCollapsed, setLowConfCollapsed] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Feature 2: mutable lore categories
  const parsedLoreCategories = useMemo(() => {
    try {
      const raw = projectConfig?.lore_categories
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return ['item']
  }, [projectConfig])

  const [localLoreCategories, setLocalLoreCategories] = useState(parsedLoreCategories)
  useEffect(() => { setLocalLoreCategories(parsedLoreCategories) }, [parsedLoreCategories])

  // Feature 3: sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Feature 4: focus view
  const [viewMode, setViewMode] = useState('card') // 'card' | 'focus'
  const [focusIndex, setFocusIndex] = useState(0)

  // Auto-run NER if chapterTexts provided
  useEffect(() => {
    if (chapterTexts && chapterTexts.length > 0) {
      runAnalysis(chapterTexts)
    }
  }, [])

  // ── Analysis ──────────────────────────────────────────

  const runAnalysis = async (texts) => {
    setPhase('analyzing')
    setErrorMsg('')

    try {
      const payload = {
        project_path: projectPath,
        language: projectConfig?.story_language || 'en'
      }

      if (texts) {
        payload.texts = texts.map((t, i) => ({
          index: t.index ?? i,
          title: t.title || `Section ${i + 1}`,
          content: t.content || ''
        }))
      } else {
        payload.text = rawText
      }

      const result = await window.api.importNerAnalyze(payload)

      setConfidentEntities(result.confident || [])
      setLowConfEntities(result.low_confidence || [])

      // Initialize edits
      const edits = {}
      for (const entity of [...(result.confident || []), ...(result.low_confidence || [])]) {
        edits[entity.name] = {
          type: entity.suggested_type || null,
          loreCategory: entity.suggested_type === 'lore'
            ? (localLoreCategories[0] || 'item')
            : null,
          aliasesAccepted: (entity.aliases || []).map(() => true),
          nameOverride: null
        }
      }
      setEntityEdits(edits)
      setPhase('review')
    } catch (err) {
      console.error('NER analysis failed:', err)
      setErrorMsg(err.message || t('extractor.errorAnalysis'))
      setPhase('error')
    }
  }

  // ── Edit helpers ──────────────────────────────────────

  const handleTypeChange = (entityName, newType) => {
    setEntityEdits((prev) => ({
      ...prev,
      [entityName]: {
        ...prev[entityName],
        type: newType,
        loreCategory:
          newType === 'lore'
            ? prev[entityName]?.loreCategory || localLoreCategories[0] || 'item'
            : prev[entityName]?.loreCategory
      }
    }))
  }

  const handleLoreCategoryChange = (entityName, category) => {
    setEntityEdits((prev) => ({
      ...prev,
      [entityName]: { ...prev[entityName], loreCategory: category }
    }))
  }

  const handleToggleAlias = (entityName, aliasIndex) => {
    setEntityEdits((prev) => {
      const accepted = [...(prev[entityName]?.aliasesAccepted || [])]
      accepted[aliasIndex] = !accepted[aliasIndex]
      return {
        ...prev,
        [entityName]: { ...prev[entityName], aliasesAccepted: accepted }
      }
    })
  }

  // Feature 1: name editing
  const handleNameChange = (entityName, newName) => {
    setEntityEdits((prev) => ({
      ...prev,
      [entityName]: { ...prev[entityName], nameOverride: newName || null }
    }))
  }

  // Feature 2: add lore category
  const handleAddLoreCategory = async (newCategory) => {
    const normalized = newCategory.trim().toLowerCase()
    if (!normalized || localLoreCategories.includes(normalized)) return

    const updated = [...localLoreCategories, normalized]
    setLocalLoreCategories(updated)

    try {
      await window.api.updateProjectConfig(projectPath, 'lore_categories', updated, 'json')
    } catch (err) {
      console.error('Failed to persist lore category:', err)
    }
  }

  // ── Live summary ──────────────────────────────────────

  const liveCounts = useMemo(() => {
    const counts = { character: 0, location: 0, lore: 0, skip: 0, unclassified: 0 }
    const allEntities = [...confidentEntities, ...lowConfEntities]
    for (const entity of allEntities) {
      const edit = entityEdits[entity.name]
      if (!edit || !edit.type) {
        counts.unclassified++
      } else if (edit.type === 'skip') {
        counts.skip++
      } else {
        counts[edit.type] = (counts[edit.type] || 0) + 1
      }
    }
    return counts
  }, [confidentEntities, lowConfEntities, entityEdits])

  const maxFreq = useMemo(() => {
    const all = [...confidentEntities, ...lowConfEntities]
    return Math.max(...all.map((e) => e.frequency), 1)
  }, [confidentEntities, lowConfEntities])

  // Feature 3: classified entities for sidebar
  const classifiedEntities = useMemo(() => {
    const all = [...confidentEntities, ...lowConfEntities]
    return all.filter((entity) => {
      const edit = entityEdits[entity.name]
      return edit && edit.type && edit.type !== 'skip'
    })
  }, [confidentEntities, lowConfEntities, entityEdits])

  // Feature 4: focus view data
  const focusEntities = useMemo(
    () => [...confidentEntities, ...lowConfEntities],
    [confidentEntities, lowConfEntities]
  )

  const classifiedCount = useMemo(() => {
    return focusEntities.filter((e) => {
      const edit = entityEdits[e.name]
      return edit && edit.type
    }).length
  }, [focusEntities, entityEdits])

  const findNextUnclassified = (startFrom = 0) => {
    for (let i = startFrom; i < focusEntities.length; i++) {
      const edit = entityEdits[focusEntities[i].name]
      if (!edit || !edit.type) return i
    }
    // Wrap from beginning
    for (let i = 0; i < startFrom; i++) {
      const edit = entityEdits[focusEntities[i].name]
      if (!edit || !edit.type) return i
    }
    return -1
  }

  // Focus mode: auto-advance after classification
  const handleFocusTypeChange = (entityName, newType) => {
    handleTypeChange(entityName, newType)
    setTimeout(() => {
      const nextIdx = findNextUnclassified(focusIndex + 1)
      if (nextIdx >= 0) {
        setFocusIndex(nextIdx)
      } else {
        // All classified — advance to next in list
        setFocusIndex((prev) => Math.min(prev + 1, focusEntities.length - 1))
      }
    }, 120)
  }

  // Feature 4: keyboard handler
  useEffect(() => {
    if (phase !== 'review' || viewMode !== 'focus') return

    const handleKey = (e) => {
      // Don't intercept when input/textarea focused
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const entity = focusEntities[focusIndex]
      if (!entity) return

      switch (e.key) {
        case '1':
          e.preventDefault()
          handleFocusTypeChange(entity.name, 'character')
          break
        case '2':
          e.preventDefault()
          handleFocusTypeChange(entity.name, 'location')
          break
        case '3':
          e.preventDefault()
          handleTypeChange(entity.name, 'lore')
          handleLoreCategoryChange(entity.name, localLoreCategories[0] || 'item')
          setTimeout(() => {
            const nextIdx = findNextUnclassified(focusIndex + 1)
            if (nextIdx >= 0) setFocusIndex(nextIdx)
            else setFocusIndex((prev) => Math.min(prev + 1, focusEntities.length - 1))
          }, 120)
          break
        case '4':
        case 'x':
        case 'X':
          e.preventDefault()
          handleFocusTypeChange(entity.name, 'skip')
          break
        case 'Backspace':
          e.preventDefault()
          handleFocusTypeChange(entity.name, 'skip')
          break
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault()
          setFocusIndex((prev) => Math.min(prev + 1, focusEntities.length - 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setFocusIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'e':
        case 'E':
          // Trigger name edit — click the name element
          e.preventDefault()
          const nameEl = document.querySelector('.ner-focus-name-row .ner-entity-name-editable')
          if (nameEl) nameEl.click()
          break
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [phase, viewMode, focusIndex, focusEntities, entityEdits, localLoreCategories])

  // ── Confirm & create ──────────────────────────────────

  const handleConfirm = async () => {
    const allEntities = [...confidentEntities, ...lowConfEntities]
    const toCreate = []

    for (const entity of allEntities) {
      const edit = entityEdits[entity.name]
      if (!edit || !edit.type || edit.type === 'skip') continue

      const acceptedAliases = (entity.aliases || []).filter(
        (_, i) => edit.aliasesAccepted?.[i] !== false
      )

      toCreate.push({
        name: edit.nameOverride || entity.name,
        type: edit.type,
        lore_category: edit.type === 'lore' ? edit.loreCategory : null,
        aliases: acceptedAliases
      })
    }

    if (toCreate.length === 0) {
      onDone()
      return
    }

    setPhase('creating')

    try {
      await window.api.importBulkCreateEntities({
        project_path: projectPath,
        entities: toCreate
      })
      onDone()
    } catch (err) {
      console.error('Bulk create failed:', err)
      setErrorMsg(err.message || t('extractor.errorCreate'))
      setPhase('error')
    }
  }

  // ── File loading (manual mode) ────────────────────────

  const handleOpenFile = async () => {
    const filePath = await window.api.openFile([
      { name: 'Text Files', extensions: ['txt', 'md', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (filePath) {
      try {
        const result = await window.api.importSplitPreview({
          project_path: projectPath,
          file_path: filePath
        })
        if (result && result.splits) {
          const fullText = result.splits.map((s) => s.content).join('\n\n')
          setRawText(fullText)
        }
      } catch (err) {
        console.error('Failed to load file:', err)
      }
    }
  }

  // ── RENDER: Input phase (manual mode) ─────────────────

  if (phase === 'input') {
    return (
      <div className="ner-container">
        <div className="ner-header">
          <h3 className="ner-title">{t('extractor.title')}</h3>
          <p className="ner-subtitle">{t('extractor.pastePrompt')}</p>
        </div>

        <div className="ner-input-area">
          <textarea
            className="ner-paste-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t('extractor.pastePrompt')}
          />

          <div className="ner-paste-toolbar">
            <button className="setup-btn secondary" onClick={handleOpenFile}>
              <Icons.Upload /> {t('extractor.openFile')}
            </button>

            <button
              className="setup-btn primary"
              onClick={() => runAnalysis(null)}
              disabled={!rawText.trim()}
              style={{ marginInlineStart: 'auto' }}
            >
              <Icons.Zap /> {t('extractor.analyze')}
            </button>
          </div>
        </div>

        <div className="ner-action-bar">
          <button className="ner-skip-link" onClick={onDone}>
            {t('extractor.skipForNow')}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: Analyzing phase ───────────────────────────

  if (phase === 'analyzing') {
    return (
      <div className="ner-container">
        <div className="ner-loading">
          <Icons.Zap />
          <span className="ner-loading-text">
            {chapterTexts
              ? t('extractor.analyzingChapters', { count: chapterTexts.length })
              : t('extractor.analyzingText')}
          </span>
        </div>
      </div>
    )
  }

  // ── RENDER: Error phase ───────────────────────────────

  if (phase === 'error') {
    return (
      <div className="ner-container">
        <div className="ner-empty">
          <div className="ner-empty-title">{t('extractor.errorAnalysis')}</div>
          <div className="ner-empty-hint">{errorMsg}</div>
          <button
            className="setup-btn secondary"
            style={{ marginTop: 16 }}
            onClick={() => {
              if (chapterTexts) runAnalysis(chapterTexts)
              else setPhase('input')
            }}
          >
            {t('extractor.retry')}
          </button>
          <button className="ner-skip-link" style={{ marginTop: 8 }} onClick={onDone}>
            {t('extractor.skipForNow')}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: Creating phase ────────────────────────────

  if (phase === 'creating') {
    return (
      <div className="ner-container">
        <div className="ner-loading">
          <Icons.Zap />
          <span className="ner-loading-text">{t('extractor.creating')}</span>
        </div>
      </div>
    )
  }

  // ── RENDER: Review phase (main view) ──────────────────

  const hasEntities = confidentEntities.length > 0 || lowConfEntities.length > 0

  if (!hasEntities) {
    return (
      <div className="ner-container">
        <div className="ner-empty">
          <div className="ner-empty-title">{t('extractor.noEntities')}</div>
          <div className="ner-empty-hint">{t('extractor.noEntitiesHint')}</div>
        </div>
        <div className="ner-action-bar">
          <button className="setup-btn secondary" onClick={() => setPhase('input')}>
            {t('extractor.back')}
          </button>
          <button className="ner-skip-link" onClick={onDone}>
            {t('extractor.skipForNow')}
          </button>
        </div>
      </div>
    )
  }

  const lowConfClassified = lowConfEntities.filter(
    (e) => entityEdits[e.name]?.type && entityEdits[e.name]?.type !== 'skip'
  ).length

  // Shared props for EntityCard
  const cardProps = {
    maxFreq,
    loreCategories: localLoreCategories,
    onTypeChange: handleTypeChange,
    onLoreCategoryChange: handleLoreCategoryChange,
    onToggleAlias: handleToggleAlias,
    onNameChange: handleNameChange,
    onAddCategory: handleAddLoreCategory,
    t
  }

  return (
    <div className="ner-container">
      {/* Header */}
      <div className="ner-header">
        <div className="ner-header-row">
          <div>
            <h3 className="ner-title">{t('extractor.title')}</h3>
            <p className="ner-subtitle">{t('extractor.subtitle')}</p>
          </div>
          <div className="ner-header-actions">
            {/* Focus view toggle */}
            <button
              className={`ner-view-toggle ${viewMode === 'focus' ? 'active' : ''}`}
              onClick={() => {
                if (viewMode === 'card') {
                  setViewMode('focus')
                  const nextIdx = findNextUnclassified(0)
                  if (nextIdx >= 0) setFocusIndex(nextIdx)
                  else setFocusIndex(0)
                } else {
                  setViewMode('card')
                }
              }}
              title={t('extractor.toggleFocusView')}
            >
              <Icons.Focus />
            </button>
            {/* Sidebar toggle */}
            <button
              className={`ner-view-toggle ${sidebarOpen ? 'active' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={t('extractor.toggleSidebar')}
            >
              <Icons.Sidebar />
              {classifiedEntities.length > 0 && (
                <span className="ner-sidebar-badge">{classifiedEntities.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <SummaryBar counts={liveCounts} t={t} />

      {/* Main content area */}
      {viewMode === 'card' ? (
        <div className="ner-content-row">
          {/* Scrollable entity area */}
          <div className="ner-scroll-area">
            {/* Confident matches */}
            {confidentEntities.length > 0 && (
              <div>
                <div className="ner-section-header">
                  <span className="ner-section-label">{t('extractor.confidentSection')}</span>
                  <span className="ner-section-count">
                    &mdash; {confidentEntities.length} {t('extractor.found')}
                  </span>
                  <div className="ner-section-line" />
                </div>

                <div className="ner-entity-list">
                  {confidentEntities.map((entity) => (
                    <EntityCard
                      key={entity.name}
                      entity={entity}
                      edit={entityEdits[entity.name] || {}}
                      isLowConfidence={false}
                      {...cardProps}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Low confidence section */}
            {lowConfEntities.length > 0 && (
              <div className="ner-low-conf-section">
                <button
                  className="ner-low-conf-toggle"
                  onClick={() => setLowConfCollapsed(!lowConfCollapsed)}
                >
                  <span className="ner-section-label" style={{ color: 'var(--accent-amber)' }}>
                    {t('extractor.lowConfSection')}
                  </span>
                  <span className="ner-section-count">
                    &mdash; {lowConfEntities.length} {t('extractor.found')}
                    {lowConfClassified > 0 && (
                      <span style={{ color: 'var(--accent-green)', marginInlineStart: 8 }}>
                        {lowConfClassified} classified
                      </span>
                    )}
                  </span>
                  <div className="ner-section-line" />
                  <span
                    className="ner-low-conf-arrow"
                    style={{
                      transform: lowConfCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
                    }}
                  >
                    &#x25BC;
                  </span>
                </button>

                {!lowConfCollapsed && (
                  <div className="ner-entity-list">
                    {lowConfEntities.map((entity) => (
                      <EntityCard
                        key={entity.name}
                        entity={entity}
                        edit={entityEdits[entity.name] || {}}
                        isLowConfidence={true}
                        {...cardProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="ner-sidebar">
              <div className="ner-sidebar-header">
                <span className="ner-section-label">{t('extractor.sidebarTitle')}</span>
                <span className="ner-section-count">{classifiedEntities.length}</span>
              </div>
              <ProcessedSidebar
                entities={classifiedEntities}
                entityEdits={entityEdits}
                loreCategories={localLoreCategories}
                t={t}
              />
            </div>
          )}
        </div>
      ) : (
        /* Focus view */
        <FocusView
          entity={focusEntities[focusIndex]}
          edit={entityEdits[focusEntities[focusIndex]?.name] || {}}
          index={focusIndex}
          total={focusEntities.length}
          classifiedCount={classifiedCount}
          maxFreq={maxFreq}
          loreCategories={localLoreCategories}
          onTypeChange={handleFocusTypeChange}
          onLoreCategoryChange={handleLoreCategoryChange}
          onToggleAlias={handleToggleAlias}
          onNameChange={handleNameChange}
          onAddCategory={handleAddLoreCategory}
          onPrev={() => setFocusIndex((prev) => Math.max(prev - 1, 0))}
          onNext={() => setFocusIndex((prev) => Math.min(prev + 1, focusEntities.length - 1))}
          t={t}
        />
      )}

      {/* Action bar */}
      <div className="ner-action-bar">
        <button
          className="setup-btn secondary"
          onClick={() => {
            if (chapterTexts && onBack) onBack()
            else if (chapterTexts) onDone()
            else setPhase('input')
          }}
        >
          {t('extractor.back')}
        </button>

        <button className="ner-skip-link" onClick={onDone}>
          {t('extractor.skipForNow')}
        </button>

        <button
          className="setup-btn primary"
          style={{ marginInlineStart: 'auto' }}
          onClick={handleConfirm}
        >
          {t('extractor.confirm')}
        </button>
      </div>
    </div>
  )
}
