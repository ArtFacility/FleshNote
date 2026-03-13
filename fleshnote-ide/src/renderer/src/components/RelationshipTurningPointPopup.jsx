import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarDatePicker from './CalendarDatePicker'

const CharacterSelect = ({ characters, value, onChange, placeholder, disabled, t }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedChar = characters?.find(c => c.id.toString() === value?.toString())
  const filtered = characters?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input 
        type="text"
        disabled={disabled}
        placeholder={selectedChar ? selectedChar.name : placeholder}
        value={open ? search : (selectedChar ? selectedChar.name : '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onClick={() => { if(!disabled) { setOpen(true); setSearch(''); } }}
        style={{ 
          width: '100%', 
          backgroundColor: 'var(--bg-elevated)', 
          color: 'var(--text-primary)', 
          border: '1px solid var(--border-light)', 
          padding: '6px', 
          borderRadius: '4px',
          opacity: disabled ? 0.5 : 1
        }}
      />
      {open && !disabled && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-light)', 
          maxHeight: '150px', overflowY: 'auto', zIndex: 100, 
          borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' 
        }}>
          {filtered.map(c => (
            <div 
              key={c.id} 
              onClick={() => { onChange(c.id.toString()); setOpen(false); }}
              style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-deep)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {c.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {t('common.noMatches', 'No matches')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RelationshipTurningPointPopup({
  selectedText,
  wordOffset,
  chapterId,
  worldTime,
  position,
  projectPath,
  calConfig,
  onClose,
  onSuccess,
  existingRel
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  
  const initType = existingRel?.rel_type || 'friendship'
  const isDefaultType = ['friendship', 'love', 'hate', 'spite', 'guilt', 'trust', 'distrust'].includes(initType.toLowerCase())

  // Form fields
  const [characterId, setCharacterId] = useState(existingRel?.character_id?.toString() || '')
  const [targetCharacterId, setTargetCharacterId] = useState(existingRel?.target_character_id?.toString() || '')
  const [relType, setRelType] = useState(isDefaultType ? initType.toLowerCase() : 'other')
  const [customRelType, setCustomRelType] = useState(isDefaultType ? '' : initType)
  const [notes, setNotes] = useState(existingRel?.notes || '')
  const [isOneSided, setIsOneSided] = useState(existingRel ? existingRel.is_one_sided === 1 : true)
  const [currentWorldTime, setCurrentWorldTime] = useState(existingRel?.world_time || worldTime || '')

  // Data
  const [characters, setCharacters] = useState([])
  const [loadingChars, setLoadingChars] = useState(true)

  const defaultTypes = [
    { value: 'friendship', label: t('relType.friendship', 'Friendship') },
    { value: 'love', label: t('relType.love', 'Love') },
    { value: 'hate', label: t('relType.hate', 'Hate') },
    { value: 'spite', label: t('relType.spite', 'Spite') },
    { value: 'guilt', label: t('relType.guilt', 'Guilt') },
    { value: 'trust', label: t('relType.trust', 'Trust') },
    { value: 'distrust', label: t('relType.distrust', 'Distrust') },
    { value: 'other', label: t('relType.other', 'Other (Custom)') }
  ]

  useEffect(() => {
    const fetchChars = async () => {
      if (!projectPath) return
      try {
        const data = await window.api.getCharacters(projectPath)
        const fetchedChars = data.characters || []
        setCharacters(fetchedChars)

        // Predict characters based on selected text (only if not editing)
        if (selectedText && !existingRel) {
          const lowerText = selectedText.toLowerCase()
          const found = fetchedChars.filter(c => lowerText.includes(c.name.toLowerCase()))
          
          if (found.length >= 2) {
            setCharacterId(found[0].id.toString())
            setTargetCharacterId(found[1].id.toString())
          } else if (found.length === 1) {
            setCharacterId(found[0].id.toString())
          }
        }
      } catch (err) {
        console.error('Failed to fetch characters', err)
      } finally {
        setLoadingChars(false)
      }
    }
    fetchChars()
  }, [projectPath, selectedText])

  const handleSave = async () => {
    if (!characterId || !targetCharacterId) return
    if (characterId === targetCharacterId) return
    
    const finalRelType = relType === 'other' ? customRelType.trim() : relType
    if (!finalRelType) return

    setSaving(true)
    try {
      if (existingRel) {
        const resp = await window.api.updateRelationship({
          project_path: projectPath,
          relationship_id: existingRel.id,
          character_id: parseInt(characterId, 10),
          target_character_id: parseInt(targetCharacterId, 10),
          rel_type: finalRelType,
          notes: notes.trim(),
          chapter_id: existingRel.chapter_id,
          word_offset: existingRel.word_offset,
          world_time: currentWorldTime.trim() === '' ? null : currentWorldTime.trim(),
          is_one_sided: isOneSided ? 1 : 0
        })
        onSuccess?.(resp.relationship)
      } else {
        const resp = await window.api.createRelationship({
          project_path: projectPath,
          character_id: parseInt(characterId, 10),
          target_character_id: parseInt(targetCharacterId, 10),
          rel_type: finalRelType,
          notes: notes.trim(),
          chapter_id: chapterId,
          word_offset: wordOffset,
          world_time: currentWorldTime.trim() === '' ? null : currentWorldTime.trim(),
          is_one_sided: isOneSided ? 1 : 0
        })
        onSuccess?.(resp.relationship)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save relationship:', err)
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
  }

  const isFormValid = characterId && targetCharacterId && characterId !== targetCharacterId && (relType !== 'other' || customRelType.trim())

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 380),
          top: Math.min(position.y, window.innerHeight - 450),
          width: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px'
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="popup-header">
          <span style={{ color: 'var(--accent-amber)' }}>
            {existingRel ? t('popup.editRelTitle', 'Edit Relationship') : t('popup.createRelTitle', 'Relationship Turning Point')}
          </span>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        
        {selectedText && (
          <div className="popup-subtitle" style={{ fontStyle: 'italic', marginBottom: '8px' }}>
            "{selectedText.length > 50 ? selectedText.substring(0, 50) + '...' : selectedText}"
          </div>
        )}

        {loadingChars ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('common.loading', 'Loading...')}</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CharacterSelect 
                characters={characters} 
                value={characterId} 
                onChange={setCharacterId} 
                placeholder={t('relPopup.selectChar', 'Select Character...')} 
                t={t}
              />
              <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span>
              <CharacterSelect 
                characters={characters} 
                value={targetCharacterId} 
                onChange={setTargetCharacterId} 
                placeholder={t('relPopup.selectTarget', 'Select Target...')} 
                t={t}
              />
            </div>
            
            {(characterId && targetCharacterId && characterId === targetCharacterId) && (
              <div style={{ color: 'var(--accent-danger)', fontSize: '12px' }}>
                {t('relPopup.sameCharError', 'Characters must be different.')}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '60px' }}>{t('relPopup.type', 'Type')}</label>
              <select 
                value={relType} 
                onChange={e => setRelType(e.target.value)}
                style={{ flex: 1, backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '6px', borderRadius: '4px' }}
              >
                {defaultTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {relType === 'other' && (
              <div style={{ paddingLeft: '68px' }}>
                <input 
                  type="text" 
                  value={customRelType} 
                  onChange={e => setCustomRelType(e.target.value)} 
                  placeholder={t('relPopup.customTypePlaceholder', 'e.g. Rivalry')}
                  style={{ width: '100%', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '6px', borderRadius: '4px' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '60px' }}>{t('relPopup.worldTimeLabel', 'Time')}</label>
              <CalendarDatePicker
                value={currentWorldTime}
                onChange={setCurrentWorldTime}
                calConfig={calConfig}
                projectPath={projectPath}
                placeholder={t('relPopup.worldTimePlaceholder', 'e.g. 1999, Year 40, etc (Optional)')}
                style={{ flex: 1 }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isOneSided} 
                onChange={e => setIsOneSided(e.target.checked)} 
                style={{ accentColor: 'var(--accent-amber)' }}
              />
              {t('relPopup.oneSided', 'One-sided Relationship')}
            </label>

            <textarea
              className="popup-textarea"
              style={{
                width: '100%',
                height: '80px',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                padding: '10px',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                borderRadius: '4px',
                resize: 'none'
              }}
              placeholder={t('relPopup.notesPlaceholder', 'Additional notes... (Ctrl+Enter to save)')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
            />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              marginInlineEnd: '8px'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isFormValid}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-amber)',
              color: 'var(--bg-deep)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '4px',
              opacity: isFormValid ? 1 : 0.5
            }}
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
