import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function EntityRenamePopup({
  projectPath,
  entity,
  oldName,
  newName,
  onClose,
  onSuccess
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [replacements, setReplacements] = useState({})
  const [saving, setSaving] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState(null)

  useEffect(() => {
    let isMounted = true

    const scan = async () => {
      try {
        const res = await window.api.scanEntityReferences({
          project_path: projectPath,
          entity_type: entity.type,
          entity_id: entity.id,
          old_name: oldName,
          new_name: newName
        })
        if (!isMounted) return

        // If no matches at all, just close
        if (res.exactMatches.count === 0 && res.uniqueMatches.length === 0) {
          onSuccess(false)
          return
        }

        setData(res)
        
        // Pre-fill replacements
        const initialMap = {}
        if (res.exactMatches.count > 0) {
          initialMap[res.exactMatches.linkedString] = {
            new_text: res.exactMatches.autoReplaceWith,
            add_alias: false,
            do_replace: true 
          }
        }
        
        res.uniqueMatches.forEach(match => {
          initialMap[match.linkedString] = {
            new_text: match.suggestedText,
            add_alias: false,
            do_replace: false // by default the user must review them
          }
        })

        setReplacements(initialMap)
        setLoading(false)
      } catch (err) {
        console.error('Failed to scan references:', err)
        if (isMounted) {
          setLoading(false)
          onClose() // abort on error
        }
      }
    }

    scan()

    return () => { isMounted = false }
  }, [projectPath, entity, oldName, newName])

  const handleUpdateReplacement = (originalText, field, value) => {
    setReplacements(prev => ({
      ...prev,
      [originalText]: {
        ...prev[originalText],
        [field]: value
      }
    }))
  }

  const handleAcceptSuggestion = (originalText) => {
    handleUpdateReplacement(originalText, 'do_replace', true)
    if (expandedIndex === originalText) {
      setExpandedIndex(null)
    }
  }

  const handleApply = async () => {
    setSaving(true)
    try {
      const payloadMap = {}
      for (const [key, val] of Object.entries(replacements)) {
        if (val.do_replace) {
          payloadMap[key] = {
            new_text: val.new_text,
            add_alias: val.add_alias
          }
        }
      }

      let replaced = false
      if (Object.keys(payloadMap).length > 0) {
        await window.api.replaceEntityReferences({
          project_path: projectPath,
          entity_type: entity.type,
          entity_id: entity.id,
          replacements: payloadMap
        })
        replaced = true
      }
      onSuccess(replaced)
    } catch (err) {
      console.error('Failed to replace references:', err)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="popup-overlay">
        <div className="popup-panel" style={{ width: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            {t('editor.scanningReferences', 'Scanning manuscript for linked references...')}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div 
        className="popup-panel" 
        style={{ width: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="popup-header">
          <span>{t('editor.updateReferencesTitle', 'Update Linked References?')}</span>
        </div>
        
        <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '12px' }}>
          {t('editor.updateReferencesWarning', 'You renamed "{{old}}" to "{{new}}". We found multiple linked references in your manuscript. Do you want to update the text across your project?', { old: oldName, new: newName })}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {data.exactMatches.count > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {t('editor.exactMatches', 'Exact Matches')} ({data.exactMatches.count})
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through' }}>{data.exactMatches.linkedString}</span>
                    <span style={{ color: 'var(--text-secondary)', margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--accent-green)' }}>{data.exactMatches.autoReplaceWith}</span>
                  </div>
                </div>
                <label className="checkbox-label" style={{ margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={replacements[data.exactMatches.linkedString]?.do_replace || false}
                    onChange={(e) => handleUpdateReplacement(data.exactMatches.linkedString, 'do_replace', e.target.checked)}
                  />
                  <span>{t('editor.update', 'Update')}</span>
                </label>
              </div>
            </div>
          )}

          {data.uniqueMatches.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {t('editor.uniqueMatches', 'Unique Matches')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.uniqueMatches.map((match, idx) => {
                  const state = replacements[match.linkedString]
                  const isExpanded = expandedIndex === match.linkedString

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        background: 'var(--bg-elevated)', 
                        border: `1px solid ${state?.do_replace ? 'var(--accent-green)' : 'var(--border-color)'}`, 
                        borderRadius: '6px', 
                        overflow: 'hidden' 
                      }}
                    >
                      <div 
                        style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedIndex(isExpanded ? null : match.linkedString)}
                      >
                        <div style={{ flex: 1, marginRight: '12px', overflow: 'hidden' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>({match.count})&nbsp;&nbsp;</span>
                             <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.linkedString}</span>
                             <span style={{ color: 'var(--text-secondary)' }}>→</span>
                             <span style={{ color: 'var(--accent-green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state?.new_text}</span>
                           </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          {!state?.do_replace ? (
                            <button 
                              className="entity-edit-btn" 
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => handleAcceptSuggestion(match.linkedString)}
                            >
                              {t('editor.accept', 'Accept')}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--accent-green)', fontSize: '12px', fontWeight: 600, padding: '4px 12px' }}>
                              ✓ {t('editor.accepted', 'Accepted')}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }} onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                            {t('editor.originalText', 'Original Text:')} <span style={{ color: 'var(--text-primary)' }}>{match.linkedString}</span>
                          </div>
                          <div className="entity-edit-field">
                            <label className="entity-edit-label">{t('editor.replaceWith', 'Replace with')}</label>
                            <input 
                              type="text" 
                              className="entity-edit-input" 
                              value={state?.new_text || ''}
                              onChange={(e) => handleUpdateReplacement(match.linkedString, 'new_text', e.target.value)}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <label className="checkbox-label" style={{ margin: 0 }}>
                              <input 
                                type="checkbox" 
                                checked={state?.add_alias || false}
                                onChange={(e) => handleUpdateReplacement(match.linkedString, 'add_alias', e.target.checked)}
                              />
                              <span>{t('editor.addAsAlias', 'Add as Alias')}</span>
                            </label>

                            <button 
                              className="entity-edit-btn save"
                              onClick={() => handleAcceptSuggestion(match.linkedString)}
                            >
                              {t('editor.saveAndAccept', 'Save & Accept')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="entity-edit-btn" onClick={onClose} disabled={saving}>
            {t('editor.skipRename', 'Skip & Finish')}
          </button>
          <button
            className="entity-edit-btn save"
            onClick={handleApply}
            disabled={saving}
          >
            {saving ? t('editor.saving', 'Saving...') : t('editor.applyReplacements', 'Apply Replacements')}
          </button>
        </div>
      </div>
    </div>
  )
}
