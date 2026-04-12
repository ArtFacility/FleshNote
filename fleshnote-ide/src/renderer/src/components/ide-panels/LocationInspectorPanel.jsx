import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import EntityRenamePopup from '../EntityRenamePopup'
import CalendarDatePicker from '../CalendarDatePicker'
import ImageGallery from './ImageGallery'
import LocationNameGeneratorModal from '../LocationNameGeneratorModal'
import { parseWorldDate, dateToLinear } from '../../utils/calendarUtils'

const Icons = {
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  CloudRain: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
      <path d="M8 19v1"></path>
      <path d="M8 14v1"></path>
      <path d="M16 19v1"></path>
      <path d="M16 14v1"></path>
      <path d="M12 21v1"></path>
      <path d="M12 16v1"></path>
    </svg>
  ),
  Thermometer: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
    </svg>
  ),
  Droplet: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path>
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
  Image: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Wand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8L19 13"></path>
      <path d="M15 9h.01"></path>
      <path d="M17.8 6.2L19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  )
}

function TypeIcon() {
  return <Icons.MapPin />
}

export default function LocationInspectorPanel({
  entity, entities, characters, activeChapter, projectPath, projectConfig, calConfig, chapters, onEntityUpdated, initialTab, onNavigateToMark, onReloadCurrentChapter, onFlushEditorSave, onNavigateToEntity, onIconChanged
}) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState('author')
  const [filterCharacterId, setFilterCharacterId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [knowledgeCollapsed, setKnowledgeCollapsed] = useState(initialTab !== 'knowledge')
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [knowledgeFacts, setKnowledgeFacts] = useState([])
  const [addingFact, setAddingFact] = useState(false)
  const [newFact, setNewFact] = useState({ fact: '', character_id: '', is_secret: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingFactId, setEditingFactId] = useState(null)
  const [editFactData, setEditFactData] = useState({ fact: '', is_secret: 0 })
  const [renameData, setRenameData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [iconPath, setIconPath] = useState(null)
  const [showLocGen, setShowLocGen] = useState(false)

  const [weatherStates, setWeatherStates] = useState([])
  const [addingWeather, setAddingWeather] = useState(false)
  const [newWeather, setNewWeather] = useState({ world_time: activeChapter?.world_time || '', weather: '', temperature: '', moisture: '' })
  const [weatherHistoryTab, setWeatherHistoryTab] = useState('current')
  
  const WEATHER_TEMPLATES = ["Clear / Sunny", "Cloudy", "Rain", "Storm", "Snow", "Fog", "Overcast", "Windy"]
  const T = { text: 'var(--text-main)', textDim: 'var(--text-secondary)', amber: 'var(--accent-amber)', amberDim: 'var(--accent-amber-dim)', bg2: 'var(--bg-elevated)', bg3: 'var(--border-subtle)', red: 'var(--accent-red)' }

  useEffect(() => {
    if (initialTab === 'knowledge') setKnowledgeCollapsed(false)
  }, [initialTab])

  const loadIcon = useCallback(async () => {
    if (!projectPath || !entity?.id) return
    try {
      const res = await window.api.getBulkEntityIcons({ project_path: projectPath })
      setIconPath(res?.icons?.[`loc:${entity.id}`] || null)
    } catch { setIconPath(null) }
  }, [projectPath, entity?.id])

  useEffect(() => { loadIcon() }, [loadIcon])

  const currEntity = entities.find(e => String(e.id) === String(entity.id) && e.type === 'location') || entity
  const locationData = currEntity

  const subLocations = entities.filter(e => e.type === 'location' && String(e.parent_location_id) === String(locationData.id))
  const parentLoc = entities.find(e => e.type === 'location' && String(e.id) === String(locationData.parent_location_id))

  useEffect(() => {
    if (activeChapter?.pov_character_id) {
      setFilterCharacterId(activeChapter.pov_character_id)
    }
  }, [activeChapter?.pov_character_id])

  const loadWeatherStates = useCallback(async (locId) => {
    try {
      if (!projectPath || !locId) return []
      const res = await window.api.getWeatherStates({ project_path: projectPath, location_id: locId })
      return res.weather_states || []
    } catch {
      return []
    }
  }, [projectPath])

  const { statesLookup, parentLookup } = useMemo(() => {
    const lookup = {}
    const pLookup = {}
    weatherStates.forEach(ws => {
      lookup[ws.locationId] = ws.states
      pLookup[ws.locationId] = { name: ws.locationName }
    })
    return { statesLookup: lookup, parentLookup: pLookup }
  }, [weatherStates])

  const worldTimeToLinear = useCallback((timeStr) => {
    if (!timeStr) return null
    const parsed = parseWorldDate(timeStr, calConfig)
    if (!parsed) return null
    return dateToLinear(parsed.year, parsed.month, parsed.day, calConfig)
  }, [calConfig])

  const { activeWeatherState, weatherIsHistory, weatherDaysAgo } = useMemo(() => {
    const getInheritedWeather = (locId, targetTime, depth = 0) => {
      if (depth > 5) return [null, false, 0]
      const targetLinear = worldTimeToLinear(targetTime)
      const states = statesLookup[locId] || []
      const withLinear = states
        .map(s => ({ ...s, _linear: worldTimeToLinear(s.world_time) }))
        .filter(s => s._linear !== null)
      const sorted = [...withLinear].sort((a, b) => b._linear - a._linear)
      for (const s of sorted) {
        if (targetLinear !== null && s._linear <= targetLinear) {
          const daysAgo = targetLinear - s._linear
          return [{ ...s, inherited: depth > 0, source_location_id: locId }, daysAgo > 0, daysAgo]
        }
      }
      const loc = entities.find(e => e.type === 'location' && String(e.id) === String(locId))
      if (loc?.parent_location_id) return getInheritedWeather(loc.parent_location_id, targetTime, depth + 1)
      return [null, false, 0]
    }
    const [state, isHistory, daysAgo] = getInheritedWeather(entity.id, activeChapter?.world_time || '')
    return { activeWeatherState: state, weatherIsHistory: isHistory, weatherDaysAgo: daysAgo }
  }, [statesLookup, entity.id, activeChapter?.world_time, entities, worldTimeToLinear])

  useEffect(() => {
    let active = true
    const initWeather = async () => {
      if (!entity?.id) return
      const chain = []
      let curr = entity
      while (curr?.parent_location_id) {
        curr = entities.find(e => e.type === 'location' && String(e.id) === String(curr.parent_location_id))
        if (curr) chain.push(curr)
      }
      const allStates = [{ locationId: entity.id, locationName: entity.name, states: await loadWeatherStates(entity.id) }]
      for (const loc of chain) {
        allStates.push({ locationId: loc.id, locationName: loc.name, states: await loadWeatherStates(loc.id) })
      }
      if (active) setWeatherStates(allStates)
    }
    initWeather()
    return () => { active = false }
  }, [entity?.id, loadWeatherStates, entities])

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
    setAddingWeather(false)
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

  const handleLocGenConfirm = ({ name, description }) => {
    setEditData(prev => ({
      ...prev,
      name: name,
      description: description ? (prev.description ? prev.description + "\n\n" + description : description) : prev.description
    }))
    setShowLocGen(false)
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

  const handleAddWeather = async () => {
    if (!newWeather.world_time) return
    try {
      await window.api.createWeatherState({ project_path: projectPath, location_id: entity.id, ...newWeather })
      setAddingWeather(false)
      setNewWeather({ world_time: activeChapter?.world_time || '', weather: '', temperature: '', moisture: '' })
      setWeatherHistoryTab('current')
      onEntityUpdated?.()
    } catch(err) { console.error(err) }
  }

  const handleDeleteWeather = async (wId) => {
    try {
      await window.api.deleteWeatherState({ project_path: projectPath, weather_state_id: wId })
      onEntityUpdated?.()
    } catch(err) { console.error(err) }
  }

  const renderEditField = (label, field, multiline = false) => {
    const Component = multiline ? 'textarea' : 'input'
    return (
      <div className="entity-edit-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="entity-edit-label" style={{ marginBottom: 0 }}>{label}</label>
          {field === 'name' && (
            <button 
               onClick={() => setShowLocGen(true)} 
               style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }} 
               title={t('namegen.generate_tooltip', 'Generate Name')}
            >
              <Icons.Wand /> {t('namegen.generate_btn', 'Generate')}
            </button>
          )}
        </div>
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

  const targetTime = activeChapter?.world_time || ''
  const parentEntity = entities.find(e => e.type === 'location' && e.id === locationData.parent_location_id)
  const childrenEntities = entities.filter(e => e.type === 'location' && e.parent_location_id === locationData.id)

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

        {editMode ? renderEditField(t('inspector.nameLabel', 'Name'), 'name') : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {iconPath && <img src={`fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${iconPath}`} alt="" style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />}
            <div className="entity-name">{locationData.name}</div>
          </div>
        )}
        {!editMode && locationData.region && <div className="entity-subtitle">{locationData.region}</div>}
      </div>

      <div className="inspector-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '16px -16px 16px', padding: '0 16px', gap: '16px' }}>
        <button onClick={() => setActiveTab('overview')} style={{ background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', color: activeTab === 'overview' ? 'var(--accent-amber)' : 'var(--text-secondary)', borderBottom: activeTab === 'overview' ? '2px solid var(--accent-amber)' : '2px solid transparent', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}><Icons.BookOpen style={{ width: 14, height: 14, marginRight: activeTab === 'overview' ? 4 : 0 }} /> {activeTab === 'overview' && t('inspector.tabOverview', 'Overview')}</button>
        <button onClick={() => setActiveTab('references')} style={{ background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', color: activeTab === 'references' ? 'var(--accent-amber)' : 'var(--text-secondary)', borderBottom: activeTab === 'references' ? '2px solid var(--accent-amber)' : '2px solid transparent', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}><Icons.Image style={{ width: 14, height: 14, marginRight: activeTab === 'references' ? 4 : 0 }} /> {activeTab === 'references' && 'References'}</button>
      </div>

      {activeTab === 'overview' && <>
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 10, 
          color: T.textDim, 
          paddingBottom: 4, 
          marginBottom: 8, 
          borderBottom: `1px solid ${T.bg3}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline'
        }}>
          <span>{t('inspector.inLocation', 'In Region / Parent:')}</span>
          {parentEntity ? (
            <span 
              style={{ color: T.amber, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => onNavigateToEntity?.({ type: 'location', id: parentEntity.id })}
            >
              {parentEntity.name}
            </span>
          ) : <span style={{ opacity: 0.5 }}>None</span>}
        </div>
        {childrenEntities.length > 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: T.textDim, marginTop: 12 }}>
            <div style={{ marginBottom: 4 }}>{t('inspector.containsLocations', 'Contains:')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {childrenEntities.map(child => (
                <span 
                  key={child.id}
                  style={{ color: T.amber, cursor: 'pointer', background: T.amberDim, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}
                  onClick={() => onNavigateToEntity?.({ type: 'location', id: child.id })}
                >
                  {child.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
          <div className="entity-section">
            <div className="entity-section-title"><Icons.BookOpen /> {t('inspector.descriptionSection', 'Description')}</div>
            {editMode ? renderEditField('', 'description', true) : <div className="entity-bio">{locationData.description || t('inspector.noDescription', 'No description yet.')}</div>}
          </div>

          {/* ── ENVIRONMENT ─────────────────────────────────── */}
          <div className="inspector-section" style={{ borderBottom: `1px solid ${T.bg3}`, paddingBottom: 16 }}>
            <div className="inspector-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icons.CloudRain />
                <span>{t('inspector.environment', 'Environment')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setWeatherHistoryTab('current')} 
                  style={{ background: weatherHistoryTab === 'current' ? T.bg3 : 'transparent', border: 'none', color: weatherHistoryTab === 'current' ? T.text : T.textDim, fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                >
                  {t('inspector.weatherCurrent', 'Current')}
                </button>
                <button
                  onClick={() => setWeatherHistoryTab('history')}
                  style={{ background: weatherHistoryTab === 'history' ? T.bg3 : 'transparent', border: 'none', color: weatherHistoryTab === 'history' ? T.text : T.textDim, fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                >
                  {t('inspector.weatherHistory', 'History')}
                </button>
                <button
                  className="entity-edit-toggle"
                  onClick={() => setAddingWeather(!addingWeather)}
                  style={{ color: addingWeather ? T.amber : T.textDim }}
                >
                  <Icons.Plus />
                </button>
              </div>
            </div>

            <div style={{ padding: '0 12px' }}>
              
              {weatherHistoryTab === 'current' ? (
                <>
                  {!targetTime && (
                    <div style={{ fontSize: 11, color: T.textDim, padding: 8, background: T.bg2, borderRadius: 4, marginBottom: 12 }}>
                      {t('inspector.noActiveTimeContext', 'No active chapter time context. Showing default environment.')}
                    </div>
                  )}
                  
                  {addingWeather && (
                    <div className="knowledge-add-form" style={{ marginBottom: 12 }}>
                      <CalendarDatePicker
                        projectPath={projectPath}
                        value={newWeather.world_time}
                        onChange={val => setNewWeather(p => ({...p, world_time: val}))}
                        placeholder="World Time (e.g. 1920-10-05)"
                        compact={false}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <select 
                           className="entity-edit-input" 
                           value={WEATHER_TEMPLATES.includes(newWeather.weather) ? newWeather.weather : (newWeather.weather ? "Custom" : "")}
                           onChange={e => {
                               if (e.target.value !== "Custom") setNewWeather(p => ({...p, weather: e.target.value}))
                           }}
                           style={{ marginBottom: (!WEATHER_TEMPLATES.includes(newWeather.weather) && newWeather.weather !== "") ? 8 : 0 }}
                        >
                           <option value="">{t('inspector.weatherSelect', 'Select Weather...')}</option>
                           {WEATHER_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                           <option value="Custom">{t('inspector.weatherCustom', 'Custom / Free Text...')}</option>
                        </select>
                        {(!WEATHER_TEMPLATES.includes(newWeather.weather) && newWeather.weather !== "") && (
                           <input className="entity-edit-input" placeholder={t('inspector.weatherCustomPlaceholder', 'Type custom weather...')} value={newWeather.weather} onChange={e => setNewWeather(p => ({...p, weather: e.target.value}))}/>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                       <input className="entity-edit-input" placeholder={t('inspector.weatherTemp', 'Temp')} value={newWeather.temperature} onChange={e => setNewWeather(p => ({...p, temperature: e.target.value}))}/>
                       <input className="entity-edit-input" placeholder={t('inspector.weatherMoisture', 'Moisture')} value={newWeather.moisture} onChange={e => setNewWeather(p => ({...p, moisture: e.target.value}))}/>
                      </div>
                      <div className="knowledge-add-actions">
                        <button className="entity-edit-btn save" onClick={handleAddWeather}>{t('inspector.add', 'Add')}</button>
                        <button className="entity-edit-btn" onClick={() => setAddingWeather(false)}>{t('inspector.cancel', 'Cancel')}</button>
                      </div>
                    </div>
                  )}

                  {activeWeatherState ? (
                    <div
                      style={{
                        padding: '10px',
                        background: T.bg2,
                        borderRadius: 6,
                        borderLeft: `2px solid ${T.amber}`,
                        fontFamily: 'var(--font-mono)',
                        opacity: weatherIsHistory ? 0.6 : 1,
                        position: 'relative'
                      }}
                    >
                      {weatherIsHistory && (
                        <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 9, color: T.textDim }}>
                          {weatherDaysAgo > 0 ? t('inspector.weatherDaysAgo', '{{count}} day(s) ago', { count: weatherDaysAgo }) : t('inspector.weatherPreviousState', 'Previous State')}
                        </span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: T.amber }}>[{activeWeatherState.world_time}]</span>
                        {activeWeatherState.inherited && (
                          <span style={{ fontSize: 9, color: T.textDim, fontStyle: 'italic' }}>
                            {t('inspector.weatherInherited', 'Inherited')}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>{t('inspector.weatherLabel', 'Weather')}</div>
                          <div style={{ fontSize: 12, color: T.text }}>{activeWeatherState.weather || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>{t('inspector.weatherTemp', 'Temp')}</div>
                          <div style={{ fontSize: 12, color: T.text }}>{activeWeatherState.temperature || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>{t('inspector.weatherMoisture', 'Moisture')}</div>
                          <div style={{ fontSize: 12, color: T.text }}>{activeWeatherState.moisture || '—'}</div>
                        </div>
                      </div>
                      
                      {activeWeatherState.inherited && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.bg3}`, fontSize: 9, color: T.textDim }}>
                          {t('inspector.weatherInheritedFrom', 'Inherited from:')} <span style={{ color: T.amber }}>{parentLookup[activeWeatherState.source_location_id]?.name || t('inspector.unknown', 'Unknown')}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic', padding: 8, background: T.bg2, borderRadius: 4 }}>
                      {t('inspector.noWeather', 'No environment anomalies or active weather states detected for this time.')}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {(statesLookup[entity.id] || []).length === 0 && (
                      <div style={{ fontSize: 11, color: T.textDim }}>{t('inspector.noWeatherHistory', 'No explicit weather history.')}</div>
                    )}
                    {(statesLookup[entity.id] || []).map(state => (
                      <div key={state.id} style={{ padding: 8, borderBottom: `1px solid ${T.bg2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.amber }}>{state.world_time}</div>
                          <div style={{ fontSize: 12, color: T.text }}>{state.weather || '—'} (T: {state.temperature||'-'} M: {state.moisture||'-'})</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteWeather(state.id)}
                          style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', padding: 4 }}
                          title={t('inspector.deleteStateTooltip', 'Delete state')}
                        >
                          <Icons.X />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
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

          {/* ── KNOWLEDGE (collapsible) ────────────────── */}
          <div className="entity-section" style={{ marginTop: 0, borderTop: `1px solid ${T.bg3}`, paddingTop: 12 }}>
            <div
              className="entity-section-title"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setKnowledgeCollapsed(!knowledgeCollapsed)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.Brain /> {t('inspector.knowledgeSection', 'Knowledge')}
                <span style={{ fontSize: 10, color: T.textDim }}>({knowledgeFacts.length})</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!knowledgeCollapsed && viewMode === 'author' && (
                  <button className="entity-edit-toggle" onClick={(e) => { e.stopPropagation(); setAddingFact(!addingFact) }} title={t('inspector.addFactTooltip', 'Add Fact')}><Icons.Plus /></button>
                )}
                <span style={{ fontSize: 10, color: T.textDim, transform: knowledgeCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
              </div>
            </div>

            {!knowledgeCollapsed && (
              <>
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
              </>
            )}
          </div>
      </div>

      </>}

      {activeTab === 'references' && (
        <ImageGallery
          projectPath={projectPath}
          entityId={entity.id}
          entityType="loc"
          viewMode={viewMode}
          currentWorldTime={activeChapter?.world_time}
          onIconChanged={() => { loadIcon(); onIconChanged?.() }}
          calConfig={calConfig}
        />
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

      {showLocGen && (
        <LocationNameGeneratorModal
          projectPath={projectPath}
          projectConfig={projectConfig}
          onClose={() => setShowLocGen(false)}
          onConfirm={handleLocGenConfirm}
        />
      )}
    </div>
  )
}
