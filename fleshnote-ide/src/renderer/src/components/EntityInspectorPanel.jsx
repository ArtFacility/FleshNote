import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import RelationshipTurningPointPopup from './RelationshipTurningPointPopup'
import CalendarDatePicker from './CalendarDatePicker'
import EntityRenamePopup from './EntityRenamePopup'

// ── Inline SVG Icons ────────────────────────────────────────────────────────

const Icons = {
  Users: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
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
  ),
  Clock: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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
  projectConfig,
  calConfig,
  chapters,
  onEntityUpdated,
  onConfigUpdate,
  initialTab,
  onNavigateToMark,
  onReloadCurrentChapter,
  onFlushEditorSave
}) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState('author')  // 'author' | 'narrative' | 'world_time'
  const [filterCharacterId, setFilterCharacterId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab || 'overview') // 'overview' | 'knowledge' | 'relationships'
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [knowledgeFacts, setKnowledgeFacts] = useState([])
  const [addingFact, setAddingFact] = useState(false)
  const [newFact, setNewFact] = useState({ fact: '', character_id: '', is_secret: 0 })
  const [calculatedAge, setCalculatedAge] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [relationships, setRelationships] = useState([])
  const [editRelPopup, setEditRelPopup] = useState(null)
  const [editingFactId, setEditingFactId] = useState(null)
  const [editFactData, setEditFactData] = useState({ fact: '', is_secret: 0 })
  const [localNoteType, setLocalNoteType] = useState(entity?.note_type || 'Note')
  const [renameData, setRenameData] = useState(null)

  // Switch tab when initialTab prop changes (e.g. from marker click)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  // Sync localNoteType when entity changes (quicknote inspector)
  useEffect(() => {
    if (entity?.type === 'quicknote') {
      setLocalNoteType(entity.note_type || 'Note')
    }
  }, [entity?.id, entity?.type, entity?.note_type])

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
  const loreData = (!charData && !locationData && !groupData && entity?.type !== 'quicknote' && entity?.type !== 'annotation') ? currEntity : null

  const loreCategories = (() => {
    const cats = new Set(['item']) // basic generic fallback

    // If we wanted to check config here we'd need it passed down, but adding existing categories is safe enough
    if (Array.isArray(entities)) {
      entities.forEach(e => {
        if (e.type !== 'character' && e.type !== 'location' && e.type !== 'group' && e.type !== 'quicknote' && e.type !== 'annotation' && e.category) {
          cats.add(e.category.toLowerCase().trim())
        }
      })
    }
    return Array.from(cats).sort()
  })()

  // Auto-default filterCharacterId to active chapter's POV character
  useEffect(() => {
    if (activeChapter?.pov_character_id) {
      setFilterCharacterId(activeChapter.pov_character_id)
    }
  }, [activeChapter?.pov_character_id])

  // Load knowledge facts when entity, chapter, or view mode changes
  const loadKnowledgeFacts = useCallback(async () => {
    if (!entity || !projectPath) return

    try {
      let result

      if (entity.type === 'character') {
        // For characters: show facts this character KNOWS
        const params = {
          project_path: projectPath,
          character_id: entity.id,
          filter_mode: viewMode
        }
        if (viewMode === 'narrative' && activeChapter?.chapter_number) {
          params.current_chapter = activeChapter.chapter_number
        } else if (viewMode === 'world_time') {
          params.current_world_time = activeChapter?.world_time || null
        }
        result = await window.api.getKnowledgeForCharacter(params)
      } else {
        // For locations/lore/groups: show facts ABOUT this entity
        const params = {
          project_path: projectPath,
          source_entity_type: entity.type,
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
    viewMode,
    filterCharacterId,
    activeChapter?.chapter_number,
    activeChapter?.world_time
  ])

  useEffect(() => {
    loadKnowledgeFacts()
  }, [loadKnowledgeFacts, currEntity?.updated_at]) // Reload when entity is updated

  const loadRelationships = useCallback(async () => {
    if (entity?.type !== 'character' || !projectPath) return

    try {
      const params = {
        project_path: projectPath,
        character_id: entity.id,
        filter_mode: viewMode
      }
      if (viewMode === 'narrative' && activeChapter?.chapter_number) {
        params.current_chapter = activeChapter.chapter_number
      } else if (viewMode === 'world_time' || (viewMode === 'author' && activeChapter?.world_time)) {
        params.current_world_time = activeChapter?.world_time || null
      }
      const result = await window.api.getRelationshipsForCharacter(params)
      setRelationships(result?.relationships || [])
    } catch (err) {
      console.error('Failed to load relationships:', err)
      setRelationships([])
    }
  }, [entity?.id, entity?.type, projectPath, viewMode, activeChapter?.chapter_number, activeChapter?.world_time])

  useEffect(() => {
    loadRelationships()
  }, [loadRelationships, currEntity?.updated_at])

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

  // Reset world_time view if dual timeline is disabled
  useEffect(() => {
    if (!projectConfig?.track_dual_timeline && viewMode === 'world_time') {
      setViewMode('author')
    }
  }, [projectConfig?.track_dual_timeline])

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
        customCategory: '',
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
        const finalCategory = editData.category === 'new_category' ? (editData.customCategory || '').trim() || 'item' : editData.category
        await window.api.updateLoreEntity({
          project_path: projectPath,
          entity_id: currEntity.id,
          name: editData.name,
          category: finalCategory,
          classification: editData.classification,
          description: editData.description,
          rules: editData.rules,
          limitations: editData.limitations,
          origin: editData.origin,
          notes: editData.notes,
          aliases: aliasArray
        })

        if (editData.category === 'new_category' && finalCategory) {
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
      }

      const oldName = entity.name
      const newName = editData.name
      const nameChanged = oldName !== newName && !!oldName && !!newName && !aliasArray.includes(newName)

      // Always refresh entities immediately so the inspector shows the updated name
      await onEntityUpdated?.()

      if (nameChanged && ['character', 'location', 'lore', 'group'].includes(entity.type)) {
        // Flush any pending editor save so the current chapter's MD file is up-to-date on disk
        // before we scan for references
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
      const payload = {
        project_path: projectPath,
        fact: newFact.fact,
        learned_in_chapter: activeChapter?.id || null,
        is_secret: newFact.is_secret
      }

      if (entity.type === 'character') {
        payload.character_id = entity.id
        payload.source_entity_type = 'character'
        payload.source_entity_id = parseInt(newFact.character_id)
      } else {
        payload.character_id = parseInt(newFact.character_id)
        payload.source_entity_type = entity.type
        payload.source_entity_id = entity.id
      }

      await window.api.createKnowledge(payload)
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

  const handleUpdateFact = async () => {
    if (!editingFactId || !editFactData.fact.trim()) return
    try {
      await window.api.updateKnowledge({
        project_path: projectPath,
        knowledge_state_id: editingFactId,
        fact: editFactData.fact,
        is_secret: editFactData.is_secret
      })
      setEditingFactId(null)
      loadKnowledgeFacts()
    } catch (err) {
      console.error('Failed to update knowledge state:', err)
    }
  }

  const handleDeleteRelationship = async (relId) => {
    try {
      await window.api.deleteRelationship({
        project_path: projectPath,
        relationship_id: relId
      })
      loadRelationships()
    } catch (err) {
      console.error('Failed to delete relationship:', err)
    }
  }

  const getRelColor = (type) => {
    const typeLower = type?.toLowerCase() || ''
    switch (typeLower) {
      case 'friendship': return 'var(--accent-green, #4ade80)'
      case 'love': return 'var(--accent-red, #f43f5e)'
      case 'hate': return 'var(--accent-red, #f43f5e)' // Reusing red for hate
      case 'spite': return 'var(--accent-purple, #a855f7)'
      case 'guilt': return 'var(--accent-blue, #3b82f6)'
      case 'trust': return 'var(--accent-cyan, #06b6d4)'
      case 'distrust': return 'var(--accent-orange, #f97316)'
      default: return 'var(--text-secondary, #9ca3af)'
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

  const handleConfirmDeleteEntity = async () => {
    setShowDeleteConfirm(false)
    try {
      if (entity.type === 'character') {
        await window.api.deleteCharacter({ project_path: projectPath, character_id: entity.id })
      } else if (entity.type === 'location') {
        await window.api.deleteLocation({ project_path: projectPath, location_id: entity.id })
      } else if (entity.type === 'group') {
        await window.api.deleteGroup({ project_path: projectPath, group_id: entity.id })
      } else {
        await window.api.deleteLoreEntity({ project_path: projectPath, entity_id: entity.id })
      }

      await window.api.updateStat({
        project_path: projectPath,
        stat_key: 'deleted_entities',
        increment_by: 1
      })

      onEntityUpdated?.()
      window.dispatchEvent(new CustomEvent('forceBackToChapters'))
    } catch (err) {
      console.error('Failed to delete entity:', err)
    }
  }

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

  const handleConfirmDeleteAnnotation = async () => {
    setShowDeleteConfirm(false)
    try {
      await window.api.deleteAnnotation({
        project_path: projectPath,
        annotation_id: entity.id
      })
      onEntityUpdated?.()
      window.dispatchEvent(new CustomEvent('forceBackToChapters'))
    } catch (err) {
      console.error('Failed to delete annotation:', err)
    }
  }

  if (entity.type === 'annotation') {
    return (
      <div>
        {showDeleteConfirm && (
          <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div
              className="popup-panel"
              onClick={(e) => e.stopPropagation()}
              style={{ insetInlineStart: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px' }}
            >
              <div className="popup-header">
                <span style={{ color: 'var(--accent-red)' }}>{t('inspector.deleteAnnotationTitle', 'Delete Annotation?')}</span>
              </div>
              <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '12px', marginBottom: '16px' }}>
                {t('inspector.deleteAnnotationWarning', 'This action is permanent. The annotation will be removed and its anchor in the text will lose its reference.')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="entity-edit-btn" onClick={() => setShowDeleteConfirm(false)}>
                  {t('inspector.cancel', 'Cancel')}
                </button>
                <button
                  className="entity-edit-btn save"
                  style={{ backgroundColor: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: 'var(--bg-deep)' }}
                  onClick={handleConfirmDeleteAnnotation}
                >
                  {t('inspector.deleteAnnotationBtn', 'Delete Annotation')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="entity-header" style={{ marginBottom: '12px' }}>
          <div className="entity-type-badge annotation">
            <TypeIcon type="annotation" /> {t('inspector.typeAnnotation', 'Footnote Annotation')}
          </div>
        </div>
        <div
          className="entity-narrative-note"
          style={{
            background: 'var(--bg-elevated)',
            borderInlineStart: '2px solid var(--accent-annotation)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {entity.content}
        </div>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('inspector.annotationExportNote', 'This annotation will appear as a footnote at the bottom of its page when exported.')}
        </div>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="entity-edit-btn"
            style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}
          >
            <Icons.Trash /> {t('inspector.deleteAnnotationBtn', 'Delete Annotation')}
          </button>
        </div>
      </div>
    )
  }

  if (entity.type === 'quicknote') {
    const NOTE_TYPE_OPTIONS = [
      { label: 'Note',       color: 'var(--accent-amber)' },
      { label: 'Fix',        color: 'var(--accent-red)'   },
      { label: 'Suggestion', color: 'var(--accent-blue)'  },
      { label: 'Idea',       color: '#4ade80'              },
    ]
    const currentNoteType = NOTE_TYPE_OPTIONS.find(o => o.label === localNoteType) || NOTE_TYPE_OPTIONS[0]
    const handleChangeNoteType = async (label) => {
      setLocalNoteType(label)
      try {
        await window.api.updateQuickNote({ project_path: projectPath, note_id: entity.id, note_type: label })
        window.dispatchEvent(new CustomEvent('fleshnote:quicknote-type-changed', { detail: { noteId: entity.id, noteType: label } }))
        onEntityUpdated?.()
      } catch (err) {
        console.error('Failed to update note type:', err)
        setLocalNoteType(entity.note_type || 'Note') // revert on error
      }
    }
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

        {/* Note type selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {NOTE_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => handleChangeNoteType(opt.label)}
              style={{
                padding: '3px 10px',
                background: 'transparent',
                border: `1px solid ${opt.label === currentNoteType.label ? opt.color : 'var(--border-subtle)'}`,
                borderRadius: 12,
                color: opt.label === currentNoteType.label ? opt.color : 'var(--text-tertiary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: opt.label === currentNoteType.label ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          className="entity-narrative-note"
          style={{
            background: 'var(--bg-elevated)',
            borderInlineStart: `2px solid ${currentNoteType.color}`,
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
      {/* Epistemic view mode selector */}
      <div className="epistemic-mode-bar" style={{ margin: '-16px -16px 0', width: 'calc(100% + 32px)' }}>
        <button
          className={`epistemic-mode-btn ${viewMode === 'author' ? 'active' : ''}`}
          onClick={() => setViewMode('author')}
          title={t('inspector.viewAuthorTooltip', 'Show all knowledge — unfiltered')}
        >
          <Icons.Eye /> {t('inspector.viewAuthorShort', 'Author')}
        </button>
        <button
          className={`epistemic-mode-btn ${viewMode === 'narrative' ? 'active' : ''}`}
          onClick={() => setViewMode('narrative')}
          title={t('inspector.viewNarrativeTooltip', 'Filter by reading order (chapter sequence)')}
        >
          <Icons.BookOpen /> {t('inspector.viewNarrativeShort', 'Narrative')}
        </button>
        {projectConfig?.track_dual_timeline && (
          <button
            className={`epistemic-mode-btn ${viewMode === 'world_time' ? 'active' : ''}`}
            onClick={() => setViewMode('world_time')}
            title={t('inspector.viewWorldTimeTooltip', 'Filter by in-universe chronological time')}
          >
            <Icons.Clock /> {t('inspector.viewWorldTimeShort', 'World Time')}
          </button>
        )}
      </div>
      {/* Character filter for non-character entities in filtered modes */}
      {viewMode !== 'author' && entity.type !== 'character' && (
        <div className="epistemic-character-filter" style={{ margin: '0 -16px 16px', width: 'calc(100% + 32px)' }}>
          <select
            className="epistemic-filter-select"
            value={filterCharacterId || ''}
            onChange={(e) => setFilterCharacterId(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">{t('inspector.allCharacters', 'All characters')}</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {/* Spacer when no character filter shown */}
      {(viewMode === 'author' || entity.type === 'character') && (
        <div style={{ marginBottom: '16px' }} />
      )}

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
          <div className="entity-name">{currEntity?.name || entity.name}</div>
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

      <div className="inspector-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '16px -16px 16px', padding: '0 16px', gap: '16px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
            color: activeTab === 'overview' ? 'var(--accent-amber)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'overview' ? '2px solid var(--accent-amber)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
            display: 'flex', alignItems: 'center'
          }}
          title={t('inspector.tabOverview', 'Overview')}
        >
          <Icons.BookOpen style={{ width: 14, height: 14, marginRight: activeTab === 'overview' ? 4 : 0 }} /> 
          {activeTab === 'overview' && t('inspector.tabOverview', 'Overview')}
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          style={{
            background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
            color: activeTab === 'knowledge' ? 'var(--accent-amber)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'knowledge' ? '2px solid var(--accent-amber)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
            display: 'flex', alignItems: 'center'
          }}
          title={t('inspector.tabKnowledge', 'Knowledge Database')}
        >
          <Icons.Brain style={{ width: 14, height: 14, marginRight: activeTab === 'knowledge' ? 4 : 0 }} />
          {activeTab === 'knowledge' && t('inspector.tabKnowledge', 'Knowledge Database')}
        </button>
        {entity.type === 'character' && (
          <button
            onClick={() => setActiveTab('relationships')}
            style={{
              background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
              color: activeTab === 'relationships' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'relationships' ? '2px solid var(--accent-amber)' : '2px solid transparent',
              fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
              display: 'flex', alignItems: 'center'
            }}
            title={t('inspector.tabRelationships', 'Relationships')}
          >
            <Icons.Users style={{ width: 14, height: 14, marginRight: activeTab === 'relationships' ? 4 : 0 }} />
            {activeTab === 'relationships' && t('inspector.tabRelationships', 'Relationships')}
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <>
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
                    {charData.true_goal && (
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
                    {projectConfig?.track_species && (
                      renderEditField(projectConfig?.species_label || t('inspector.speciesLabel', 'Species'), 'species')
                    )}
                    <div className="entity-edit-field">
                      <label className="entity-edit-label">{t('inspector.birthDateLabel', 'Birth Date (in-world)')}</label>
                      <CalendarDatePicker
                        value={editData.birth_date || ''}
                        onChange={(v) => handleEditField('birth_date', v)}
                        calConfig={calConfig}
                        projectPath={projectPath}
                      />
                    </div>
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
                    {projectConfig?.track_species && charData.species && (
                      <div className="entity-detail-row">
                        <div className="entity-detail-label">{projectConfig?.species_label || t('inspector.species', 'Species')}</div>
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
                      {groupData.true_agenda && (
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
                      <div className="entity-edit-field">
                        <label className="entity-edit-label">{t('inspector.categoryLabel', 'Category')}</label>
                        <select
                          className="entity-edit-input"
                          value={editData.category || ''}
                          onChange={(e) => handleEditField('category', e.target.value)}
                        >
                          <option value="">{t('inspector.selectCategory', 'Select category...')}</option>
                          {loreCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </option>
                          ))}
                          <option value="new_category">{t('inspector.newCategoryOption', '+ New Category...')}</option>
                        </select>
                        {editData.category === 'new_category' && (
                          <input
                            className="entity-edit-input"
                            style={{ marginTop: '6px' }}
                            type="text"
                            value={editData.customCategory || ''}
                            onChange={(e) => handleEditField('customCategory', e.target.value)}
                            placeholder={t('inspector.newCategoryPlaceholder', 'Type new category...')}
                            autoFocus
                          />
                        )}
                      </div>
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
                      {loreData.limitations && (
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
            </>
          )}

        </>
      )}

      {activeTab === 'knowledge' && (
        <div className="entity-section" style={{ marginTop: 0 }}>
          {/* ═══ KNOWLEDGE FACTS SECTION ═══ */}
          <div
            className="entity-section-title"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>
              <Icons.Brain /> {t('inspector.knowledgeSection', 'Knowledge')}
            </span>
            {viewMode === 'author' && (
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

          {viewMode === 'world_time' && !activeChapter?.world_time && (
            <div className="knowledge-no-pov">
              {t('inspector.noWorldTime', 'No world time set for this chapter. Set a world time in the chapter metadata to filter.')}
            </div>
          )}

          {/* Add fact form */}
          {addingFact && viewMode === 'author' && (
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
                <option value="">
                  {entity.type === 'character'
                    ? t('inspector.whoIsFactAbout', 'Who is this about?')
                    : t('inspector.whoKnowsThis', 'Who knows this?')}
                </option>
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
            knowledgeFacts.map((fact) => {
              const isEditing = editingFactId === fact.id
              const canNavigate = fact.learned_in_chapter && onNavigateToMark
              return (
                <div
                  className={`knowledge-fact-card ${fact.is_secret ? 'secret' : ''}`}
                  key={fact.id}
                  style={{ cursor: canNavigate && !isEditing ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!isEditing && canNavigate) {
                      onNavigateToMark({ chapterId: fact.learned_in_chapter, wordOffset: fact.word_offset ?? null })
                    }
                  }}
                  title={canNavigate && !isEditing ? t('inspector.clickToNavigate', 'Click to navigate to text') : undefined}
                >
                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea
                        className="entity-edit-textarea"
                        value={editFactData.fact}
                        onChange={(e) => setEditFactData(p => ({ ...p, fact: e.target.value }))}
                        rows={2}
                        autoFocus
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFactData.is_secret === 1}
                          onChange={(e) => setEditFactData(p => ({ ...p, is_secret: e.target.checked ? 1 : 0 }))}
                        />
                        {t('inspector.secretToggle', 'Secret (author-only)')}
                      </label>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="entity-edit-btn" onClick={() => setEditingFactId(null)}>
                          {t('inspector.cancel', 'Cancel')}
                        </button>
                        <button className="entity-edit-btn save" onClick={handleUpdateFact}>
                          {t('inspector.save', 'Save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="knowledge-fact-text">{fact.fact}</div>
                      <div className="knowledge-fact-meta">
                        <span className="knowledge-fact-who">
                          {entity.type === 'character'
                            ? (fact.source_entity_name || t('inspector.unknownEntity', 'Unknown'))
                            : fact.character_name}
                        </span>
                        <span className="knowledge-fact-when">
                          {getChapterLabel(fact.learned_in_chapter)}
                        </span>
                        {fact.world_time && (
                          <span className="knowledge-fact-when" title={t('inspector.worldTimeLabel', 'World time')}>
                            {fact.world_time}
                          </span>
                        )}
                        {fact.is_secret && <span className="knowledge-fact-badge secret">{t('inspector.secretBadge', 'SECRET')}</span>}
                      </div>
                      {viewMode === 'author' && (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingFactId(fact.id); setEditFactData({ fact: fact.fact, is_secret: fact.is_secret ? 1 : 0 }) }}
                            title={t('inspector.editFactTooltip', 'Edit fact')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFact(fact.id) }}
                            title={t('inspector.deleteFactTooltip', 'Delete fact')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'relationships' && (
        <div className="entity-section" style={{ marginTop: 0 }}>
          <div
            className="entity-section-title"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>
              <Icons.Users /> {t('inspector.relationshipsSection', 'Relationships')}
            </span>
          </div>

          {viewMode === 'world_time' && !activeChapter?.world_time && (
            <div className="knowledge-no-pov">
              {t('inspector.noWorldTime', 'No world time set for this chapter. Set a world time in the chapter metadata to filter.')}
            </div>
          )}

          {relationships.length === 0 ? (
            <div className="entity-detail-value" style={{ opacity: 0.5, fontSize: '11px' }}>
              {t('inspector.noRelationships', 'No relationships yet.')}
            </div>
          ) : (
            relationships.map((relItem) => {
              const activeState = relItem.current_state || relItem.ghost_state;
              if (!activeState) return null;

              let wordsAgoText = null;
              if (activeChapter && activeState.chapter_id === activeChapter.id && activeState.word_offset != null) {
                wordsAgoText = t('inspector.inThisChapter', 'In this chapter');
              } else if (activeState.chapter_id) {
                wordsAgoText = getChapterLabel(activeState.chapter_id)
              }

              return (
                <div
                  className="knowledge-fact-card"
                  key={relItem.target_character_id}
                  style={activeState.word_offset != null && activeState.chapter_id ? { cursor: 'pointer' } : undefined}
                  onClick={(e) => {
                    if (e.target.closest('button')) return
                    if (activeState.word_offset != null && activeState.chapter_id && onNavigateToMark) {
                      onNavigateToMark({ chapterId: activeState.chapter_id, wordOffset: activeState.word_offset })
                    }
                  }}
                  title={activeState.word_offset != null && activeState.chapter_id ? t('inspector.clickToNavigate', 'Click to navigate to text') : undefined}
                >

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '12px', marginTop: '4px' }}>
                    {/* Left Character (Selected) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                        <Icons.User style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }} title={currEntity?.name || entity.name}>
                        {currEntity?.name || entity.name}
                      </span>
                    </div>

                    {/* Arrows Middle Section */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                      {/* Top Arrow: Left to Right (Current Char -> Target Char) */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: getRelColor(activeState.rel_type), textTransform: 'uppercase', fontWeight: 'bold' }}>
                          {t(`relType.${activeState.rel_type.toLowerCase()}`, activeState.rel_type)}
                        </span>
                        <div style={{ width: '100%', height: '2px', backgroundColor: getRelColor(activeState.rel_type), position: 'relative', marginTop: '2px' }}>
                          <div style={{ position: 'absolute', right: '-2px', top: '-4px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `6px solid ${getRelColor(activeState.rel_type)}` }}></div>
                        </div>
                      </div>

                      {/* Bottom Arrow: Right to Left (Target Char -> Current Char) */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: '2px', backgroundColor: relItem.reverse_state ? getRelColor(relItem.reverse_state.rel_type) : 'var(--border-subtle)', position: 'relative', marginBottom: '2px' }}>
                          <div style={{ position: 'absolute', left: '-2px', top: '-4px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: `6px solid ${relItem.reverse_state ? getRelColor(relItem.reverse_state.rel_type) : 'var(--border-subtle)'}` }}></div>
                        </div>
                        <span style={{ fontSize: '10px', color: relItem.reverse_state ? getRelColor(relItem.reverse_state.rel_type) : 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: relItem.reverse_state ? 'bold' : 'normal' }}>
                          {relItem.reverse_state ? relItem.reverse_state.rel_type : t('inspector.unknownRel', 'Unknown')}
                        </span>
                      </div>
                    </div>

                    {/* Right Character (Target) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                         <Icons.User style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }} title={relItem.target_character_name}>
                        {relItem.target_character_name}
                      </span>
                    </div>
                  </div>
                  
                  {activeState.notes && (
                    <div className="knowledge-fact-text" style={{ fontStyle: 'italic', marginBottom: '6px', textAlign: 'center' }}>
                      "{activeState.notes}"
                    </div>
                  )}

                  {/* Render Ghost State */}
                  {relItem.ghost_state && (
                     <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed var(--border-subtle)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          {t('inspector.ghostStateNarrative', 'Narrative Reality')}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="knowledge-fact-badge" style={{ opacity: 0.7 }}>
                            {t(`relType.${relItem.ghost_state.rel_type.toLowerCase()}`, relItem.ghost_state.rel_type)}
                          </span>
                          {viewMode === 'author' && (
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditRelPopup(relItem.ghost_state) }}
                                title={t('inspector.editRelTooltip', 'Edit relationship data')}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRelationship(relItem.ghost_state.id) }}
                                title={t('inspector.deleteRelTooltip', 'Delete relationship data')}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          )}
                        </div>
                        {relItem.ghost_state.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                            "{relItem.ghost_state.notes}"
                          </div>
                        )}
                     </div>
                  )}

                  {/* Bottom bar: meta + action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div className="knowledge-fact-meta">
                      {wordsAgoText && <span className="knowledge-fact-when">{wordsAgoText}</span>}
                      {activeState.world_time && (
                        <span className="knowledge-fact-when" title={t('inspector.worldTimeLabel', 'World time')}>
                          {activeState.world_time}
                        </span>
                      )}
                    </div>
                    {viewMode === 'author' && (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRelPopup(activeState) }}
                          title={t('inspector.editRelTooltip', 'Edit relationship data')}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Icons.Edit />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRelationship(activeState.id) }}
                          title={t('inspector.deleteRelTooltip', 'Delete relationship data')}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Delete Entity Section */}
      {
        viewMode === 'author' && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="entity-edit-btn"
              style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}
              title={t('inspector.deleteEntityTooltip', 'Delete this entity')}
            >
              <Icons.Trash /> {t('inspector.deleteEntityBtn', 'Delete Entity')}
            </button>
          </div>
        )
      }

      {/* Delete Entity Confirmation Popup */}
      {
        showDeleteConfirm && (
          <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div
              className="popup-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                insetInlineStart: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '400px'
              }}
            >
              <div className="popup-header">
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--accent-red)' }}>{t('inspector.deleteEntityTitle', 'Delete Entity?')}</span>
              </div>
              <div
                className="popup-subtitle"
                style={{
                  whiteSpace: 'normal',
                  lineHeight: '1.5',
                  marginTop: '14px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}
              >
                {t('inspector.deleteEntityWarning', 'This action is permanent. Any mentions in the text will lose their links and revert to normal text.')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="entity-edit-btn" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => setShowDeleteConfirm(false)}>
                  {t('inspector.cancel', 'Cancel')}
                </button>
                <button
                  className="entity-edit-btn save"
                  style={{
                    backgroundColor: 'var(--accent-red)',
                    borderColor: 'var(--accent-red)',
                    color: 'var(--bg-deep)',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                  onClick={handleConfirmDeleteEntity}
                >
                  {t('inspector.deleteEntityBtn', 'Delete Entity')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {editRelPopup && (
        <RelationshipTurningPointPopup
          projectPath={projectPath}
          calConfig={calConfig}
          existingRel={editRelPopup}
          position={{ x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 - 200 }}
          onClose={() => setEditRelPopup(null)}
          onSuccess={() => {
            loadRelationships()
            setEditRelPopup(null)
          }}
        />
      )}

      {renameData && (
        <EntityRenamePopup
          projectPath={projectPath}
          entity={renameData.entity}
          oldName={renameData.oldName}
          newName={renameData.newName}
          onClose={() => {
            setRenameData(null)
            setEditMode(false)
          }}
          onSuccess={(didReplace) => {
            setRenameData(null)
            setEditMode(false)
            if (didReplace) onReloadCurrentChapter?.()
          }}
        />
      )}
    </div >
  )
}
