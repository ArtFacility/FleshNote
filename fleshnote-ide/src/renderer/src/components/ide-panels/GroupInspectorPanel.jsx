import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from '../CalendarDatePicker'
import EntityRenamePopup from '../EntityRenamePopup'
import ImageGallery from './ImageGallery'

const FACTION_COLORS = [
  '#991b1b', // crimson
  '#ea580c', // orange
  '#d4a052', // amber
  '#15803d', // emerald
  '#0e7490', // cyan
  '#2563eb', // sapphire
  '#7c3aed', // violet
  '#64748b'  // slate
]

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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Crown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  ),
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Brain: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
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
  Feather: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  Scroll: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2h8a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4" />
      <path d="M8 6h8" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Image: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
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
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function GroupInspectorPanel({
  group: propGroup,
  entity,
  characters = [],
  entities = [],
  activeChapter,
  projectPath,
  projectConfig,
  calConfig,
  chapters = [],
  onEntityUpdated,
  onConfigUpdate,
  initialTab,
  onNavigateToMark,
  onReloadCurrentChapter,
  onFlushEditorSave,
  onIconChanged,
  onNavigateToEntity
}) {
  const group = propGroup || entity
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(initialTab || 'overview')

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [iconPath, setIconPath] = useState(null)
  const [renameData, setRenameData] = useState(null)

  // ── Roster & Members State ──
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberFilter, setMemberFilter] = useState('all') // 'all' | 'active' | 'former'
  const [viewMode, setViewMode] = useState('author') // 'author' | 'world_time'
  const [addingMember, setAddingMember] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState(null)
  const [departingMemberId, setDepartingMemberId] = useState(null)

  const [newMemberData, setNewMemberData] = useState({
    character_id: '',
    role_title: 'Member',
    rank_order: 1,
    joined_date: '',
    standing: 'loyal',
    notes: '',
    create_history_entry: true
  })

  const [departureData, setDepartureData] = useState({
    left_date: '',
    departure_reason: 'Resigned',
    notes: '',
    create_history_entry: true
  })

  // ── History Entries State ──
  const [historyEntries, setHistoryEntries] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [addingHistory, setAddingHistory] = useState(false)
  const [newHistoryData, setNewHistoryData] = useState({
    title: '',
    description: '',
    event_type: 'milestone',
    date_year: 0,
    date_month: 1,
    date_day: 1,
    chapter_id: ''
  })
  const [editingHistoryId, setEditingHistoryId] = useState(null)
  const [editHistoryData, setEditHistoryData] = useState({
    title: '',
    description: '',
    date_year: 0,
    date_month: 1,
    date_day: 1,
    chapter_id: ''
  })

  const currGroup = useMemo(() => {
    return entities.find((e) => String(e.id) === String(group?.id) && e.type === 'group') || group
  }, [entities, group])

  const otherGroups = useMemo(() => {
    return entities.filter((e) => e.type === 'group' && String(e.id) !== String(currGroup?.id))
  }, [entities, currGroup])

  const locations = useMemo(() => {
    return entities.filter((e) => e.type === 'location')
  }, [entities])

  // Effective world time for filtering
  const currentWorldTime = activeChapter?.world_time || null

  // ── Load Icon ──
  const loadIcon = useCallback(async () => {
    if (!projectPath || !currGroup?.id) return
    try {
      const res = await window.api.getBulkEntityIcons({ project_path: projectPath })
      setIconPath(res?.icons?.[`group:${currGroup.id}`] || null)
    } catch {
      setIconPath(null)
    }
  }, [projectPath, currGroup?.id])

  useEffect(() => {
    loadIcon()
  }, [loadIcon])

  // ── Load Members ──
  const loadMembers = useCallback(async () => {
    if (!projectPath || !currGroup?.id) return
    setLoadingMembers(true)
    try {
      const res = await window.api.getGroupMembers({
        project_path: projectPath,
        group_id: currGroup.id,
        current_world_time: viewMode === 'world_time' ? currentWorldTime : null,
        view_mode: viewMode
      })
      setMembers(res?.members || [])
    } catch (e) {
      console.error('Failed to load group members:', e)
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }, [projectPath, currGroup?.id, currentWorldTime, viewMode])

  useEffect(() => {
    loadMembers()
  }, [loadMembers, viewMode])

  // ── Load History Entries ──
  const loadHistory = useCallback(async () => {
    if (!projectPath || !currGroup?.id) return
    setLoadingHistory(true)
    try {
      const apiFn = window.api.getHistoryEntries || window.api.listHistoryEntries
      const res = await apiFn({
        project_path: projectPath,
        entity_type: 'group',
        entity_id: currGroup.id
      })
      setHistoryEntries(res?.entries || [])
    } catch (e) {
      console.error('Failed to load group history:', e)
      setHistoryEntries([])
    } finally {
      setLoadingHistory(false)
    }
  }, [projectPath, currGroup?.id])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, loadHistory, currGroup?.id])

  useEffect(() => {
    setEditMode(false)
    setAddingMember(false)
    setAddingHistory(false)
  }, [currGroup?.id])

  // ── Edit Mode Handlers ──
  const startEdit = () => {
    setEditData({
      name: currGroup.name || '',
      group_type: currGroup.group_type || '',
      description: currGroup.description || '',
      surface_agenda: currGroup.surface_agenda || '',
      true_agenda: currGroup.true_agenda || '',
      notes: currGroup.notes || '',
      parent_group_id: currGroup.parent_group_id || '',
      philosophy: currGroup.philosophy || '',
      internal_rules: currGroup.internal_rules || '',
      headquarters_location_id: currGroup.headquarters_location_id || '',
      faction_color: currGroup.faction_color || '#d4a052',
      aliases: (currGroup.aliases || []).join(', ')
    })
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditData({})
    setAddingMember(false)
    setAddingHistory(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const aliasesArray = (editData.aliases || '')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)

      const payload = {
        project_path: projectPath,
        group_id: currGroup.id,
        name: editData.name,
        aliases: aliasesArray,
        group_type: editData.group_type,
        description: editData.description,
        surface_agenda: editData.surface_agenda,
        true_agenda: editData.true_agenda,
        notes: editData.notes,
        parent_group_id: editData.parent_group_id || null,
        philosophy: editData.philosophy,
        internal_rules: editData.internal_rules,
        headquarters_location_id: editData.headquarters_location_id || null,
        faction_color: editData.faction_color
      }

      await window.api.updateGroup(payload)
      setEditMode(false)
      setAddingMember(false)
      setAddingHistory(false)
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to save group edits:', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Add Member Handler ──
  const handleAddMember = async () => {
    if (!newMemberData.character_id) return
    try {
      await window.api.addGroupMember({
        project_path: projectPath,
        group_id: currGroup.id,
        character_id: newMemberData.character_id,
        role_title: newMemberData.role_title,
        rank_order: parseInt(newMemberData.rank_order, 10) || 0,
        joined_date: newMemberData.joined_date || null,
        standing: newMemberData.standing,
        notes: newMemberData.notes,
        create_history_entry: newMemberData.create_history_entry
      })
      setAddingMember(false)
      setNewMemberData({
        character_id: '',
        role_title: 'Member',
        rank_order: 1,
        joined_date: currentWorldTime || '',
        standing: 'loyal',
        notes: '',
        create_history_entry: true
      })
      loadMembers()
      if (activeTab === 'history') loadHistory()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to add member:', e)
    }
  }

  // ── Update Member Standing / Role ──
  const handleUpdateMember = async (membershipId, fields) => {
    try {
      await window.api.updateGroupMember({
        project_path: projectPath,
        membership_id: membershipId,
        ...fields
      })
      loadMembers()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to update member:', e)
    }
  }

  // ── Depart / Remove Member ──
  const handleDepartMember = async (membershipId) => {
    try {
      await window.api.removeGroupMember({
        project_path: projectPath,
        membership_id: membershipId,
        left_date: departureData.left_date || currentWorldTime || new Date().toISOString().split('T')[0],
        departure_reason: departureData.departure_reason,
        hard_remove: false,
        create_history_entry: departureData.create_history_entry
      })
      setDepartingMemberId(null)
      loadMembers()
      if (activeTab === 'history') loadHistory()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to record member departure:', e)
    }
  }

  const handleHardRemoveMember = async (membershipId) => {
    if (!confirm(t('inspector.confirmRemoveMember', 'Permanently remove this member from the roster?'))) return
    try {
      await window.api.removeGroupMember({
        project_path: projectPath,
        membership_id: membershipId,
        hard_remove: true
      })
      loadMembers()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to hard remove member:', e)
    }
  }

  // ── Milestone Handlers ──
  const handleStartEditMilestone = (ev) => {
    setEditingHistoryId(ev.id)
    setEditHistoryData({
      title: ev.title || '',
      description: ev.description || '',
      date_year: ev.date_year ?? 0,
      date_month: ev.date_month ?? 1,
      date_day: ev.date_day ?? 1,
      chapter_id: ev.chapter_id || ''
    })
  }

  const handleSaveEditMilestone = async () => {
    if (!editingHistoryId || !editHistoryData.title) return
    try {
      await window.api.updateHistoryEntry({
        project_path: projectPath,
        entry_id: editingHistoryId,
        title: editHistoryData.title,
        description: editHistoryData.description,
        date_year: parseInt(editHistoryData.date_year, 10) || 0,
        date_month: parseInt(editHistoryData.date_month, 10) || 1,
        date_day: parseInt(editHistoryData.date_day, 10) || 1,
        chapter_id: editHistoryData.chapter_id || null
      })
      setEditingHistoryId(null)
      loadHistory()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to update milestone:', e)
    }
  }

  const handleDeleteMilestone = async (entryId) => {
    if (!confirm(t('inspector.confirmDeleteMilestone', 'Permanently delete this milestone?'))) return
    try {
      await window.api.deleteHistoryEntry({
        project_path: projectPath,
        entry_id: entryId
      })
      loadHistory()
      if (onEntityUpdated) onEntityUpdated()
    } catch (e) {
      console.error('Failed to delete milestone:', e)
    }
  }


  // ── Filtered Members Roster ──
  const filteredMembers = useMemo(() => {
    if (memberFilter === 'all') return members
    return members.filter((m) => m.temporal_status === memberFilter)
  }, [members, memberFilter])

  const parentGroupName = useMemo(() => {
    if (!currGroup?.parent_group_id) return null
    const parent = entities.find((e) => String(e.id) === String(currGroup.parent_group_id))
    return parent?.name || null
  }, [entities, currGroup?.parent_group_id])

  const hqLocationName = useMemo(() => {
    if (!currGroup?.headquarters_location_id) return null
    const loc = entities.find((e) => String(e.id) === String(currGroup.headquarters_location_id))
    return loc?.name || null
  }, [entities, currGroup?.headquarters_location_id])

  if (!currGroup) return null

  return (
    <div className="inspector-panel-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Epistemic Mode Bar ── */}
      <div className="epistemic-mode-bar" style={{ margin: '-16px -16px 12px', width: 'calc(100% + 32px)' }}>
        <button
          className={`epistemic-mode-btn ${viewMode === 'author' ? 'active' : ''}`}
          onClick={() => setViewMode('author')}
          title={t('inspector.viewAuthorTooltip', 'Show all members — unfiltered')}
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

      {/* ── HEADER ── */}
      <div className="inspector-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {iconPath ? (
              <img
                src={`local-asset://${iconPath}`}
                alt="icon"
                style={{ width: 34, height: 34, objectFit: 'cover', border: '1px solid var(--border-default)' }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: currGroup.faction_color ? `${currGroup.faction_color}22` : 'var(--accent-amber-dim)',
                  border: `1px solid ${currGroup.faction_color || 'var(--accent-amber)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currGroup.faction_color || 'var(--accent-amber)'
                }}
              >
                <Icons.Users />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  {currGroup.name}
                </span>
                <button
                  className="ide-titlebar-btn"
                  onClick={() =>
                    setRenameData({
                      oldName: currGroup.name,
                      entityType: 'group',
                      entityId: currGroup.id
                    })
                  }
                  title={t('inspector.renameTooltip', 'Rename entity globally')}
                  style={{ padding: 2 }}
                >
                  <Icons.Edit />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    padding: '1px 6px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: currGroup.faction_color || 'var(--accent-amber)'
                  }}
                >
                  {currGroup.group_type || t('inspector.factionBadge', 'FACTION')}
                </span>
                {parentGroupName && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    ↳ {parentGroupName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {editMode ? (
              <>
                <button
                  className="entity-edit-btn save"
                  onClick={saveEdit}
                  disabled={saving}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  <Icons.Check /> {saving ? '...' : t('inspector.save', 'Save')}
                </button>
                <button
                  className="entity-edit-btn"
                  onClick={cancelEdit}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  <Icons.X />
                </button>
              </>
            ) : (
              <button
                className="entity-edit-btn"
                onClick={startEdit}
                title={t('inspector.editTooltip', 'Edit Faction Details')}
                style={{ padding: '4px 8px' }}
              >
                <Icons.Edit />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          margin: '0 -16px 16px',
          padding: '0 16px',
          gap: 14,
          overflowX: 'hidden',
          flexShrink: 0
        }}
      >
        {[
          { id: 'overview', label: t('inspector.tabOverview', 'Overview'), icon: <Icons.BookOpen /> },
          { id: 'roster', label: `${t('inspector.tabRoster', 'Roster')} (${members.length})`, icon: <Icons.Users /> },
          { id: 'history', label: t('inspector.tabHistory', 'History'), icon: <Icons.Clock /> },
          { id: 'references', label: t('inspector.tabReferences', 'References'), icon: <Icons.Image /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 0',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--accent-amber)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-amber)' : '2px solid transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon}
            {activeTab === tab.id && <span>{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Description */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.BookOpen /> {t('inspector.descriptionSection', 'Description')}
              </div>
              {editMode ? (
                <textarea
                  className="entity-edit-textarea"
                  value={editData.description || ''}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              ) : (
                <div className="entity-bio">
                  {currGroup.description || t('inspector.noDescription', 'No description yet.')}
                </div>
              )}
            </div>

            {/* Agendas (Surface vs True) */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Target /> {t('inspector.agendasSection', 'Agendas')}
              </div>
              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label className="entity-edit-label">{t('inspector.groupTypeLabel', 'Group / Faction Type')}</label>
                    <input
                      className="entity-edit-input"
                      value={editData.group_type || ''}
                      onChange={(e) => setEditData((p) => ({ ...p, group_type: e.target.value }))}
                      placeholder="e.g. Guild, Order, Syndicate, Cult, Military"
                    />
                  </div>
                  <div>
                    <label className="entity-edit-label">{t('inspector.surfaceAgendaLabel', 'Surface Agenda (Public Goal)')}</label>
                    <textarea
                      className="entity-edit-textarea"
                      value={editData.surface_agenda || ''}
                      onChange={(e) => setEditData((p) => ({ ...p, surface_agenda: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="entity-edit-label">{t('inspector.trueAgendaLabel', 'True Agenda (Secret / Author Only)')}</label>
                    <textarea
                      className="entity-edit-textarea"
                      value={editData.true_agenda || ''}
                      onChange={(e) => setEditData((p) => ({ ...p, true_agenda: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currGroup.surface_agenda && (
                    <div className="entity-agenda-row">
                      <div className="entity-agenda-icon" style={{ color: 'var(--accent-green)' }}>
                        <Icons.Eye />
                      </div>
                      <div>
                        <div className="entity-agenda-label">{t('inspector.surfaceAgenda', 'Surface Agenda')}</div>
                        <div className="entity-agenda-text">{currGroup.surface_agenda}</div>
                      </div>
                    </div>
                  )}
                  {currGroup.true_agenda && (
                    <div className="entity-agenda-row">
                      <div className="entity-agenda-icon" style={{ color: 'var(--accent-red)' }}>
                        <Icons.EyeOff />
                      </div>
                      <div>
                        <div className="entity-agenda-label">{t('inspector.trueAgenda', 'True Agenda (Author Only)')}</div>
                        <div className="entity-agenda-text">{currGroup.true_agenda}</div>
                      </div>
                    </div>
                  )}
                  {!currGroup.surface_agenda && !currGroup.true_agenda && (
                    <div className="entity-detail-value" style={{ opacity: 0.5 }}>
                      {t('inspector.noAgendas', 'No agendas recorded.')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Philosophy & Doctrine */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Scroll /> {t('inspector.philosophySection', 'Philosophy & Doctrine')}
              </div>
              {editMode ? (
                <textarea
                  className="entity-edit-textarea"
                  value={editData.philosophy || ''}
                  onChange={(e) => setEditData((p) => ({ ...p, philosophy: e.target.value }))}
                  placeholder="Core tenets, sacred vows, mottos, philosophical dogma..."
                  rows={3}
                />
              ) : (
                <div className="entity-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                  {currGroup.philosophy || <span style={{ opacity: 0.5 }}>{t('inspector.noPhilosophy', 'No philosophy or doctrine set.')}</span>}
                </div>
              )}
            </div>

            {/* Internal Rules & Hierarchy */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Shield /> {t('inspector.rulesSection', 'Rules & Hierarchy Code')}
              </div>
              {editMode ? (
                <textarea
                  className="entity-edit-textarea"
                  value={editData.internal_rules || ''}
                  onChange={(e) => setEditData((p) => ({ ...p, internal_rules: e.target.value }))}
                  placeholder="Entry rituals, succession laws, disciplinary punishments..."
                  rows={3}
                />
              ) : (
                <div className="entity-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                  {currGroup.internal_rules || <span style={{ opacity: 0.5 }}>{t('inspector.noRules', 'No internal rules or hierarchy specified.')}</span>}
                </div>
              )}
            </div>

            {/* Hierarchy Links (Parent Faction & HQ Location) */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Crown /> {t('inspector.hierarchySection', 'Affiliations & Headquarters')}
              </div>
              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label className="entity-edit-label">{t('inspector.parentGroupLabel', 'Parent Faction / Higher Order')}</label>
                    <select
                      className="entity-edit-input"
                      value={editData.parent_group_id || ''}
                      onChange={(e) => setEditData((p) => ({ ...p, parent_group_id: e.target.value }))}
                    >
                      <option value="">{t('inspector.noParentGroup', 'None (Independent Order)')}</option>
                      {otherGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="entity-edit-label">{t('inspector.hqLabel', 'Headquarters Location')}</label>
                    <select
                      className="entity-edit-input"
                      value={editData.headquarters_location_id || ''}
                      onChange={(e) => setEditData((p) => ({ ...p, headquarters_location_id: e.target.value }))}
                    >
                      <option value="">{t('inspector.noHq', 'None (Nomadic / Dispersed)')}</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="entity-edit-label">{t('inspector.factionColorLabel', 'Faction Badge Accent Color')}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      {FACTION_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditData((p) => ({ ...p, faction_color: c }))}
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: c,
                            border: (editData.faction_color || '#d4a052') === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                            borderRadius: '0px'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.parentGroup', 'Parent Order')}</div>
                    <div className="entity-detail-value">
                      {parentGroupName || <span style={{ opacity: 0.5 }}>{t('inspector.independent', 'Independent')}</span>}
                    </div>
                  </div>
                  <div className="entity-detail-row">
                    <div className="entity-detail-label">{t('inspector.hq', 'Headquarters')}</div>
                    <div className="entity-detail-value">
                      {hqLocationName || <span style={{ opacity: 0.5 }}>{t('inspector.none', 'None')}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aliases */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Eye /> {t('inspector.aliasesSection', 'Aliases')}
              </div>
              {editMode ? (
                <input
                  className="entity-edit-input"
                  value={editData.aliases || ''}
                  onChange={(e) => setEditData((p) => ({ ...p, aliases: e.target.value }))}
                  placeholder={t('inspector.commaSeparated', 'Comma-separated aliases')}
                />
              ) : currGroup.aliases && currGroup.aliases.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {currGroup.aliases.map((a, i) => (
                    <div className="entity-property-item" key={i}>{a}</div>
                  ))}
                </div>
              ) : (
                <div className="entity-detail-value" style={{ opacity: 0.5 }}>{t('inspector.none', 'None')}</div>
              )}
            </div>

            {/* Author Notes */}
            <div className="entity-section">
              <div className="entity-section-title">
                <Icons.Feather /> {t('inspector.authorNotesSection', 'Author Notes')}
              </div>
              {editMode ? (
                <textarea
                  className="entity-edit-textarea"
                  value={editData.notes || ''}
                  onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                />
              ) : (
                <div className="entity-narrative-note">
                  {currGroup.notes || t('inspector.noNotes', 'No author notes.')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ROSTER & MEMBERS TAB */}
        {activeTab === 'roster' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Filter chips & Add Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'active', 'former'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMemberFilter(filter)}
                    style={{
                      background: memberFilter === filter ? 'var(--bg-elevated)' : 'transparent',
                      border: `1px solid ${memberFilter === filter ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      color: memberFilter === filter ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {editMode && (
                <button
                  className="entity-edit-btn save"
                  onClick={() => setAddingMember(!addingMember)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px' }}
                >
                  <Icons.Plus /> {t('inspector.addMember', 'Add Member')}
                </button>
              )}
            </div>

            {/* Add Member Inline Card */}
            {editMode && addingMember && (
              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-amber)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
                  {t('inspector.recruitMemberTitle', 'Recruit Character into Faction')}
                </div>
                <div>
                  <label className="entity-edit-label">{t('inspector.selectCharacter', 'Character')}</label>
                  <select
                    className="entity-edit-input"
                    value={newMemberData.character_id}
                    onChange={(e) => setNewMemberData((p) => ({ ...p, character_id: e.target.value }))}
                  >
                    <option value="">{t('inspector.chooseCharacter', 'Choose a character...')}</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <label className="entity-edit-label">{t('inspector.roleTitle', 'Rank / Role Title')}</label>
                    <input
                      className="entity-edit-input"
                      value={newMemberData.role_title}
                      onChange={(e) => setNewMemberData((p) => ({ ...p, role_title: e.target.value }))}
                      placeholder="e.g. High Priest, Sentinel, Infiltrator"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.hierarchyRank', 'Rank Order (0 = Top)')}</label>
                    <input
                      type="number"
                      className="entity-edit-input"
                      value={newMemberData.rank_order}
                      onChange={(e) => setNewMemberData((p) => ({ ...p, rank_order: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.joinedDate', 'Join World Date')}</label>
                    <CalendarDatePicker
                      value={newMemberData.joined_date || ''}
                      onChange={(v) => setNewMemberData((p) => ({ ...p, joined_date: v }))}
                      calConfig={calConfig}
                      projectPath={projectPath}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.standing', 'Standing / Allegiance')}</label>
                    <select
                      className="entity-edit-input"
                      value={newMemberData.standing}
                      onChange={(e) => setNewMemberData((p) => ({ ...p, standing: e.target.value }))}
                    >
                      <option value="loyal">{t('inspector.standingLoyal', 'Loyal')}</option>
                      <option value="suspicious">{t('inspector.standingSuspicious', 'Suspicious')}</option>
                      <option value="traitor">{t('inspector.standingTraitor', 'Traitor / Double Agent')}</option>
                      <option value="honorary">{t('inspector.standingHonorary', 'Honorary / Figurehead')}</option>
                    </select>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newMemberData.create_history_entry}
                    onChange={(e) => setNewMemberData((p) => ({ ...p, create_history_entry: e.target.checked }))}
                  />
                  {t('inspector.logToHistory', 'Log event to World History timeline')}
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="entity-edit-btn" onClick={() => setAddingMember(false)}>
                    {t('inspector.cancel', 'Cancel')}
                  </button>
                  <button className="entity-edit-btn save" onClick={handleAddMember}>
                    {t('inspector.confirmRecruit', 'Recruit Member')}
                  </button>
                </div>
              </div>
            )}

            {/* Departure Dialog */}
            {departingMemberId && (
              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-red)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-red)', textTransform: 'uppercase' }}>
                  {t('inspector.recordDepartureTitle', 'Record Member Departure / Expulsion')}
                </div>
                <div>
                  <label className="entity-edit-label">{t('inspector.departureDate', 'Departure Date')}</label>
                  <CalendarDatePicker
                    value={departureData.left_date || ''}
                    onChange={(v) => setDepartureData((p) => ({ ...p, left_date: v }))}
                    calConfig={calConfig}
                    projectPath={projectPath}
                  />
                </div>
                <div>
                  <label className="entity-edit-label">{t('inspector.departureReason', 'Departure Reason')}</label>
                  <input
                    className="entity-edit-input"
                    value={departureData.departure_reason}
                    onChange={(e) => setDepartureData((p) => ({ ...p, departure_reason: e.target.value }))}
                    placeholder="e.g. Exiled, Slain in battle, Defected to Rebels"
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={departureData.create_history_entry}
                    onChange={(e) => setDepartureData((p) => ({ ...p, create_history_entry: e.target.checked }))}
                  />
                  {t('inspector.logDepartureToHistory', 'Log departure to World History timeline')}
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="entity-edit-btn" onClick={() => setDepartingMemberId(null)}>
                    {t('inspector.cancel', 'Cancel')}
                  </button>
                  <button
                    className="entity-edit-btn"
                    style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                    onClick={() => handleDepartMember(departingMemberId)}
                  >
                    {t('inspector.confirmDeparture', 'Record Departure')}
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            {loadingMembers ? (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: 12 }}>
                {t('inspector.loadingMembers', 'Loading roster...')}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="entity-detail-value" style={{ opacity: 0.5, padding: 12 }}>
                {t('inspector.noMembersMatch', 'No members found in this view.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredMembers.map((m) => {
                  const isEditing = editingMemberId === m.id
                  return (
                    <div
                      key={m.id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderInlineStart: `3px solid ${
                          m.standing === 'traitor'
                            ? 'var(--accent-red)'
                            : m.standing === 'suspicious'
                            ? 'var(--accent-amber)'
                            : m.standing === 'honorary'
                            ? 'var(--accent-blue)'
                            : 'var(--accent-green)'
                        }`,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {m.character_name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              textTransform: 'uppercase',
                              padding: '1px 5px',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--accent-amber)'
                            }}
                          >
                            {m.role_title}
                          </span>
                          {m.rank_order !== undefined && m.rank_order !== null && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                              #{m.rank_order}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 8,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              padding: '1px 4px',
                              color:
                                m.temporal_status === 'active'
                                  ? 'var(--accent-green)'
                                  : m.temporal_status === 'former'
                                  ? 'var(--text-tertiary)'
                                  : 'var(--accent-purple)'
                            }}
                          >
                            {m.temporal_status}
                          </span>

                          {editMode && (
                            <>
                              <button
                                onClick={() => setDepartingMemberId(m.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
                                title={t('inspector.recordDeparture', 'Record Departure')}
                              >
                                <Icons.X />
                              </button>
                              <button
                                onClick={() => handleHardRemoveMember(m.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 2 }}
                                title={t('inspector.hardRemove', 'Delete Membership')}
                              >
                                <Icons.Trash />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Dates & Standing */}
                      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {m.joined_date && (
                          <span>Joined: {m.joined_date}</span>
                        )}
                        {m.left_date && (
                          <span style={{ color: 'var(--accent-red)' }}>
                            Left: {m.left_date} ({m.departure_reason || 'Departed'})
                          </span>
                        )}
                        <span style={{ textTransform: 'capitalize' }}>
                          Standing: {m.standing}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. HISTORY TIMELINE TAB */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                {t('inspector.factionMilestones', 'Recorded Faction Milestones')}
              </div>
              {editMode && (
                <button
                  className="entity-edit-btn save"
                  onClick={() => setAddingHistory(!addingHistory)}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  <Icons.Plus /> {t('inspector.addMilestone', 'Add Milestone')}
                </button>
              )}
            </div>

            {editMode && addingHistory && (
              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div>
                  <label className="entity-edit-label">{t('inspector.milestoneTitle', 'Event Title')}</label>
                  <input
                    className="entity-edit-input"
                    value={newHistoryData.title}
                    onChange={(e) => setNewHistoryData((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. The Great Schism, Treaty Signed"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.year', 'Year')}</label>
                    <input
                      type="number"
                      className="entity-edit-input"
                      value={newHistoryData.date_year}
                      onChange={(e) => setNewHistoryData((p) => ({ ...p, date_year: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.month', 'Month')}</label>
                    <input
                      type="number"
                      className="entity-edit-input"
                      value={newHistoryData.date_month}
                      onChange={(e) => setNewHistoryData((p) => ({ ...p, date_month: parseInt(e.target.value, 10) || 1 }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="entity-edit-label">{t('inspector.day', 'Day')}</label>
                    <input
                      type="number"
                      className="entity-edit-input"
                      value={newHistoryData.date_day}
                      onChange={(e) => setNewHistoryData((p) => ({ ...p, date_day: parseInt(e.target.value, 10) || 1 }))}
                    />
                  </div>
                </div>
                {chapters?.length > 0 && (
                  <div>
                    <label className="entity-edit-label">{t('inspector.chapter', 'Chapter (Optional)')}</label>
                    <select
                      className="entity-edit-select"
                      value={newHistoryData.chapter_id || ''}
                      onChange={(e) => setNewHistoryData((p) => ({ ...p, chapter_id: e.target.value || '' }))}
                    >
                      <option value="">{t('inspector.noneNoChapter', '— None / Project Wide —')}</option>
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.title || `Chapter ${ch.order_index + 1}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="entity-edit-label">{t('inspector.description', 'Description')}</label>
                  <textarea
                    className="entity-edit-textarea"
                    value={newHistoryData.description}
                    onChange={(e) => setNewHistoryData((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="entity-edit-btn" onClick={() => setAddingHistory(false)}>{t('inspector.cancel', 'Cancel')}</button>
                  <button
                    className="entity-edit-btn save"
                    onClick={async () => {
                      if (!newHistoryData.title) return
                      await window.api.createHistoryEntry({
                        project_path: projectPath,
                        entity_type: 'group',
                        entity_id: currGroup.id,
                        title: newHistoryData.title,
                        description: newHistoryData.description,
                        event_type: 'milestone',
                        date_year: newHistoryData.date_year,
                        date_month: newHistoryData.date_month,
                        date_day: newHistoryData.date_day,
                        date_precise: 1,
                        chapter_id: newHistoryData.chapter_id || null
                      })
                      setAddingHistory(false)
                      setNewHistoryData({
                        title: '',
                        description: '',
                        event_type: 'milestone',
                        date_year: 0,
                        date_month: 1,
                        date_day: 1,
                        chapter_id: activeChapter?.id || ''
                      })
                      loadHistory()
                      if (onEntityUpdated) onEntityUpdated()
                    }}
                  >
                    {t('inspector.saveMilestone', 'Save Milestone')}
                  </button>
                </div>
              </div>
            )}

            {loadingHistory ? (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: 12 }}>
                {t('inspector.loadingHistory', 'Loading history events...')}
              </div>
            ) : historyEntries.length === 0 ? (
              <div className="entity-detail-value" style={{ opacity: 0.5, padding: 12 }}>
                {t('inspector.noHistoryEvents', 'No timeline events recorded yet.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historyEntries.map((ev) => {
                  const canNavigate = ev.chapter_id && onNavigateToMark
                  const chapterTitle = ev.chapter_id ? chapters?.find(c => String(c.id) === String(ev.chapter_id))?.title : null

                  if (editingHistoryId === ev.id) {
                    return (
                      <div
                        key={ev.id}
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8
                        }}
                      >
                        <div>
                          <label className="entity-edit-label">{t('inspector.milestoneTitle', 'Event Title')}</label>
                          <input
                            className="entity-edit-input"
                            value={editHistoryData.title}
                            onChange={(e) => setEditHistoryData((p) => ({ ...p, title: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label className="entity-edit-label">{t('inspector.year', 'Year')}</label>
                            <input
                              type="number"
                              className="entity-edit-input"
                              value={editHistoryData.date_year}
                              onChange={(e) => setEditHistoryData((p) => ({ ...p, date_year: parseInt(e.target.value, 10) || 0 }))}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="entity-edit-label">{t('inspector.month', 'Month')}</label>
                            <input
                              type="number"
                              className="entity-edit-input"
                              value={editHistoryData.date_month}
                              onChange={(e) => setEditHistoryData((p) => ({ ...p, date_month: parseInt(e.target.value, 10) || 1 }))}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="entity-edit-label">{t('inspector.day', 'Day')}</label>
                            <input
                              type="number"
                              className="entity-edit-input"
                              value={editHistoryData.date_day}
                              onChange={(e) => setEditHistoryData((p) => ({ ...p, date_day: parseInt(e.target.value, 10) || 1 }))}
                            />
                          </div>
                        </div>
                        {chapters?.length > 0 && (
                          <div>
                            <label className="entity-edit-label">{t('inspector.chapter', 'Chapter (Optional)')}</label>
                            <select
                              className="entity-edit-select"
                              value={editHistoryData.chapter_id || ''}
                              onChange={(e) => setEditHistoryData((p) => ({ ...p, chapter_id: e.target.value || '' }))}
                            >
                              <option value="">{t('inspector.noneNoChapter', '— None / Project Wide —')}</option>
                              {chapters.map((ch) => (
                                <option key={ch.id} value={ch.id}>{ch.title || `Chapter ${ch.order_index + 1}`}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="entity-edit-label">{t('inspector.description', 'Description')}</label>
                          <textarea
                            className="entity-edit-textarea"
                            value={editHistoryData.description}
                            onChange={(e) => setEditHistoryData((p) => ({ ...p, description: e.target.value }))}
                            rows={2}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="entity-edit-btn" onClick={() => setEditingHistoryId(null)}>{t('inspector.cancel', 'Cancel')}</button>
                          <button className="entity-edit-btn save" onClick={handleSaveEditMilestone}>{t('inspector.saveMilestone', 'Save Milestone')}</button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={ev.id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                            {ev.title}
                          </span>
                          {ev.chapter_id && (
                            canNavigate ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToMark({ chapterId: ev.chapter_id, wordOffset: ev.word_offset ?? null })}
                                style={{
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--accent-amber)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 9,
                                  padding: '1px 5px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                title={t('inspector.jumpToManuscript', 'Jump to location in manuscript')}
                              >
                                <span>𐲨</span>
                                {chapterTitle || t('inspector.chapterPrefixShort', 'Ch.')}
                              </button>
                            ) : (
                              <span
                                style={{
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 9,
                                  padding: '1px 5px'
                                }}
                              >
                                {chapterTitle || t('inspector.chapterPrefixShort', 'Ch.')}
                              </span>
                            )
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-amber)' }}>
                            {ev.date_year}-{String(ev.date_month || 1).padStart(2, '0')}-{String(ev.date_day || 1).padStart(2, '0')}
                          </span>
                          {editMode && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditMilestone(ev)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2 }}
                                title={t('inspector.editMilestone', 'Edit Milestone')}
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMilestone(ev.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 2 }}
                                title={t('inspector.deleteMilestone', 'Delete Milestone')}
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {ev.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {ev.description}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. REFERENCES & IMAGES TAB */}
        {activeTab === 'references' && (
          <ImageGallery
            projectPath={projectPath}
            entityType="group"
            entityId={currGroup.id}
            onIconChanged={loadIcon}
          />
        )}
      </div>

      {/* Rename Modal */}
      {renameData && (
        <EntityRenamePopup
          projectPath={projectPath}
          oldName={renameData.oldName}
          entityType={renameData.entityType}
          entityId={renameData.entityId}
          onClose={() => setRenameData(null)}
          onSuccess={() => {
            setRenameData(null)
            if (onEntityUpdated) onEntityUpdated()
          }}
        />
      )}
    </div>
  )
}
