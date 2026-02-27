import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// ── Inline SVG Icons ────────────────────────────────────────────────────────

const Icons = {
  User: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Gem: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M2 9h20" />
      <path d="M12 22L6 3" />
      <path d="M12 22l6-19" />
    </svg>
  ),
  MapPin: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Eye: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  BookOpen: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Target: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Feather: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  Edit: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Check: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Brain: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  )
}

function TypeIcon({ type }) {
  switch (type) {
    case 'character':
      return <Icons.User />
    case 'location':
      return <Icons.MapPin />
    case 'quicknote':
      return <Icons.Feather />
    default:
      return <Icons.Gem />
  }
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export default function EntityInspectorPanel({
  entity,
  characters,
  entities,
  activeChapter,
  projectPath,
  chapters,
  onEntityUpdated
}) {
  const { t } = useTranslation()
  const [showHidden, setShowHidden] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [knowledgeFacts, setKnowledgeFacts] = useState([])
  const [addingFact, setAddingFact] = useState(false)
  const [newFact, setNewFact] = useState({ fact: '', character_id: '', is_secret: 0 })
  const [calculatedAge, setCalculatedAge] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── Derived Data ──────────────────────────────────────────────────────────

  // Find the latest version of the entity from the props to avoid stale state bugs
  const currEntity = (() => {
    if (!entity) return null;
    if (entity.type === 'character') {
      return characters.find(c => String(c.id) === String(entity.id)) || entity;
    }
    // For other types, they are in the 'entities' array
    return entities.find(e => String(e.id) === String(entity.id) && e.type === entity.type) || entity;
  })();

  const charData = entity?.type === 'character' ? currEntity : null
  const locationData = entity?.type === 'location' ? currEntity : null
  const groupData = entity?.type === 'group' ? currEntity : null
  const loreData = (!charData && !locationData && !groupData && entity?.type !== 'quicknote') ? currEntity : null

  // Load knowledge facts when entity or chapter changes
  const loadKnowledgeFacts = useCallback(async () => {
    if (!entity || !projectPath) return

    try {
      let result

      if (entity.type === 'character') {
        // For characters: show facts this character KNOWS
        const params = {
          project_path: projectPath,
          character_id: entity.id
        }
        if (!showHidden && activeChapter?.chapter_number) {
          params.current_chapter = activeChapter.chapter_number
        }
        result = await window.api.getKnowledgeForCharacter(params)
      } else {
        // For locations/lore/groups: show facts ABOUT this entity
        const params = {
          project_path: projectPath,
          source_entity_type: entity.type,
          source_entity_id: entity.id
        }
        if (!showHidden && activeChapter?.pov_character_id && activeChapter?.chapter_number) {
          params.pov_character_id = activeChapter.pov_character_id
          params.current_chapter = activeChapter.chapter_number
        }
        result = await window.api.getKnowledgeForEntity(params)
      }

      setKnowledgeFacts(result?.facts || [])
    } catch (err) {
      console.error('Failed to load knowledge facts:', err)
      setKnowledgeFacts([])
    }
  }, [
    entity?.id,
    entity?.type,
    projectPath,
    showHidden,
    activeChapter?.pov_character_id,
    activeChapter?.chapter_number
  ])

  useEffect(() => {
    loadKnowledgeFacts()
  }, [loadKnowledgeFacts, currEntity?.updated_at]) // Reload when entity is updated

  // Calculate age if character has birth_date and chapter has world_time
  useEffect(() => {
    const calcAge = async () => {
      if (!charData?.birth_date || !activeChapter?.world_time || !projectPath) {
        setCalculatedAge(null)
        return
      }
      try {
        const result = await window.api.calculateAge({
          project_path: projectPath,
          birth_date: charData.birth_date,
          world_time: activeChapter.world_time
        })
        setCalculatedAge(result)
      } catch (err) {
        setCalculatedAge(null)
      }
    }
    calcAge()
  }, [charData?.birth_date, activeChapter?.world_time, projectPath])

  // Reset edit mode when entity changes
  useEffect(() => {
    setEditMode(false)
    setAddingFact(false)
  }, [entity?.id, entity?.type])

  if (!entity) return null

  const typeLabel =
    entity.type === 'character'
      ? t('inspector.typeCharacter', 'Character')
      : entity.type === 'location'
        ? t('inspector.typeLocation', 'Location')
        : entity.type === 'quicknote'
          ? t('inspector.typeQuickNote', 'Quick Note')
          : entity.category || t('inspector.typeLoreEntity', 'Lore Entity')

  // ── Edit Mode Helpers ─────────────────────────────────────────────────────

  const enterEditMode = () => {
    if (charData) {
      setEditData({
        name: charData.name || '',
        role: charData.role || '',
        status: charData.status || '',
        species: charData.species || '',
        bio: charData.bio || '',
        surface_goal: charData.surface_goal || '',
        true_goal: charData.true_goal || '',
        notes: charData.notes || '',
        aliases: (charData.aliases || []).join(', '),
        birth_date: charData.birth_date || ''
      })
    } else if (locationData) {
      setEditData({
        name: locationData.name || '',
        region: locationData.region || '',
        description: locationData.description || '',
        notes: locationData.notes || '',
        aliases: (locationData.aliases || []).join(', '),
        parent_location_id: locationData.parent_location_id || ''
      })
    } else if (groupData) {
      setEditData({
        name: groupData.name || '',
        group_type: groupData.group_type || '',
        description: groupData.description || '',
        surface_agenda: groupData.surface_agenda || '',
        true_agenda: groupData.true_agenda || '',
        notes: groupData.notes || '',
        aliases: (groupData.aliases || []).join(', ')
      })
    } else if (loreData) {
      // lore entity
      setEditData({
        name: loreData.name || '',
        category: loreData.category || '',
        classification: loreData.classification || '',
        description: loreData.description || '',
        rules: loreData.rules || '',
        limitations: loreData.limitations || '',
        origin: loreData.origin || '',
        notes: loreData.notes || '',
        aliases: (loreData.aliases || []).join(', ')
      })
    }
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditData({})
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const aliasArray = editData.aliases
        ? editData.aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
        : []

      if (entity.type === 'character') {
        await window.api.updateCharacter({
          project_path: projectPath,
          character_id: entity.id,
          name: editData.name,
          role: editData.role,
          status: editData.status,
          species: editData.species,
          bio: editData.bio,
          surface_goal: editData.surface_goal,
          true_goal: editData.true_goal,
          notes: editData.notes,
          aliases: aliasArray,
          birth_date: editData.birth_date || null
        })
      } else if (locationData) {
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
      } else if (groupData) {
        await window.api.updateGroup({
          project_path: projectPath,
          group_id: currEntity.id,
          name: editData.name,
          group_type: editData.group_type,
          description: editData.description,
          surface_agenda: editData.surface_agenda,
          true_agenda: editData.true_agenda,
          notes: editData.notes,
          aliases: aliasArray
        })
      } else if (loreData) {
        await window.api.updateLoreEntity({
          project_path: projectPath,
          entity_id: currEntity.id,
          name: editData.name,
          category: editData.category,
          classification: editData.classification,
          description: editData.description,
          rules: editData.rules,
          limitations: editData.limitations,
          origin: editData.origin,
          notes: editData.notes,
          aliases: aliasArray
        })
      }

      setEditMode(false)
      onEntityUpdated?.()
    } catch (err) {
      console.error('Failed to save entity:', err)
    }
    setSaving(false)
  }

  const handleEditField = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  // ── Knowledge State Helpers ───────────────────────────────────────────────

  const handleAddFact = async () => {
    if (!newFact.fact.trim() || !newFact.character_id) return

    try {
      await window.api.createKnowledge({
        project_path: projectPath,
        character_id: parseInt(newFact.character_id),
        fact: newFact.fact,
        source_entity_type: entity.type,
        source_entity_id: entity.id,
        learned_in_chapter: activeChapter?.id || null,
        is_secret: newFact.is_secret
      })
      setNewFact({ fact: '', character_id: '', is_secret: 0 })
      setAddingFact(false)
      loadKnowledgeFacts()
    } catch (err) {
      console.error('Failed to create knowledge state:', err)
    }
  }

  const handleDeleteFact = async (factId) => {
    try {
      await window.api.deleteKnowledge({
        project_path: projectPath,
        knowledge_state_id: factId
      })
      loadKnowledgeFacts()
    } catch (err) {
      console.error('Failed to delete knowledge state:', err)
    }
  }

  // ── Render Helpers ────────────────────────────────────────────────────────

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

  // Find chapter number from chapter id for display
  const getChapterLabel = (chapterId) => {
    if (!chapterId) return t('inspector.fromStart', 'from the start')
    const ch = chapters?.find((c) => c.id === chapterId)
    return ch ? `${t('inspector.chapterPrefixShort', 'Ch.')}${ch.chapter_number}` : `${t('inspector.chapterPrefixShort', 'Ch.')}?`
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

  if (entity.type === 'quicknote') {
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
            <TypeIcon type={entity.type} /> {typeLabel}
          </div>
        </div>
        <div
          className="entity-narrative-note"
          style={{
            background: 'var(--bg-elevated)',
            borderInlineStart: '2px solid var(--entity-quicknote)',
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

  return (
    <div>
      {/* Epistemic toggle */}
      <div
        className="epistemic-toggle"
        onClick={() => setShowHidden(!showHidden)}
        style={{ margin: '-16px -16px 16px', width: 'calc(100% + 32px)' }}
      >
        {showHidden ? <Icons.Eye /> : <Icons.EyeOff />}
        <div className="epistemic-toggle-label">
          {showHidden ? t('inspector.viewAuthor', 'Author View \u2014 All Info') : t('inspector.viewPov', 'POV Filter \u2014 Reader Knowledge')}
        </div>
        <div className={`epistemic-toggle-switch ${showHidden ? 'active' : ''}`} />
      </div>

      {/* Entity header + edit toggle */}
      <div className="entity-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className={`entity-type-badge ${entity.type}`}>
            <TypeIcon type={entity.type} /> {typeLabel}
          </div>
          {!editMode ? (
            <button className="entity-edit-toggle" onClick={enterEditMode} title={t('inspector.edit', 'Edit')}>
              <Icons.Edit />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="entity-edit-toggle save"
                onClick={saveEdit}
                disabled={saving}
                title={t('inspector.save', 'Save')}
              >
                <Icons.Check />
              </button>
              <button className="entity-edit-toggle" onClick={cancelEdit} title={t('inspector.cancel', 'Cancel')}>
                <Icons.X />
              </button>
            </div>
          )}
        </div>

        {editMode ? (
          renderEditField(t('inspector.nameLabel', 'Name'), 'name')
        ) : (
          <div className="entity-name">{entity.name}</div>
        )}

        {!editMode && charData?.role && <div className="entity-subtitle">{charData.role}</div>}
        {!editMode && locationData && locationData.region && (
          <div className="entity-subtitle">{locationData.region}</div>
        )}
        {!editMode && groupData && groupData.group_type && (
          <div className="entity-subtitle">{groupData.group_type}</div>
        )}
        {!editMode && loreData && (loreData.category || loreData.classification) && (
          <div className="entity-subtitle">
            {[loreData.category, loreData.classification].filter(Boolean).join(' \u2022 ')}
          </div>
        )}
      </div>

      {/* ═══ CHARACTER SECTIONS ═══ */}
      {charData && (
        <>
          {/* Bio */}
          <div className="entity-section">
            <div className="entity-section-title">
              <Icons.BookOpen /> {t('inspector.bioSection', 'Bio')}
            </div>
            {editMode ? (
              renderEditField('', 'bio', true)
            ) : (
              <div className="entity-bio">{charData.bio || t('inspector.noBio', 'No bio yet.')}</div>
            )}
          </div>

          {/* Agendas */}
          <div className="entity-section">
            <div className="entity-section-title">
              <Icons.Target /> {t('inspector.agendasSection', 'Agendas')}
            </div>
            {editMode ? (
              <>
                {renderEditField(t('inspector.surfaceGoalLabel', 'Surface Goal'), 'surface_goal', true)}
                {renderEditField(t('inspector.trueGoalLabel', 'True Goal (Author Only)'), 'true_goal', true)}
              </>
            ) : (
              <>
                {charData.surface_goal && (
                  <div className="entity-agenda-row">
                    <div className="entity-agenda-icon" style={{ color: 'var(--accent-green)' }}>
                      <Icons.Eye />
                    </div>
                    <div>
                      <div className="entity-agenda-label">{t('inspector.surfaceGoal', 'Surface Goal')}</div>
                      <div className="entity-agenda-text">{charData.surface_goal}</div>
                    </div>
                  </div>
                )}
                {showHidden && charData.true_goal && (
                  <div className="entity-agenda-row">
                    <div className="entity-agenda-icon" style={{ color: 'var(--accent-red)' }}>
                      <Icons.EyeOff />
                    </div>
                    <div>
                      <div className="entity-agenda-label">{t('inspector.trueGoal', 'True Goal (Author Only)')}</div>
                      <div className="entity-agenda-text">{charData.true_goal}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Known details */}
          <div className="entity-section">
            <div className="entity-section-title">
              <Icons.Eye /> {t('inspector.knownDetailsSection', 'Known Details')}
            </div>
            {editMode ? (
              <>
                {renderEditField(t('inspector.roleLabel', 'Role'), 'role')}
                {renderEditField(t('inspector.statusLabel', 'Status'), 'status')}
                {renderEditField(t('inspector.speciesLabel', 'Species'), 'species')}
                {renderEditField(t('inspector.birthDateLabel', 'Birth Date (in-world)'), 'birth_date')}
                {renderEditField(t('inspector.aliasesLabel', 'Aliases (comma-separated)'), 'aliases')}
              </>
            ) : (
              <>
                {charData.status && (
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.status', 'Status')}</div>
                    <div className="entity-detail-value">{charData.status}</div>
                  </div>
                )}
                {charData.species && (
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.species', 'Species')}</div>
                    <div className="entity-detail-value">{charData.species}</div>
                  </div>
                )}
                {charData.birth_date && (
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.birthDate', 'Birth Date')}</div>
                    <div className="entity-detail-value">
                      {charData.birth_date}
                      {calculatedAge?.calculated && (
                        <span style={{ color: 'var(--accent-amber)', marginInlineStart: '6px' }}>
                          ({t('inspector.agePrefix', 'age:')} {calculatedAge.age_text})
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {charData.aliases && charData.aliases.length > 0 && (
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.aliases', 'Aliases')}</div>
                    <div className="entity-detail-value">{charData.aliases.join(', ')}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          {showHidden && (
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Feather /> {t('inspector.authorNotesSection', 'Author Notes')}
              </div>
              {editMode ? (
                renderEditField('', 'notes', true)
              ) : (
                <div className="entity-narrative-note">{charData.notes || t('inspector.noNotes', 'No notes.')}</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ LORE / LOCATION / GROUP SECTIONS ═══ */}
      {(loreData || locationData || groupData) && (
        <>
          <div className="entity-section">
            <div className="entity-section-title">
              <Icons.BookOpen /> {t('inspector.descriptionSection', 'Description')}
            </div>
            {editMode ? (
              renderEditField('', 'description', true)
            ) : (
              <div className="entity-bio">
                {(locationData || loreData || groupData).description || t('inspector.noDescription', 'No description yet.')}
              </div>
            )}
          </div>

          {locationData && (
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Target /> {t('inspector.locationDetails', 'Location Details')}
              </div>
              {editMode ? (
                <>
                  {renderEditField(t('inspector.regionLabel', 'Region'), 'region')}
                  {renderEditField(t('inspector.parentLocationId', 'Parent Location ID (optional)'), 'parent_location_id')}
                </>
              ) : (
                <>
                  {locationData.region && (
                    <div className="entity-detail-row">
                      <div className="entity-detail-label">{t('inspector.region', 'Region')}</div>
                      <div className="entity-detail-value">{locationData.region}</div>
                    </div>
                  )}
                  {locationData.parent_location_id && (
                    <div className="entity-detail-row">
                      <div className="entity-detail-label">{t('inspector.parentLocation', 'Parent ID')}</div>
                      <div className="entity-detail-value">#{locationData.parent_location_id}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {groupData && (
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Target /> {t('inspector.agendasSection', 'Agendas')}
              </div>
              {editMode ? (
                <>
                  {renderEditField(t('inspector.groupTypeLabel', 'Group Type'), 'group_type')}
                  {renderEditField(t('inspector.surfaceAgendaLabel', 'Surface Agenda'), 'surface_agenda', true)}
                  {renderEditField(t('inspector.trueAgendaLabel', 'True Agenda (Author Only)'), 'true_agenda', true)}
                </>
              ) : (
                <>
                  {groupData.surface_agenda && (
                    <div className="entity-agenda-row">
                      <div className="entity-agenda-icon" style={{ color: 'var(--accent-green)' }}>
                        <Icons.Eye />
                      </div>
                      <div>
                        <div className="entity-agenda-label">{t('inspector.surfaceAgenda', 'Surface Agenda')}</div>
                        <div className="entity-agenda-text">{groupData.surface_agenda}</div>
                      </div>
                    </div>
                  )}
                  {showHidden && groupData.true_agenda && (
                    <div className="entity-agenda-row">
                      <div className="entity-agenda-icon" style={{ color: 'var(--accent-red)' }}>
                        <Icons.EyeOff />
                      </div>
                      <div>
                        <div className="entity-agenda-label">{t('inspector.trueAgenda', 'True Agenda (Author Only)')}</div>
                        <div className="entity-agenda-text">{groupData.true_agenda}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {loreData && (
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Target /> {t('inspector.loreDetails', 'Lore Details')}
              </div>
              {editMode ? (
                <>
                  {renderEditField(t('inspector.categoryLabel', 'Category'), 'category')}
                  {renderEditField(t('inspector.classificationLabel', 'Classification'), 'classification')}
                  {renderEditField(t('inspector.originLabel', 'Origin'), 'origin')}
                  {renderEditField(t('inspector.rulesLabel', 'Rules / Constraints'), 'rules', true)}
                  {renderEditField(t('inspector.limitationsLabel', 'Limitations'), 'limitations', true)}
                </>
              ) : (
                <>
                  {loreData.origin && (
                    <div className="entity-detail-row">
                      <div className="entity-detail-label">{t('inspector.origin', 'Origin')}</div>
                      <div className="entity-detail-value">{loreData.origin}</div>
                    </div>
                  )}
                  {loreData.rules && (
                    <div className="entity-detail-row">
                      <div className="entity-detail-label">{t('inspector.rules', 'Rules')}</div>
                      <div className="entity-detail-value" style={{ whiteSpace: 'pre-wrap' }}>{loreData.rules}</div>
                    </div>
                  )}
                  {showHidden && loreData.limitations && (
                    <div className="entity-detail-row">
                      <div className="entity-detail-label" style={{ color: 'var(--accent-red)' }}>{t('inspector.limitations', 'Limitations')}</div>
                      <div className="entity-detail-value" style={{ whiteSpace: 'pre-wrap' }}>{loreData.limitations}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="entity-section">
            <div className="entity-section-title">
              <Icons.Eye /> {t('inspector.aliasesSection', 'Aliases')}
            </div>
            {editMode ? (
              renderEditField(t('inspector.commaSeparated', 'Comma-separated'), 'aliases')
            ) : currEntity.aliases && currEntity.aliases.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {currEntity.aliases.map((a, i) => (
                  <div className="entity-property-item" key={i}>
                    {a}
                  </div>
                ))}
              </div>
            ) : (
              <div className="entity-detail-value" style={{ opacity: 0.5 }}>
                {t('inspector.none', 'None')}
              </div>
            )}
          </div>

          {showHidden && (
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Feather /> {t('inspector.authorNotesSection', 'Author Notes')}
              </div>
              {editMode ? (
                renderEditField('', 'notes', true)
              ) : (
                <div className="entity-narrative-note">
                  {(locationData || loreData || groupData).notes || t('inspector.noNotes', 'No notes.')}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ KNOWLEDGE FACTS SECTION ═══ */}
      <div className="entity-section">
        <div
          className="entity-section-title"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>
            <Icons.Brain /> {t('inspector.knowledgeSection', 'Knowledge')}
          </span>
          {showHidden && (
            <button
              className="entity-edit-toggle"
              onClick={() => setAddingFact(!addingFact)}
              title={t('inspector.addFactTooltip', 'Add Fact')}
              style={{ marginInlineStart: 'auto' }}
            >
              <Icons.Plus />
            </button>
          )}
        </div>

        {!showHidden && !activeChapter?.pov_character_id && (
          <div className="knowledge-no-pov">
            {t('inspector.noPovKnowledge', 'No POV character set for this chapter. Set a POV to filter knowledge.')}
          </div>
        )}

        {/* Add fact form */}
        {addingFact && showHidden && (
          <div className="knowledge-add-form">
            <textarea
              className="entity-edit-textarea"
              placeholder={t('inspector.whatIsFact', 'What is the fact?')}
              value={newFact.fact}
              onChange={(e) => setNewFact((p) => ({ ...p, fact: e.target.value }))}
              rows={2}
            />
            <select
              className="knowledge-select"
              value={newFact.character_id}
              onChange={(e) => setNewFact((p) => ({ ...p, character_id: e.target.value }))}
            >
              <option value="">{t('inspector.whoKnowsThis', 'Who knows this?')}</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="knowledge-secret-toggle">
              <input
                type="checkbox"
                checked={newFact.is_secret === 1}
                onChange={(e) => setNewFact((p) => ({ ...p, is_secret: e.target.checked ? 1 : 0 }))}
              />
              {t('inspector.secretToggle', 'Secret (author-only)')}
            </label>
            <div className="knowledge-add-actions">
              <button className="entity-edit-btn save" onClick={handleAddFact}>
                {t('inspector.add', 'Add')}
              </button>
              <button className="entity-edit-btn" onClick={() => setAddingFact(false)}>
                {t('inspector.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Knowledge facts list */}
        {knowledgeFacts.length === 0 ? (
          <div className="entity-detail-value" style={{ opacity: 0.5, fontSize: '11px' }}>
            {t('inspector.noKnowledge', 'No knowledge entries yet.')}
          </div>
        ) : (
          knowledgeFacts.map((fact) => (
            <div className={`knowledge-fact-card ${fact.is_secret ? 'secret' : ''}`} key={fact.id}>
              <div className="knowledge-fact-text">{fact.fact}</div>
              <div className="knowledge-fact-meta">
                <span className="knowledge-fact-who">{fact.character_name}</span>
                <span className="knowledge-fact-when">
                  {getChapterLabel(fact.learned_in_chapter)}
                </span>
                {fact.is_secret && <span className="knowledge-fact-badge secret">{t('inspector.secretBadge', 'SECRET')}</span>}
              </div>
              {showHidden && (
                <button
                  className="knowledge-fact-delete"
                  onClick={() => handleDeleteFact(fact.id)}
                  title={t('inspector.deleteFactTooltip', 'Delete fact')}
                >
                  <Icons.Trash />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
