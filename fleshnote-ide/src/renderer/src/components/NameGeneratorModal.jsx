import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
}

export default function NameGeneratorModal({
  projectPath,
  projectConfig,
  onClose,
  onConfirm
}) {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [origins, setOrigins] = useState([])
  const [presets, setPresets] = useState([])

  const defaultSettings = {
    mode: 'procedural',
    real_origin: 'english',
    real_gender: 'any',
    real_flip_surname: false,
    preset_name: '',
    procedural: {
      no_hard_consonants: false,
      max_consecutive_consonants: 2,
      vowel_harmony: 'none',
      allow_special_vowels: false,
      use_force_contains: false,
      force_starts_with: '',
      force_ends_with: '',
      max_length: 10
    }
  }

  const [settings, setSettings] = useState(projectConfig?.name_gen_settings || defaultSettings)
  const [generatedNames, setGeneratedNames] = useState([])
  const [generating, setGenerating] = useState(false)

  // Fetch dropdowns
  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const [oRes, pRes] = await Promise.all([
          window.api.getNameGenOrigins({ project_path: projectPath }),
          window.api.getNameGenPresets({ project_path: projectPath })
        ])
        if (isMounted) {
          setOrigins(oRes.origins || [])
          setPresets(pRes.presets || [])
          
          if (!settings.preset_name && pRes.presets?.length > 0) {
              setSettings(s => ({ ...s, preset_name: pRes.presets[0] }))
          }
        }
      } catch (e) {
        console.error('Failed to load namegen data', e)
      }
    }
    fetchData()
    return () => { isMounted = false }
  }, [projectPath]) // removed settings.preset_name as dependency to avoid loop

  // Autosave settings
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      window.api.updateProjectConfig(projectPath, 'name_gen_settings', settings, 'json')
    }, 1000)
    return () => clearTimeout(saveTimer)
  }, [settings, projectPath])

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const configPayload = {
        mode: settings.mode
      }
      
      if (settings.mode === 'real') {
        configPayload.real_origin = settings.real_origin
        configPayload.real_gender = settings.real_gender
        configPayload.real_flip_surname = settings.real_flip_surname
      } else if (settings.mode === 'preset') {
        configPayload.preset_name = settings.preset_name
        // Merge some procedural overrides possible for presets
        configPayload.no_hard_consonants = settings.procedural.no_hard_consonants
        configPayload.max_consecutive_consonants = settings.procedural.max_consecutive_consonants
      } else {
        configPayload.no_hard_consonants = settings.procedural.no_hard_consonants
        configPayload.max_consecutive_consonants = settings.procedural.max_consecutive_consonants
        configPayload.vowel_harmony = settings.procedural.vowel_harmony
        configPayload.allow_special_vowels = settings.procedural.allow_special_vowels
        configPayload.max_length = settings.procedural.max_length
        if (settings.procedural.use_force_contains) {
          if (settings.procedural.force_starts_with) configPayload.force_starts_with = settings.procedural.force_starts_with
          if (settings.procedural.force_ends_with) configPayload.force_ends_with = settings.procedural.force_ends_with
        }
      }

      const res = await window.api.generateName({
        project_path: projectPath,
        config: configPayload,
        count: 5
      })
      setGeneratedNames(res.names || [])
    } catch (e) {
      console.error('Generation failed', e)
    } finally {
      setGenerating(false)
    }
  }, [settings, projectPath])

  // Initial generation
  useEffect(() => {
    // Only auto-generate if we haven't yet and formats are somewhat loaded
    if (generatedNames.length === 0 && !generating) {
      generate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once

  const updateSetting = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  const updateProcedural = (key, val) => {
    setSettings(prev => ({
      ...prev,
      procedural: { ...prev.procedural, [key]: val }
    }))
  }

  const handleIntInput = (key, rawValue, defaultVal) => {
    const numericRegex = /^[0-9]*$/;
    if (!numericRegex.test(rawValue)) return; 
    let num = parseInt(rawValue, 10);
    if (isNaN(num)) num = '';
    updateProcedural(key, num);
  }

  const handleIntBlur = (key, rawValue, defaultVal, min, max) => {
    let num = parseInt(rawValue, 10);
    if (isNaN(num) || num < min || num > max) num = defaultVal;
    updateProcedural(key, num);
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="popup-panel" 
        style={{ width: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="popup-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{t('namegen.title', 'Name Generator')}</span>
          <button className="entity-edit-toggle" onClick={onClose} style={{ alignSelf: 'flex-start' }}><Icons.X /></button>
        </div>

        <div className="inspector-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '16px 20px 0', gap: '16px' }}>
          {['real', 'preset', 'procedural'].map(tab => (
            <button 
              key={tab}
              onClick={() => updateSetting('mode', tab)} 
              style={{ 
                background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer', 
                color: settings.mode === tab ? 'var(--accent-amber)' : 'var(--text-secondary)', 
                borderBottom: settings.mode === tab ? '2px solid var(--accent-amber)' : '2px solid transparent', 
                fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' 
              }}
            >
              {t(`namegen.tab_${tab}`, tab.replace('_', ' '))}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {settings.mode === 'real' && (
            <>
              <div className="entity-edit-field">
                <label className="entity-edit-label">{t('namegen.origin', 'Origin Nation')}</label>
                <select className="entity-edit-input" value={settings.real_origin} onChange={e => updateSetting('real_origin', e.target.value)}>
                  {origins.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
              <div className="entity-edit-field">
                <label className="entity-edit-label">{t('namegen.gender', 'Gender')}</label>
                <select className="entity-edit-input" value={settings.real_gender} onChange={e => updateSetting('real_gender', e.target.value)}>
                  <option value="any">{t('namegen.gender_any', 'Any')}</option>
                  <option value="male">{t('namegen.gender_male', 'Male')}</option>
                  <option value="female">{t('namegen.gender_female', 'Female')}</option>
                </select>
              </div>
              <label className="checkbox-label" style={{ margin: 0, marginTop: '8px' }}>
                <input type="checkbox" checked={settings.real_flip_surname} onChange={(e) => updateSetting('real_flip_surname', e.target.checked)} />
                <span>{t('namegen.flip_surname', 'Flip surname to be first (e.g. for Japanese/Hungarian)')}</span>
              </label>
            </>
          )}

          {settings.mode === 'preset' && (
            <>
              <div className="entity-edit-field">
                <label className="entity-edit-label">{t('namegen.preset', 'Preset Archetype')}</label>
                <select className="entity-edit-input" value={settings.preset_name} onChange={e => updateSetting('preset_name', e.target.value)}>
                  {presets.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <label className="checkbox-label" style={{ margin: 0 }}>
                <input type="checkbox" checked={settings.procedural.no_hard_consonants} onChange={(e) => updateProcedural('no_hard_consonants', e.target.checked)} />
                <span>{t('namegen.no_hard_consonants', 'Softer sounds (no hard consonants)')}</span>
              </label>
            </>
          )}

          {settings.mode === 'procedural' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="entity-edit-field">
                  <label className="entity-edit-label">{t('namegen.max_consonants', 'Max Consecutive Consonants')}</label>
                  <input type="text" className="entity-edit-input" value={settings.procedural.max_consecutive_consonants} onChange={e => handleIntInput('max_consecutive_consonants', e.target.value, 2)} onBlur={e => handleIntBlur('max_consecutive_consonants', e.target.value, 2, 1, 4)} />
                </div>
                <div className="entity-edit-field">
                  <label className="entity-edit-label">{t('namegen.max_length', 'Max Length')}</label>
                  <input type="text" className="entity-edit-input" value={settings.procedural.max_length} onChange={e => handleIntInput('max_length', e.target.value, 10)} onBlur={e => handleIntBlur('max_length', e.target.value, 10, 4, 25)} />
                </div>
              </div>

              <div className="entity-edit-field">
                <label className="entity-edit-label">{t('namegen.vowel_harmony', 'Vowel Harmony')}</label>
                <select className="entity-edit-input" value={settings.procedural.vowel_harmony} onChange={e => updateProcedural('vowel_harmony', e.target.value)}>
                  <option value="none">{t('namegen.harmony_none', 'None')}</option>
                  <option value="front">{t('namegen.harmony_front', 'Front (e, i, ö, ü)')}</option>
                  <option value="back">{t('namegen.harmony_back', 'Back (a, o, u)')}</option>
                </select>
              </div>

              <label className="checkbox-label" style={{ margin: 0 }}>
                <input type="checkbox" checked={settings.procedural.no_hard_consonants} onChange={(e) => updateProcedural('no_hard_consonants', e.target.checked)} />
                <span>{t('namegen.no_hard_consonants', 'Softer sounds (no hard consonants)')}</span>
              </label>
              
              <label className="checkbox-label" style={{ margin: 0 }}>
                <input type="checkbox" checked={settings.procedural.allow_special_vowels} onChange={(e) => updateProcedural('allow_special_vowels', e.target.checked)} />
                <span>{t('namegen.special_vowels', 'Allow Accented Vowels (á, é, etc)')}</span>
              </label>

              <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <label className="checkbox-label" style={{ margin: 0, marginBottom: settings.procedural.use_force_contains ? '12px' : 0 }}>
                  <input type="checkbox" checked={settings.procedural.use_force_contains} onChange={(e) => updateProcedural('use_force_contains', e.target.checked)} />
                  <span style={{ fontWeight: 600 }}>{t('namegen.force_contain', 'Force Contains...')}</span>
                </label>

                {settings.procedural.use_force_contains && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="entity-edit-field">
                      <label className="entity-edit-label">{t('namegen.starts_with', 'Starts With')}</label>
                      <input type="text" className="entity-edit-input" placeholder="e.g. Ar" value={settings.procedural.force_starts_with} onChange={e => updateProcedural('force_starts_with', e.target.value)} />
                    </div>
                    <div className="entity-edit-field">
                      <label className="entity-edit-label">{t('namegen.ends_with', 'Ends With')}</label>
                      <input type="text" className="entity-edit-input" placeholder="e.g. on" value={settings.procedural.force_ends_with} onChange={e => updateProcedural('force_ends_with', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px -20px 0', padding: '16px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('namegen.results', 'Generated Names')}</span>
              <button className="entity-edit-btn" onClick={generate} disabled={generating} style={{ height: '28px', padding: '0 12px' }}>
                <Icons.Refresh /> {generating ? t('namegen.rolling', 'Rolling...') : t('namegen.reroll', 'Reroll')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {generatedNames.map((name, i) => (
                <button
                  key={i}
                  className="entity-edit-btn"
                  style={{
                    justifyContent: 'flex-start',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)'
                  }}
                  onClick={() => onConfirm(name)}
                >
                  {name}
                </button>
              ))}
              {generatedNames.length === 0 && !generating && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
                  {t('namegen.no_results', 'Click reroll to generate names...')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
