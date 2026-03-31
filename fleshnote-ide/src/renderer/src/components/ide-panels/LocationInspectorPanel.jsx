import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import EntityRenamePopup from '../EntityRenamePopup'

const Icons = {
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  BookOpen: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Target: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Feather: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Brain: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TypeIcon() {
  return <Icons.MapPin />
}

export default function LocationInspectorPanel({
  entity, entities, characters, activeChapter, projectPath, projectConfig, chapters, onEntityUpdated, initialTab, onNavigateToMark, onReloadCurrentChapter, onFlushEditorSave
}) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState('author')
  const [filterCharacterId, setFilterCharacterId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab || 'overview')
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [knowledgeFacts, setKnowledgeFacts] = useState([])
  const [addingFact, setAddingFact] = useState(false)
  const [newFact, setNewFact] = useState({ fact: '', character_id: '', is_secret: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingFactId, setEditingFactId] = useState(null)
  const [editFactData, setEditFactData] = useState({ fact: '', is_secret: 0 })
  const [renameData, setRenameData] = useState(null)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  const currEntity = entities.find(e => String(e.id) === String(entity.id) && e.type === 'location') || entity
  const locationData = currEntity

  useEffect(() => {
    if (activeChapter?.pov_character_id) {
      setFilterCharacterId(activeChapter.pov_character_id)
    }
  }, [activeChapter?.pov_character_id])

  const loadKnowledgeFacts = useCallback(async () => {
    if (!entity || !projectPath) return
    try {
      const params = {
        project_path: projectPath,
        source_entity_type: 'location',
        source_entity_id: entity.id,
        filter_mode: viewMode
      }
      if (viewMode !== 'author') {
        params.filter_character_id = filterCharacterId || null
      }
      if (viewMode === 'narrative' && activeChapter?.chapter_number) {
        params.current_chapter = activeChapter.chapter_number
      } else if (viewMode === 'world_time' || (viewMode === 'author' && activeChapter?.world_time)) {
        params.current_world_time = activeChapter?.world_time || null
      }
      const result = await window.api.getKnowledgeForEntity(params)
      setKnowledgeFacts(result?.facts || [])
    } catch (err) {
      console.error('Failed to load knowledge facts:', err)
      setKnowledgeFacts([])
    }
  }, [entity?.id, projectPath, viewMode, filterCharacterId, activeChapter?.chapter_number, activeChapter?.world_time])

  useEffect(() => {
    loadKnowledgeFacts()
  }, [loadKnowledgeFacts, currEntity?.updated_at])

  useEffect(() => {
    setEditMode(false)
    setAddingFact(false)
  }, [entity?.id])

  useEffect(() => {
    if (!projectConfig?.track_dual_timeline && viewMode === 'world_time') {
      setViewMode('author')
    }
  }, [projectConfig?.track_dual_timeline])

  if (!entity) return null

  const enterEditMode = () => {
    setEditData({
      name: locationData.name || '',
      region: locationData.region || '',
      description: locationData.description || '',
      notes: locationData.notes || '',
      aliases: (locationData.aliases || []).join(', '),
      parent_location_id: locationData.parent_location_id || ''
    })
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditData({})
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const aliasArray = editData.aliases ? editData.aliases.split(',').map((a) => a.trim()).filter(Boolean) : []
      await window.api.updateLocation({
        project_path: projectPath,
        location_id: currEntity.id,
        name: editData.name,
        region: editData.region,
        description: editData.description,
        notes: editData.notes,
        aliases: aliasArray,
        parent_location_id: editData.parent_location_id ? parseInt(editData.parent_location_id) : null
      })

      const oldName = entity.name
      const newName = editData.name
      const nameChanged = oldName !== newName && !!oldName && !!newName && !aliasArray.includes(newName)

      await onEntityUpdated?.()

      if (nameChanged) {
        await onFlushEditorSave?.()
        setRenameData({
          oldName,
          newName,
          entity: { ...entity, name: newName }
        })
      } else {
        setEditMode(false)
      }
    } catch (err) {
      console.error('Failed to save location:', err)
    }
    setSaving(false)
  }

  const handleEditField = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddFact = async () => {
    if (!newFact.fact.trim() || !newFact.character_id) return
    try {
      await window.api.createKnowledge({
        project_path: projectPath,
        fact: newFact.fact,
        learned_in_chapter: activeChapter?.id || null,
        is_secret: newFact.is_secret,
        character_id: parseInt(newFact.character_id),
        source_entity_type: 'location',
        source_entity_id: entity.id
      })
      setNewFact({ fact: '', character_id: '', is_secret: 0 })
      setAddingFact(false)
      loadKnowledgeFacts()
    } catch (err) { }
  }

  const handleDeleteFact = async (factId) => {
    try {
      await window.api.deleteKnowledge({ project_path: projectPath, knowledge_state_id: factId })
      loadKnowledgeFacts()
    } catch (err) { }
  }

  const handleUpdateFact = async () => {
    if (!editingFactId || !editFactData.fact.trim()) return
    try {
      await window.api.updateKnowledge({
        project_path: projectPath, knowledge_state_id: editingFactId,
        fact: editFactData.fact, is_secret: editFactData.is_secret
      })
      setEditingFactId(null)
      loadKnowledgeFacts()
    } catch (err) { }
  }

  const handleConfirmDeleteEntity = async () => {
    setShowDeleteConfirm(false)
    try {
      await window.api.deleteLocation({ project_path: projectPath, location_id: entity.id })
      await window.api.updateStat({ project_path: projectPath, stat_key: 'deleted_entities', increment_by: 1 })
      onEntityUpdated?.()
      window.dispatchEvent(new CustomEvent('forceBackToChapters'))
    } catch (err) { }
  }

  const renderEditField = (label, field, multiline = false) => {
    const Component = multiline ? 'textarea' : 'input'
    return (
      <div className="entity-edit-field">
        <label className="entity-edit-label">{label}</label>
        <Component
          className={multiline ? 'entity-edit-textarea' : 'entity-edit-input'}
          value={editData[field] || ''}
          onChange={(e) => handleEditField(field, e.target.value)}
          rows={multiline ? 3 : undefined}
        />
      </div>
    )
  }

  const getChapterLabel = (chapterId) => {
    if (!chapterId) return t('inspector.fromStart', 'from the start')
    const ch = chapters?.find((c) => c.id === chapterId)
    return ch ? `${t('inspector.chapterPrefixShort', 'Ch.')}${ch.chapter_number}` : `${t('inspector.chapterPrefixShort', 'Ch.')}?`
  }

  return (
    <div>
      <div className="epistemic-mode-bar" style={{ margin: '-16px -16px 0', width: 'calc(100% + 32px)' }}>
        <button className={`epistemic-mode-btn ${viewMode === 'author' ? 'active' : ''}`} onClick={() => setViewMode('author')} title={t('inspector.viewAuthorTooltip', 'Show all knowledge — unfiltered')}>
          <Icons.Eye /> {t('inspector.viewAuthorShort', 'Author')}
        </button>
        <button className={`epistemic-mode-btn ${viewMode === 'narrative' ? 'active' : ''}`} onClick={() => setViewMode('narrative')} title={t('inspector.viewNarrativeTooltip', 'Filter by reading order (chapter sequence)')}>
          <Icons.BookOpen /> {t('inspector.viewNarrativeShort', 'Narrative')}
        </button>
        {projectConfig?.track_dual_timeline && (
          <button className={`epistemic-mode-btn ${viewMode === 'world_time' ? 'active' : ''}`} onClick={() => setViewMode('world_time')} title={t('inspector.viewWorldTimeTooltip', 'Filter by in-universe chronological time')}>
            <Icons.Clock /> {t('inspector.viewWorldTimeShort', 'World Time')}
          </button>
        )}
      </div>

      {viewMode !== 'author' && (
        <div className="epistemic-character-filter" style={{ margin: '0 -16px 16px', width: 'calc(100% + 32px)' }}>
          <select className="epistemic-filter-select" value={filterCharacterId || ''} onChange={(e) => setFilterCharacterId(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">{t('inspector.allCharacters', 'All characters')}</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {viewMode === 'author' && <div style={{ marginBottom: '16px' }} />}

      <div className="entity-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="entity-type-badge location">
            <TypeIcon /> {t('inspector.typeLocation', 'Location')}
          </div>
          {!editMode ? (
            <button className="entity-edit-toggle" onClick={enterEditMode} title={t('inspector.edit', 'Edit')}>
              <Icons.Edit />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="entity-edit-toggle save" onClick={saveEdit} disabled={saving} title={t('inspector.save', 'Save')}>
                <Icons.Check />
              </button>
              <button className="entity-edit-toggle" onClick={cancelEdit} title={t('inspector.cancel', 'Cancel')}>
                <Icons.X />
              </button>
            </div>
          )}
        </div>

        {editMode ? renderEditField(t('inspector.nameLabel', 'Name'), 'name') : <div className="entity-name">{locationData.name}</div>}
        {!editMode && locationData.region && <div className="entity-subtitle">{locationData.region}</div>}
      </div>

      <div className="inspector-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '16px -16px 16px', padding: '0 16px', gap: '16px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{ background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', color: activeTab === 'overview' ? 'var(--accent-amber)' : 'var(--text-secondary)', borderBottom: activeTab === 'overview' ? '2px solid var(--accent-amber)' : '2px solid transparent', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}
        >
          <Icons.BookOpen style={{ width: 14, height: 14, marginRight: activeTab === 'overview' ? 4 : 0 }} /> {activeTab === 'overview' && t('inspector.tabOverview', 'Overview')}
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          style={{ background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', color: activeTab === 'knowledge' ? 'var(--accent-amber)' : 'var(--text-secondary)', borderBottom: activeTab === 'knowledge' ? '2px solid var(--accent-amber)' : '2px solid transparent', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}
        >
          <Icons.Brain style={{ width: 14, height: 14, marginRight: activeTab === 'knowledge' ? 4 : 0 }} /> {activeTab === 'knowledge' && t('inspector.tabKnowledge', 'Knowledge Database')}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="entity-section">
            <div className="entity-section-title"><Icons.BookOpen /> {t('inspector.descriptionSection', 'Description')}</div>
            {editMode ? renderEditField('', 'description', true) : <div className="entity-bio">{locationData.description || t('inspector.noDescription', 'No description yet.')}</div>}
          </div>

          <div className="entity-section">
            <div className="entity-section-title"><Icons.Target /> {t('inspector.locationDetails', 'Location Details')}</div>
            {editMode ? (
              <>
                {renderEditField(t('inspector.regionLabel', 'Region'), 'region')}
                {renderEditField(t('inspector.parentLocationId', 'Parent Location ID (optional)'), 'parent_location_id')}
              </>
            ) : (
              <>
                {locationData.region && <div className="entity-detail-row"><div className="entity-detail-label">{t('inspector.region', 'Region')}</div><div className="entity-detail-value">{locationData.region}</div></div>}
                {locationData.parent_location_id && <div className="entity-detail-row"><div className="entity-detail-label">{t('inspector.parentLocation', 'Parent ID')}</div><div className="entity-detail-value">#{locationData.parent_location_id}</div></div>}
              </>
            )}
          </div>

          <div className="entity-section">
            <div className="entity-section-title"><Icons.Eye /> {t('inspector.aliasesSection', 'Aliases')}</div>
            {editMode ? renderEditField(t('inspector.commaSeparated', 'Comma-separated'), 'aliases') : currEntity.aliases && currEntity.aliases.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {currEntity.aliases.map((a, i) => <div className="entity-property-item" key={i}>{a}</div>)}
              </div>
            ) : <div className="entity-detail-value" style={{ opacity: 0.5 }}>{t('inspector.none', 'None')}</div>}
          </div>

          <div className="entity-section">
            <div className="entity-section-title"><Icons.Feather /> {t('inspector.authorNotesSection', 'Author Notes')}</div>
            {editMode ? renderEditField('', 'notes', true) : <div className="entity-narrative-note">{locationData.notes || t('inspector.noNotes', 'No notes.')}</div>}
          </div>
        </>
      )}

      {activeTab === 'knowledge' && (
        <div className="entity-section" style={{ marginTop: 0 }}>
          <div className="entity-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><Icons.Brain /> {t('inspector.knowledgeSection', 'Knowledge')}</span>
            {viewMode === 'author' && <button className="entity-edit-toggle" onClick={() => setAddingFact(!addingFact)} title={t('inspector.addFactTooltip', 'Add Fact')} style={{ marginInlineStart: 'auto' }}><Icons.Plus /></button>}
          </div>

          {viewMode === 'world_time' && !activeChapter?.world_time && <div className="knowledge-no-pov">{t('inspector.noWorldTime', 'No world time set for this chapter. Set a world time in the chapter metadata to filter.')}</div>}
          
          {addingFact && viewMode === 'author' && (
            <div className="knowledge-add-form">
              <textarea className="entity-edit-textarea" placeholder={t('inspector.whatIsFact', 'What is the fact?')} value={newFact.fact} onChange={(e) => setNewFact((p) => ({ ...p, fact: e.target.value }))} rows={2} />
              <select className="knowledge-select" value={newFact.character_id} onChange={(e) => setNewFact((p) => ({ ...p, character_id: e.target.value }))}>
                <option value="">{t('inspector.whoKnowsThis', 'Who knows this?')}</option>
                {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="knowledge-secret-toggle">
                <input type="checkbox" checked={newFact.is_secret === 1} onChange={(e) => setNewFact((p) => ({ ...p, is_secret: e.target.checked ? 1 : 0 }))} />
                {t('inspector.secretToggle', 'Secret (author-only)')}
              </label>
              <div className="knowledge-add-actions">
                <button className="entity-edit-btn save" onClick={handleAddFact}>{t('inspector.add', 'Add')}</button>
                <button className="entity-edit-btn" onClick={() => setAddingFact(false)}>{t('inspector.cancel', 'Cancel')}</button>
              </div>
            </div>
          )}

          {knowledgeFacts.length === 0 ? <div className="entity-detail-value" style={{ opacity: 0.5, fontSize: '11px' }}>{t('inspector.noKnowledge', 'No knowledge entries yet.')}</div> : knowledgeFacts.map((fact) => {
            const isEditing = editingFactId === fact.id
            const canNavigate = fact.learned_in_chapter && onNavigateToMark
            return (
              <div
                className={`knowledge-fact-card ${fact.is_secret ? 'secret' : ''}`}
                key={fact.id}
                style={{ cursor: canNavigate && !isEditing ? 'pointer' : 'default' }}
                onClick={() => { if (!isEditing && canNavigate) onNavigateToMark({ chapterId: fact.learned_in_chapter, wordOffset: fact.word_offset ?? null }) }}
              >
                {isEditing ? (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea className="entity-edit-textarea" value={editFactData.fact} onChange={(e) => setEditFactData(p => ({ ...p, fact: e.target.value }))} rows={2} autoFocus />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editFactData.is_secret === 1} onChange={(e) => setEditFactData(p => ({ ...p, is_secret: e.target.checked ? 1 : 0 }))} />
                      {t('inspector.secretToggle', 'Secret (author-only)')}
                    </label>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="entity-edit-btn" onClick={() => setEditingFactId(null)}>{t('inspector.cancel', 'Cancel')}</button>
                      <button className="entity-edit-btn save" onClick={handleUpdateFact}>{t('inspector.save', 'Save')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="knowledge-fact-text">{fact.fact}</div>
                    <div className="knowledge-fact-meta">
                      <span className="knowledge-fact-who">{fact.character_name}</span>
                      <span className="knowledge-fact-when">{getChapterLabel(fact.learned_in_chapter)}</span>
                      {fact.world_time && <span className="knowledge-fact-when">{fact.world_time}</span>}
                      {fact.is_secret && <span className="knowledge-fact-badge secret">{t('inspector.secretBadge', 'SECRET')}</span>}
                    </div>
                    {viewMode === 'author' && (
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button onClick={(e) => { e.stopPropagation(); setEditingFactId(fact.id); setEditFactData({ fact: fact.fact, is_secret: fact.is_secret ? 1 : 0 }) }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}><Icons.Edit /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFact(fact.id) }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}><Icons.Trash /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {viewMode === 'author' && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => setShowDeleteConfirm(true)} className="entity-edit-btn" style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}>
            <Icons.Trash /> {t('inspector.deleteEntityBtn', 'Delete Entity')}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ insetInlineStart: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '400px' }}>
            <div className="popup-header"><span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--accent-red)' }}>{t('inspector.deleteEntityTitle', 'Delete Entity?')}</span></div>
            <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '14px', marginBottom: '20px', fontSize: '14px' }}>{t('inspector.deleteEntityWarning', 'This action is permanent. Any mentions in the text will lose their links and revert to normal text.')}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="entity-edit-btn" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => setShowDeleteConfirm(false)}>{t('inspector.cancel', 'Cancel')}</button>
              <button className="entity-edit-btn save" style={{ backgroundColor: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: 'var(--bg-deep)', padding: '8px 16px', fontSize: '14px' }} onClick={handleConfirmDeleteEntity}>{t('inspector.deleteEntityBtn', 'Delete Entity')}</button>
            </div>
          </div>
        </div>
      )}

      {renameData && (
        <EntityRenamePopup projectPath={projectPath} entity={renameData.entity} oldName={renameData.oldName} newName={renameData.newName} onClose={() => { setRenameData(null); setEditMode(false) }} onSuccess={(didReplace) => { setRenameData(null); setEditMode(false); if (didReplace) onReloadCurrentChapter?.() }} />
      )}
    </div>
  )
}
