import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from './CalendarDatePicker'

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

export default function GroupActionPopup({
  mode = 'createGroup', // 'createGroup' | 'linkGroup' | 'addMember' | 'departMember' | 'addMilestone'
  selectedText = '',
  wordOffset = 0,
  chapterId = null,
  worldTime = '',
  position = { x: 300, y: 300 },
  projectPath,
  calConfig,
  characters = [],
  groups = [],
  defaultGroupId = null,
  onClose,
  onSuccess
}) {
  const { t } = useTranslation()
  const popupRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Loaded groups list if not passed or to refresh
  const [groupList, setGroupList] = useState(groups || [])
  const [selectedGroupId, setSelectedGroupId] = useState(
    defaultGroupId ? String(defaultGroupId) : (groups.length > 0 ? String(groups[0].id) : '')
  )

  // Mode 1: createGroup fields
  const [groupName, setGroupName] = useState(selectedText || '')
  const [foundedDate, setFoundedDate] = useState(worldTime || '')
  const [factionColor, setFactionColor] = useState('#d4a052')
  const [groupDescription, setGroupDescription] = useState('')

  // Mode 2: linkGroup search
  const [groupSearch, setGroupSearch] = useState('')

  // Mode 3: addMember fields
  const matchedCharId = useMemo(() => {
    if (!characters || characters.length === 0) return ''
    if (selectedText) {
      const clean = selectedText.trim().toLowerCase()
      // 1. Exact name match
      const exact = characters.find(c => (c.name || '').trim().toLowerCase() === clean)
      if (exact) return String(exact.id)
      // 2. Alias match
      const aliasMatch = characters.find(c => {
        let aliases = c.aliases
        if (typeof aliases === 'string') {
          try { aliases = JSON.parse(aliases) } catch { aliases = [] }
        }
        return Array.isArray(aliases) && aliases.some(a => (a || '').trim().toLowerCase() === clean)
      })
      if (aliasMatch) return String(aliasMatch.id)
      // 3. Substring match
      const sub = characters.find(c => (c.name || '').trim().toLowerCase().includes(clean))
      if (sub) return String(sub.id)
    }
    return String(characters[0].id)
  }, [characters, selectedText])

  const [memberCharId, setMemberCharId] = useState(matchedCharId)

  useEffect(() => {
    if (matchedCharId) {
      setMemberCharId(matchedCharId)
    }
  }, [matchedCharId])

  const [memberRole, setMemberRole] = useState('Member')
  const [memberJoinedDate, setMemberJoinedDate] = useState(worldTime || '')

  // Mode 4: departMember fields
  const [groupMembers, setGroupMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [departMembershipId, setDepartMembershipId] = useState('')
  const [departDate, setDepartDate] = useState(worldTime || '')
  const [departReason, setDepartReason] = useState('left')

  // Mode 5: addMilestone fields (title blank with placeholder, description prefilled with highlighted text)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState(worldTime || '')
  const [milestoneDescription, setMilestoneDescription] = useState(selectedText || '')

  // Fetch groups on mount if empty
  useEffect(() => {
    if (projectPath && (!groups || groups.length === 0)) {
      window.api.getGroups(projectPath)
        .then(res => {
          if (res?.groups) {
            setGroupList(res.groups)
            if (!selectedGroupId && res.groups.length > 0) {
              setSelectedGroupId(String(res.groups[0].id))
            }
          }
        })
        .catch(err => console.error('Failed to load groups in popup:', err))
    }
  }, [projectPath, groups])

  // Fetch active members when in departMember mode or when selectedGroupId changes
  useEffect(() => {
    if (mode === 'departMember' && projectPath && selectedGroupId) {
      setLoadingMembers(true)
      window.api.getGroupMembers({ project_path: projectPath, group_id: selectedGroupId, view_mode: 'author' })
        .then(res => {
          // Filter to active members (not left)
          const active = (res?.members || []).filter(m => !m.left_date)
          setGroupMembers(active)
          if (active.length > 0) {
            setDepartMembershipId(String(active[0].id))
          } else {
            setDepartMembershipId('')
          }
        })
        .catch(err => console.error('Failed to load group members:', err))
        .finally(() => setLoadingMembers(false))
    }
  }, [mode, projectPath, selectedGroupId])

  // Parse YYYY-MM-DD or year into integers
  const parseDateParts = (dateStr) => {
    if (!dateStr) return { year: null, month: null, day: null }
    const parts = String(dateStr).trim().split('-')
    const year = parts[0] ? parseInt(parts[0], 10) : null
    const month = parts[1] ? parseInt(parts[1], 10) : null
    const day = parts[2] ? parseInt(parts[2], 10) : null
    return {
      year: isNaN(year) ? null : year,
      month: isNaN(month) ? null : month,
      day: isNaN(day) ? null : day
    }
  }

  const handleSave = async () => {
    setErrorMsg('')
    setSaving(true)
    try {
      if (mode === 'createGroup') {
        if (!groupName.trim()) {
          setErrorMsg(t('groups.nameRequired', 'Faction name is required.'))
          setSaving(false)
          return
        }
        const res = await window.api.createGroup({
          project_path: projectPath,
          name: groupName.trim(),
          description: groupDescription,
          faction_color: factionColor,
          founded_date: foundedDate || null
        })
        if (res?.group) {
          onSuccess?.({ action: 'createGroup', group: res.group })
        }
      } else if (mode === 'linkGroup') {
        if (!selectedGroupId) {
          setErrorMsg(t('groups.selectGroupRequired', 'Please select a faction.'))
          setSaving(false)
          return
        }
        onSuccess?.({ action: 'linkGroup', groupId: selectedGroupId })
      } else if (mode === 'addMember') {
        if (!selectedGroupId || !memberCharId) {
          setErrorMsg(t('groups.memberFieldsRequired', 'Faction and character are required.'))
          setSaving(false)
          return
        }
        await window.api.addGroupMember({
          project_path: projectPath,
          group_id: selectedGroupId,
          character_id: memberCharId,
          role_title: memberRole.trim() || 'Member',
          joined_date: memberJoinedDate || null,
          create_history_entry: true
        })
        onSuccess?.({ action: 'addMember', groupId: selectedGroupId, characterId: memberCharId })
      } else if (mode === 'departMember') {
        if (!departMembershipId) {
          setErrorMsg(t('groups.noMemberSelected', 'Please select a member.'))
          setSaving(false)
          return
        }
        await window.api.removeGroupMember({
          project_path: projectPath,
          membership_id: departMembershipId,
          left_date: departDate || null,
          departure_reason: departReason || 'left',
          hard_remove: false,
          create_history_entry: true
        })
        onSuccess?.({ action: 'departMember', groupId: selectedGroupId })
      } else if (mode === 'addMilestone') {
        if (!selectedGroupId) {
          setErrorMsg(t('groups.selectGroupRequired', 'Please select a faction.'))
          setSaving(false)
          return
        }
        if (!milestoneTitle.trim()) {
          setErrorMsg(t('groups.milestoneTitleRequired', 'Milestone title is required.'))
          setSaving(false)
          return
        }
        const { year, month, day } = parseDateParts(milestoneDate)
        const res = await window.api.createHistoryEntry({
          project_path: projectPath,
          entity_type: 'group',
          entity_id: selectedGroupId,
          title: milestoneTitle.trim(),
          description: milestoneDescription,
          event_type: 'milestone',
          date_year: year !== null ? year : 0,
          date_month: month,
          date_day: day,
          date_precise: day !== null ? 1 : 0,
          chapter_id: chapterId,
          word_offset: wordOffset
        })
        if (res?.entry) {
          onSuccess?.({ action: 'addMilestone', milestoneId: res.entry.id, groupId: selectedGroupId })
        }
      }
      onClose?.()
    } catch (err) {
      console.error('GroupActionPopup save error:', err)
      setErrorMsg(err.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const getModalTitle = () => {
    switch (mode) {
      case 'createGroup': return t('groups.createFactionTitle', 'Create Faction / Group')
      case 'linkGroup': return t('groups.linkFactionTitle', 'Link to Faction / Group')
      case 'addMember': return t('groups.addMemberTitle', 'Add Member to Faction')
      case 'departMember': return t('groups.departMemberTitle', 'Record Member Departure')
      case 'addMilestone': return t('groups.addMilestoneTitle', 'Add Faction Milestone')
      default: return t('groups.factionModalTitle', 'Faction Action')
    }
  }

  const filteredGroups = groupList.filter(g =>
    (g.name || '').toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        ref={popupRef}
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, Math.max(10, window.innerWidth - 380)),
          top: Math.min(position.y, Math.max(10, window.innerHeight - 480)),
          width: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSave()
          }
        }}
      >
        <div className="popup-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: '13px' }}>
            {getModalTitle()}
          </span>
          <button className="popup-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>
            &times;
          </button>
        </div>

        {selectedText && (
          <div className="popup-subtitle" style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-secondary)' }}>
            "{selectedText.length > 50 ? selectedText.substring(0, 50) + '...' : selectedText}"
          </div>
        )}

        {errorMsg && (
          <div style={{ color: 'var(--accent-danger)', fontSize: '12px' }}>
            {errorMsg}
          </div>
        )}

        {/* ── MODE 1: createGroup ───────────────────────── */}
        {mode === 'createGroup' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.name', 'Faction Name')}</label>
              <input
                type="text"
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder={t('groups.namePlaceholder', 'e.g. Iron Syndicate')}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.foundedDate', 'Founding Date')}</label>
              <CalendarDatePicker
                value={foundedDate}
                onChange={setFoundedDate}
                calConfig={calConfig}
                projectPath={projectPath}
                placeholder={t('groups.foundedPlaceholder', 'Founding Date')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.colorTheme', 'Color Theme')}</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {FACTION_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFactionColor(c)}
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: c,
                      border: factionColor === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      borderRadius: '0px'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.description', 'Description')}</label>
              <textarea
                value={groupDescription}
                onChange={e => setGroupDescription(e.target.value)}
                placeholder={t('groups.descPlaceholder', 'Optional summary or agenda...')}
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px',
                  resize: 'none'
                }}
              />
            </div>
          </>
        )}

        {/* ── MODE 2: linkGroup ─────────────────────────── */}
        {mode === 'linkGroup' && (
          <>
            <input
              type="text"
              autoFocus
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              placeholder={t('groups.searchPlaceholder', 'Filter factions...')}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                padding: '6px 8px',
                borderRadius: '0px',
                fontSize: '13px'
              }}
            />
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-light)', padding: '4px' }}>
              {filteredGroups.map(g => (
                <div
                  key={g.id}
                  onClick={() => setSelectedGroupId(String(g.id))}
                  style={{
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    backgroundColor: selectedGroupId === String(g.id) ? 'var(--accent-amber)' : 'transparent',
                    color: selectedGroupId === String(g.id) ? 'var(--bg-deep)' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: g.faction_color || 'var(--entity-group)',
                    display: 'inline-block'
                  }} />
                  {g.name}
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <div style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  {t('groups.noFactionsFound', 'No factions found')}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MODE 3: addMember ─────────────────────────── */}
        {mode === 'addMember' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.faction', 'Faction')}</label>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              >
                {groupList.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.character', 'Character')}</label>
              <select
                value={memberCharId}
                onChange={e => setMemberCharId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              >
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.roleTitle', 'Role / Title')}</label>
              <input
                type="text"
                value={memberRole}
                onChange={e => setMemberRole(e.target.value)}
                placeholder="e.g. Officer, Specialist, Advisor, Member"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.joinedDate', 'Joined Date')}</label>
              <CalendarDatePicker
                value={memberJoinedDate}
                onChange={setMemberJoinedDate}
                calConfig={calConfig}
                projectPath={projectPath}
                placeholder={t('groups.joinedPlaceholder', 'Joined Date')}
              />
            </div>
          </>
        )}

        {/* ── MODE 4: departMember ──────────────────────── */}
        {mode === 'departMember' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.faction', 'Faction')}</label>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              >
                {groupList.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.activeMember', 'Member')}</label>
              {loadingMembers ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 0' }}>{t('common.loading', 'Loading members...')}</div>
              ) : (
                <select
                  value={departMembershipId}
                  onChange={e => setDepartMembershipId(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-light)',
                    padding: '6px 8px',
                    borderRadius: '0px',
                    fontSize: '13px'
                  }}
                >
                  {groupMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.character_name} ({m.role_title || 'Member'})
                    </option>
                  ))}
                  {groupMembers.length === 0 && (
                    <option value="">{t('groups.noActiveMembers', 'No active members in faction')}</option>
                  )}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.departureDate', 'Departure Date')}</label>
              <CalendarDatePicker
                value={departDate}
                onChange={setDepartDate}
                calConfig={calConfig}
                projectPath={projectPath}
                placeholder={t('groups.departureDatePlaceholder', 'Departure Date')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.departureReason', 'Departure Reason')}</label>
              <select
                value={departReason}
                onChange={e => setDepartReason(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              >
                <option value="left">{t('groups.reasonLeft', 'Left')}</option>
                <option value="expelled">{t('groups.reasonExpelled', 'Expelled')}</option>
                <option value="deceased">{t('groups.reasonDeceased', 'Deceased')}</option>
                <option value="retired">{t('groups.reasonRetired', 'Retired')}</option>
                <option value="other">{t('groups.reasonOther', 'Other')}</option>
              </select>
            </div>
          </>
        )}

        {/* ── MODE 5: addMilestone ──────────────────────── */}
        {mode === 'addMilestone' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.faction', 'Faction')}</label>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              >
                {groupList.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.milestoneTitle', 'Milestone Title')}</label>
              <input
                type="text"
                autoFocus
                value={milestoneTitle}
                onChange={e => setMilestoneTitle(e.target.value)}
                placeholder={t('groups.milestoneTitlePlaceholder', 'e.g. Battle of the Valley, Great Treaty')}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.milestoneDate', 'Date')}</label>
              <CalendarDatePicker
                value={milestoneDate}
                onChange={setMilestoneDate}
                calConfig={calConfig}
                projectPath={projectPath}
                placeholder={t('groups.datePlaceholder', 'Event Date')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('groups.notes', 'Details / Description')}</label>
              <textarea
                value={milestoneDescription}
                onChange={e => setMilestoneDescription(e.target.value)}
                placeholder={t('groups.milestoneDescPlaceholder', 'Additional historical notes...')}
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  padding: '6px 8px',
                  borderRadius: '0px',
                  fontSize: '13px',
                  resize: 'none'
                }}
              />
            </div>
          </>
        )}

        {/* ── Buttons ────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 14px',
              background: 'var(--accent-amber)',
              color: 'var(--bg-deep)',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '0px',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
