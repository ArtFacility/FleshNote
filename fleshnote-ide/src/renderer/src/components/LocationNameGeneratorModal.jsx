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
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Wand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
      <path d="M17.8 11.8L19 13" /><path d="M15 9h.01" /><path d="M17.8 6.2L19 5" />
      <path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
    </svg>
  )
}

export default function LocationNameGeneratorModal({
  projectPath,
  projectConfig,
  onClose,
  onConfirm
}) {
  const { t } = useTranslation()

  const defaultSettings = {
    genre: 'fantasy',
    geography: '',
    history: '',
    founder: '',
    native_tongue: '',
    mythos: '',
    drift: 30,
    site_type: 'planet',
    importance: 'medium',
    vowel_harmony: false,
    saveAsDescription: true
  }

  const [settings, setSettings] = useState(defaultSettings)
  const [generatedNames, setGeneratedNames] = useState([])
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const configPayload = {
        genre: settings.genre,
        geography: settings.geography,
        history: settings.history,
        founder: settings.founder,
        native_tongue: settings.native_tongue,
        mythos: settings.mythos,
        drift: parseInt(settings.drift, 10) || 0,
        site_type: settings.site_type,
        importance: settings.importance,
        vowel_harmony: settings.vowel_harmony,
        language: projectConfig?.story_language || 'en'
      }

      const res = await window.api.generateLocationName({
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
  }, [settings, projectPath, projectConfig])

  const handleSelect = (name) => {
    let autoDesc = ""
    if (settings.saveAsDescription) {
      const parts = []
      if (settings.geography) parts.push(t('locgen.desc.geography', { val: settings.geography.trim() }))
      if (settings.history) parts.push(t('locgen.desc.history', { val: settings.history.trim() }))
      if (settings.founder) parts.push(t('locgen.desc.founder', { val: settings.founder.trim() }))
      if (settings.genre === 'fantasy' && settings.native_tongue) parts.push(t('locgen.desc.native', { val: settings.native_tongue.trim() }))
      if (settings.genre === 'scifi' && settings.mythos) parts.push(t('locgen.desc.mythos', { val: settings.mythos.trim() }))

      autoDesc = parts.join(". ")
      if (autoDesc) autoDesc += "."
    }

    // Pass back both name and the compiled description
    onConfirm({ name, description: autoDesc })
  }

  const updateSetting = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="popup-panel"
        style={{ width: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="popup-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.Wand /> {t('locgen.title')}
          </span>
          <button className="entity-edit-toggle" onClick={onClose} style={{ alignSelf: 'flex-start' }}><Icons.X /></button>
        </div>

        <div className="inspector-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '16px 20px 0', gap: '16px' }}>
          <button
            onClick={() => updateSetting('genre', 'fantasy')}
            style={{
              background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
              color: settings.genre === 'fantasy' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              borderBottom: settings.genre === 'fantasy' ? '2px solid var(--accent-amber)' : '2px solid transparent',
              fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px'
            }}
          >
            {t('locgen.fantasy')}
          </button>
          <button
            onClick={() => updateSetting('genre', 'scifi')}
            style={{
              background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
              color: settings.genre === 'scifi' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              borderBottom: settings.genre === 'scifi' ? '2px solid var(--accent-amber)' : '2px solid transparent',
              fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px'
            }}
          >
            {t('locgen.scifi')}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '-8px' }}>
            {t('locgen.hint')}
          </div>

          <div className="entity-edit-field">
            <label className="entity-edit-label">{t('locgen.geography_label')}</label>
            <input type="text" className="entity-edit-input" value={settings.geography} onChange={e => updateSetting('geography', e.target.value)} />
          </div>

          <div className="entity-edit-field">
            <label className="entity-edit-label">{t('locgen.history_label')}</label>
            <input type="text" className="entity-edit-input" value={settings.history} onChange={e => updateSetting('history', e.target.value)} />
          </div>

          <div className="entity-edit-field">
            <label className="entity-edit-label">{t('locgen.founder_label')}</label>
            <input type="text" className="entity-edit-input" value={settings.founder} onChange={e => updateSetting('founder', e.target.value)} />
          </div>

          {settings.genre === 'fantasy' && (
            <div className="entity-edit-field">
              <label className="entity-edit-label">{t('locgen.native_label')}</label>
              <input type="text" className="entity-edit-input" value={settings.native_tongue} onChange={e => updateSetting('native_tongue', e.target.value)} />
            </div>
          )}

          {settings.genre === 'scifi' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="entity-edit-field">
                  <label className="entity-edit-label">{t('locgen.site_type')}</label>
                  <select
                    className="entity-edit-input"
                    value={settings.site_type}
                    onChange={e => updateSetting('site_type', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-elevated)', cursor: 'pointer' }}
                  >
                    <option value="planet">{t('locgen.planet')}</option>
                    <option value="colony">{t('locgen.colony')}</option>
                    <option value="facility">{t('locgen.facility')}</option>
                    <option value="system">{t('locgen.system')}</option>
                  </select>
                </div>
                <div className="entity-edit-field">
                  <label className="entity-edit-label">{t('locgen.importance')}</label>
                  <select
                    className="entity-edit-input"
                    value={settings.importance}
                    onChange={e => updateSetting('importance', e.target.value)}
                    style={{ backgroundColor: 'var(--bg-elevated)', cursor: 'pointer' }}
                  >
                    <option value="high">{t('locgen.importance_high')}</option>
                    <option value="medium">{t('locgen.importance_medium')}</option>
                    <option value="low">{t('locgen.importance_low')}</option>
                  </select>
                </div>
              </div>

              <div className="entity-edit-field">
                <label className="entity-edit-label">{t('locgen.mythos_label')}</label>
                <input type="text" className="entity-edit-input" value={settings.mythos} onChange={e => updateSetting('mythos', e.target.value)} />
              </div>
            </>
          )}

          <div className="entity-edit-field" style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
              <span>{t('locgen.drift_literal')}</span>
              <span>{t('locgen.drift_label', { drift: settings.drift })}</span>
              <span>{t('locgen.drift_corrupted')}</span>
            </div>
            <input
              type="range"
              min="0" max="100"
              value={settings.drift}
              onChange={e => updateSetting('drift', e.target.value)}
              style={{ width: '100%', margin: '8px 0', accentColor: 'var(--accent-amber)' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {t('locgen.drift_hint')}
            </div>
          </div>

          <div className="entity-edit-field" style={{ marginTop: '0px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.vowel_harmony} onChange={(e) => updateSetting('vowel_harmony', e.target.checked)} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('namegen.vowel_harmony')}</span>
            </label>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '24px' }}>
              {t('namegen.vowel_harmony_hint')}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '12px -20px 0', padding: '16px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('locgen.generated_names')}</span>
              <button className="entity-edit-btn" onClick={generate} disabled={generating} style={{ height: '28px', padding: '0 12px' }}>
                <Icons.Refresh /> {generating ? t('locgen.rolling') : t('locgen.generate')}
              </button>
            </div>

            <label className="checkbox-label" style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.saveAsDescription} onChange={(e) => updateSetting('saveAsDescription', e.target.checked)} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('locgen.save_as_description')}</span>
            </label>

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
                    border: '1px solid var(--border-subtle)'
                  }}
                  onClick={() => handleSelect(name)}
                >
                  {name}
                </button>
              ))}
              {generatedNames.length === 0 && !generating && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
                  {t('locgen.click_generate_hint')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
