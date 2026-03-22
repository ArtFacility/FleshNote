import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const SupportBadge = ({ level }) => {
    if (level === 'full')    return <span title="Full support"    style={{ color: '#4ade80', fontSize: 14 }}>●</span>;
    if (level === 'partial') return <span title="Partial support" style={{ color: '#fbbf24', fontSize: 14 }}>◐</span>;
    if (level === 'none')    return <span title="Not supported"   style={{ color: '#6b7280', fontSize: 14 }}>○</span>;
    if (level === 'soon')    return <span title="Coming soon"     style={{ color: '#60a5fa', fontSize: 14 }}>◌</span>;
    return null;
};

const NLP_FEATURE_MATRIX = [
    { key: 'humanUi',      label: 'Human-translated UI',          en: 'full',    hu: 'full',    pl: 'partial', ar: 'none'    },
    { key: 'ner',          label: 'Entity name recognition (NER)',  en: 'full',    hu: 'full',    pl: 'partial', ar: 'partial' },
    { key: 'sensory',      label: 'Sensory check',                  en: 'full',    hu: 'full',    pl: 'none',    ar: 'none'    },
    { key: 'typo',         label: 'Typo check',                     en: 'full',    hu: 'full',    pl: 'full',    ar: 'full'    },
    { key: 'synonym',      label: 'Synonym suggestion',             en: 'full',    hu: 'full',    pl: 'full',    ar: 'partial' },
    { key: 'flesch',       label: 'Flesch-Kincaid readability',     en: 'full',    hu: 'partial', pl: 'partial', ar: 'partial' },
    { key: 'passive',      label: 'Janitor: Passive voice check',   en: 'full',    hu: 'full',    pl: 'none',    ar: 'none'    },
    { key: 'showDontTell', label: "Janitor: Show don't tell check", en: 'full',    hu: 'full',    pl: 'none',    ar: 'none'    },
    { key: 'voiceConsist', label: 'Character voice consistency',   en: 'soon',    hu: 'soon',    pl: 'soon',    ar: 'soon'    },
];

const EditableHotkeyRow = ({ hotkeyKey, action, hotkeys, editingHotkey, pendingKey, setEditingHotkey, setPendingKey, onSave }) => (
    <tr>
        <td style={{ paddingBottom: 8, paddingRight: 16, whiteSpace: 'nowrap' }}>
            {editingHotkey === hotkeyKey ? (
                <input
                    autoFocus
                    value={pendingKey}
                    placeholder="Press keys…"
                    style={{ width: 110, fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', border: '1px solid var(--accent-amber)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)', outline: 'none' }}
                    onKeyDown={e => {
                        e.preventDefault()
                        const parts = []
                        if (e.ctrlKey) parts.push('Ctrl')
                        if (e.altKey) parts.push('Alt')
                        if (e.shiftKey) parts.push('Shift')
                        if (e.key && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
                        if (parts.length) setPendingKey(parts.join('+'))
                    }}
                    onBlur={() => {
                        const val = pendingKey || hotkeys[hotkeyKey]
                        onSave(hotkeyKey, val)
                        setEditingHotkey(null)
                        setPendingKey('')
                    }}
                    onChange={() => {}}
                />
            ) : (
                <span
                    title="Click to change"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setEditingHotkey(hotkeyKey); setPendingKey(hotkeys[hotkeyKey] || '') }}
                >
                    {(hotkeys[hotkeyKey] || '?').split('+').map((k, i) => (
                        <span key={i}>
                            {i > 0 && <span style={{ margin: '0 2px', opacity: 0.5 }}>+</span>}
                            <kbd className="hotkey-kbd" style={{ borderColor: 'var(--accent-amber)' }}>{k}</kbd>
                        </span>
                    ))}
                </span>
            )}
        </td>
        <td style={{ paddingBottom: 8, color: 'inherit' }}>{action}</td>
    </tr>
)

const HotkeyRow = ({ keys, action, configurable }) => (
    <tr>
        <td style={{ paddingBottom: 8, paddingRight: 16, whiteSpace: 'nowrap' }}>
            {keys.map((k, i) => (
                <span key={i}>
                    {i > 0 && <span style={{ margin: '0 2px', opacity: 0.5 }}>+</span>}
                    <kbd className="hotkey-kbd">{k}</kbd>
                </span>
            ))}
        </td>
        <td style={{ paddingBottom: 8, color: 'inherit' }}>
            {action}
            {configurable && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 6 }}>(configurable)</span>}
        </td>
    </tr>
);

export default function ProjectSettingsModal({ isOpen, onClose, projectPath, onConfigUpdate }) {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language?.slice(0, 2) || 'en'
    const [activeTab, setActiveTab] = useState('general')
    const [config, setConfig] = useState(null)
    const [loading, setLoading] = useState(true)

    // NLP Model states
    const [modelExists, setModelExists] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [nlpModelStatus, setNlpModelStatus] = useState({ en: null, hu: null, pl: null, ar: null })
    const [hotkeys, setHotkeys] = useState({
        synonym_lookup: 'Alt+S', search: 'Ctrl+F',
        todo_marker: 'Alt+T', entity_palette: 'Alt+E',
        quick_note_popup: 'Alt+Q', focus_normal: 'Alt+F',
        janitor_open: 'Alt+J', janitor_accept: 'Y', janitor_dismiss: 'N'
    })
    const [editingHotkey, setEditingHotkey] = useState(null)
    const [pendingKey, setPendingKey] = useState('')

    // Load config when opened
    useEffect(() => {
        if (isOpen && projectPath) {
            setLoading(true)
            window.api?.getProjectConfig?.(projectPath)
                .then(res => {
                    setConfig(res.config || {})
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Failed to load project config", err)
                    setLoading(false)
                })
        }
    }, [isOpen, projectPath])

    // Check NLP model existence when language changes
    useEffect(() => {
        if (config?.story_language && isOpen) {
            window.api?.checkNlpModel?.(config.story_language)
                .then(res => setModelExists(res?.exists || false))
                .catch(err => console.error("Could not check NLP model status", err))
        }
    }, [config?.story_language, isOpen])

    // Load hotkeys from global config when hotkeys tab is active
    useEffect(() => {
        if (activeTab === 'hotkeys' && isOpen) {
            window.api?.getGlobalConfig?.()
                .then(cfg => {
                    if (cfg?.hotkeys) setHotkeys({
                        synonym_lookup: 'Alt+S', search: 'Ctrl+F',
                        todo_marker: 'Alt+T', entity_palette: 'Alt+E',
                        quick_note_popup: 'Alt+Q', focus_normal: 'Alt+F',
                        janitor_open: 'Alt+J', janitor_accept: 'Y', janitor_dismiss: 'N',
                        ...cfg.hotkeys
                    })
                })
                .catch(() => {})
        }
    }, [activeTab, isOpen])

    // Check all language models when NLP tab is active
    useEffect(() => {
        if (activeTab === 'nlp' && isOpen) {
            ;['en', 'hu', 'pl', 'ar'].forEach(lang => {
                window.api?.checkNlpModel?.(lang)
                    .then(res => setNlpModelStatus(prev => ({ ...prev, [lang]: res?.exists || false })))
                    .catch(() => setNlpModelStatus(prev => ({ ...prev, [lang]: false })))
            })
        }
    }, [activeTab, isOpen])

    // Listen for model download progress
    useEffect(() => {
        const unsub = window.api?.onDownloadProgress?.((progress) => {
            setDownloadProgress(progress)
            if (progress === 100) {
                setTimeout(() => {
                    setIsDownloading(false)
                    setModelExists(true)
                }, 500)
            }
        })
        return () => {
            if (unsub) unsub()
        }
    }, [])

    if (!isOpen) return null

    const handleDownloadModel = async () => {
        setIsDownloading(true)
        setDownloadProgress(0)
        try {
            await window.api?.loadNlpModel?.(config.story_language)
            // Progress listener will handle completion state
        } catch (err) {
            console.error("Failed to download model", err)
            setIsDownloading(false)
        }
    }

    const handleUpdate = async (key, value, type) => {
        // Optimistic UI update
        setConfig(prev => ({ ...prev, [key]: value }))
        try {
            await window.api?.updateProjectConfig?.(projectPath, key, value, type)
            // Notify parent about the update
            onConfigUpdate?.({ ...config, [key]: value })
        } catch (err) {
            console.error("Failed to update project config", err)
        }
    }

    // Helper for boolean toggles
    const handleToggle = (key) => {
        handleUpdate(key, !config[key], 'toggle')
    }

    // Helper for text inputs
    const handleTextChange = (key, e, type = 'meta') => {
        handleUpdate(key, e.target.value, type)
    }

    if (loading) {
        return (
            <div className="settings-modal-overlay">
                <div className="settings-modal flex-col justify-center items-center">
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    if (!config) {
        return null // this should never happen now, but safe fallback
    }

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal">
                <div className="settings-header">
                    <h2>{t('settings.title', 'Project Settings')}</h2>
                    <button className="settings-close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="settings-body">
                    <div className="settings-sidebar">
                        <button
                            className={activeTab === 'general' ? 'active' : ''}
                            onClick={() => setActiveTab('general')}
                        >
                            {t('settings.tabGeneral', 'General')}
                        </button>
                        <button
                            className={activeTab === 'worldbuilding' ? 'active' : ''}
                            onClick={() => setActiveTab('worldbuilding')}
                        >
                            {t('settings.tabWorldbuilding', 'Worldbuilding')}
                        </button>
                        <button
                            className={activeTab === 'advanced' ? 'active' : ''}
                            onClick={() => setActiveTab('advanced')}
                        >
                            {t('settings.tabAdvanced', 'Advanced')}
                        </button>
                        <button
                            className={activeTab === 'nlp' ? 'active' : ''}
                            onClick={() => setActiveTab('nlp')}
                        >
                            {t('settings.tabNlp', 'NLP & Analysis')}
                        </button>
                        <button
                            className={activeTab === 'accessibility' ? 'active' : ''}
                            onClick={() => setActiveTab('accessibility')}
                        >
                            {t('settings.tabAccessibility', 'Accessibility')}
                        </button>
                        <button
                            className={activeTab === 'janitor' ? 'active' : ''}
                            onClick={() => setActiveTab('janitor')}
                        >
                            {t('settings.tabJanitor', 'The Janitor')}
                        </button>
                        <button
                            className={activeTab === 'hotkeys' ? 'active' : ''}
                            onClick={() => setActiveTab('hotkeys')}
                        >
                            {t('settings.tabHotkeys', 'Hotkeys')}
                        </button>
                    </div>

                    <div className="settings-content">
                        {activeTab === 'general' && (
                            <div className="settings-section">
                                <h3>{t('settings.generalInfo', 'Basic Information')}</h3>
                                <div className="settings-field">
                                    <label>{t('settings.projectName', 'Project Name')}</label>
                                    <input
                                        type="text"
                                        value={config.project_name || ''}
                                        onChange={(e) => handleTextChange('project_name', e)}
                                    />
                                </div>
                                <div className="settings-field">
                                    <label>{t('settings.authorName', 'Author Name')}</label>
                                    <input
                                        type="text"
                                        value={config.author_name || ''}
                                        onChange={(e) => handleTextChange('author_name', e)}
                                    />
                                </div>
                                <div className="settings-field">
                                    <label>{t('settings.genre', 'Genre')}</label>
                                    <input
                                        type="text"
                                        value={config.genre || ''}
                                        onChange={(e) => handleTextChange('genre', e)}
                                    />
                                </div>
                                <div className="settings-field">
                                    <label>{t('settings.defaultChapterTarget', 'Default Word Count Goal')}</label>
                                    <input
                                        type="number"
                                        value={config.default_chapter_target || 4000}
                                        onChange={(e) => handleTextChange('default_chapter_target', e)}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'worldbuilding' && (
                            <div className="settings-section">
                                <h3>{t('settings.worldbuildingFeatures', 'Worldbuilding Features')}</h3>

                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={config.track_species || false}
                                                onChange={() => handleToggle('track_species')}
                                            />
                                            {t('settings.trackSpecies', 'Track Species/Race')}
                                        </label>
                                    </div>
                                    {config.track_species && (
                                        <div className="settings-subfield">
                                            <label>{t('settings.speciesLabel', 'Label')}</label>
                                            <input
                                                type="text"
                                                value={config.species_label || ''}
                                                onChange={(e) => handleTextChange('species_label', e, 'label')}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={config.track_groups || false}
                                                onChange={() => handleToggle('track_groups')}
                                            />
                                            {t('settings.trackGroups', 'Track Groups/Factions')}
                                        </label>
                                    </div>
                                    {config.track_groups && (
                                        <div className="settings-subfield">
                                            <label>{t('settings.groupLabel', 'Label')}</label>
                                            <input
                                                type="text"
                                                value={config.group_label || ''}
                                                onChange={(e) => handleTextChange('group_label', e, 'label')}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="settings-card">
                                    <div className="settings-field">
                                        <label>{t('settings.coreMechanic', 'Core Mechanic')}</label>
                                        <select
                                            value={config.core_mechanic || 'none'}
                                            onChange={(e) => handleTextChange('core_mechanic', e)}
                                        >
                                            <option value="none">{t('settings.mechanicNone', 'None')}</option>
                                            <option value="magic">{t('settings.mechanicMagic', 'Magic')}</option>
                                            <option value="tech">{t('settings.mechanicTech', 'Technology')}</option>
                                        </select>
                                    </div>
                                    {config.core_mechanic !== 'none' && (
                                        <div className="settings-subfield">
                                            <label>{t('settings.mechanicLabel', 'System Label')}</label>
                                            <input
                                                type="text"
                                                value={config.mechanic_label || ''}
                                                onChange={(e) => handleTextChange('mechanic_label', e, 'label')}
                                            />
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div className="settings-section">
                                <h3>{t('settings.advancedFeatures', 'Advanced Plot & Timeline')}</h3>
                                <div className="settings-card">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.track_dual_timeline || false}
                                            onChange={() => handleToggle('track_dual_timeline')}
                                        />
                                        <div>
                                            <strong>{t('settings.dualTimeline', 'Dual Timeline')}</strong>
                                            <p className="settings-desc">{t('settings.dualTimelineDesc', 'Track both narrative reading order and chronological world time.')}</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="settings-card">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.track_custom_calendar || false}
                                            onChange={() => handleToggle('track_custom_calendar')}
                                        />
                                        <div>
                                            <strong>{t('settings.customCalendar', 'Custom Calendar')}</strong>
                                            <p className="settings-desc">{t('settings.customCalendarDesc', 'Enable custom months, days, and seasons for world dates.')}</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'nlp' && (
                            <div className="settings-section">
                                <h3>{t('settings.nlpAnalysis', 'Language & Deep Analysis')}</h3>

                                <div className="settings-card highlight-card border-accent">
                                    <div className="settings-field">
                                        <label>{t('settings.storyLanguage', 'Manuscript Language')}</label>
                                        <select
                                            value={config.story_language || 'en'}
                                            onChange={(e) => handleTextChange('story_language', e)}
                                            disabled={isDownloading}
                                        >
                                            <option value="en">English</option>
                                            <option value="pl">Polski (Polish)</option>
                                            <option value="hu">Magyar (Hungarian)</option>
                                            <option value="ar">العربية (Arabic)</option>
                                        </select>
                                        <p className="settings-desc mt-2">{t('settings.storyLanguageDesc', 'This dictates which Natural Language Processing model is used for entity extraction and text analysis.')}</p>
                                    </div>

                                    <div style={{ marginTop: 16 }}>
                                        {modelExists ? (
                                            <div style={{ color: 'var(--accent-green)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                {t('settings.modelReady', 'NLP Model is downloaded and ready.')}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <button
                                                    onClick={handleDownloadModel}
                                                    disabled={isDownloading || !config.story_language}
                                                    style={{ padding: '6px 12px', background: 'var(--accent-amber)', color: 'var(--bg-deep)', border: 'none', borderRadius: 4, cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                                                >
                                                    {isDownloading ? `${t('settings.downloading', 'Downloading...')} ${downloadProgress}%` : t('settings.downloadModel', 'Download Language Model')}
                                                </button>
                                                {!isDownloading && (
                                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('settings.modelRequiredText', 'Required for analysis features.')}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* NLP Capabilities matrix */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                                        {t('settings.nlpMatrixTitle', 'Language Capabilities')}
                                    </div>
                                    {/* Model status row */}
                                    <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                        {['en', 'hu', 'pl', 'ar'].map(lang => (
                                            <span key={lang}>
                                                {lang.toUpperCase()}: {nlpModelStatus[lang] === true ? <span style={{ color: '#4ade80' }}>● installed</span> : nlpModelStatus[lang] === false ? <span style={{ color: '#6b7280' }}>○ not installed</span> : <span>…</span>}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Legend */}
                                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                                        <span><span style={{ color: '#4ade80' }}>●</span> {t('settings.nlpLegendFull', 'Full')}</span>
                                        <span><span style={{ color: '#fbbf24' }}>◐</span> {t('settings.nlpLegendPartial', 'Partial')}</span>
                                        <span><span style={{ color: '#6b7280' }}>○</span> {t('settings.nlpLegendNone', 'None')}</span>
                                        <span><span style={{ color: '#60a5fa' }}>◌</span> {t('settings.nlpLegendSoon', 'Soon')}</span>
                                    </div>
                                    <table className="nlp-matrix" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '5px 4px', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('settings.nlpTableHeaderFeature', 'Feature')}</th>
                                                {['en', 'hu', 'pl', 'ar'].map(lang => (
                                                    <th key={lang} className={currentLang === lang ? 'selected-lang' : ''} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-secondary)', fontWeight: 500, width: 48 }}>{lang.toUpperCase()}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {NLP_FEATURE_MATRIX.map(row => (
                                                <tr key={row.key}>
                                                    <td className="nlp-matrix" style={{ padding: '5px 4px', color: 'var(--text-primary)' }}>{t(`settings.nlpFeatures.${row.key}`, row.label)}</td>
                                                    {['en', 'hu', 'pl', 'ar'].map(lang => (
                                                        <td key={lang} className={currentLang === lang ? 'selected-lang' : ''} style={{ textAlign: 'center', padding: '5px 4px' }}>
                                                            <SupportBadge level={row[lang]} />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        )}

                        {activeTab === 'janitor' && (
                            <div className="settings-section">
                                <h3>{t('settings.janitorTitle', 'Janitor Suggestion Types')}</h3>
                                <p className="settings-desc mb-4">{t('settings.janitorDesc', 'Choose which types of suggestions The Janitor shows in the side panel.')}</p>

                                {[
                                    ['janitor_show_link_existing', 'janitor.types.link_existing', 'Link'],
                                    ['janitor_show_create_entity', 'janitor.types.create_entity', 'New Entity'],
                                    ['janitor_show_alias', 'janitor.types.alias', 'Alias'],
                                    ['janitor_show_typo', 'janitor.types.typo', 'Typo'],
                                    ['janitor_show_synonym', 'janitor.types.synonym', 'Synonym'],
                                    ['janitor_show_weak_adverbs', 'janitor.types.weak_adverbs', 'Weak Adverbs'],
                                    ['janitor_show_passive_voice', 'janitor.types.passive_voice', 'Passive Voice'],
                                    ['janitor_show_show_dont_tell', 'janitor.types.show_dont_tell', "Show, Don't Tell"],
                                    ['janitor_show_pacing', 'janitor.types.pacing', 'Pacing & Rhythm'],
                                ].map(([key, labelKey, fallback]) => (
                                    <div className="settings-card" key={key}>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={config[key] !== false}
                                                onChange={() => handleUpdate(key, config[key] !== false ? false : true, 'toggle')}
                                            />
                                            <div>
                                                <strong>{t(labelKey, fallback)}</strong>
                                            </div>
                                        </label>
                                    </div>
                                ))}

                                {config.janitor_show_show_dont_tell !== false && (
                                    <div className="settings-card">
                                        <label style={{ display: 'block', marginBottom: 6 }}>
                                            <strong>{t('settings.janitorSdtConfidence', "Show, Don't Tell — Detection Sensitivity")}</strong>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input
                                                type="range"
                                                min={0.3} max={0.9} step={0.05}
                                                value={config.janitor_sdt_confidence ?? 0.5}
                                                onChange={(e) => handleUpdate('janitor_sdt_confidence', parseFloat(e.target.value), 'meta')}
                                                style={{ flex: 1 }}
                                            />
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 36 }}>
                                                {(((config.janitor_sdt_confidence ?? 0.5) * 100).toFixed(0))}%
                                            </span>
                                        </div>
                                        <p className="settings-desc">{t('settings.janitorSdtConfidenceDesc', 'Lower = more suggestions (may include false positives). Higher = only high-confidence tells.')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'accessibility' && (
                            <div className="settings-section">
                                <h3>{t('settings.accessibilityFeatures', 'Accessibility & Visuals')}</h3>

                                <div className="settings-card">
                                    <h4>{t('settings.uiVisuals', 'UI & Typography')}</h4>
                                    <p className="settings-desc mb-4">{t('settings.dyslexiaModeDesc', 'Override all fonts with OpenDyslexic to improve readability for some users.')}</p>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.dyslexia_mode || false}
                                            onChange={() => handleToggle('dyslexia_mode')}
                                        />
                                        <div>
                                            <strong>{t('settings.dyslexiaMode', 'OpenDyslexic Font Mode')}</strong>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'hotkeys' && (() => {
                            const saveHotkey = (key, val) => {
                                const updated = { ...hotkeys, [key]: val }
                                setHotkeys(updated)
                                window.api?.updateGlobalConfig?.({ hotkeys: updated })
                                window.dispatchEvent(new CustomEvent('fleshnote:hotkeys-changed', { detail: updated }))
                            }
                            const rowProps = { hotkeys, editingHotkey, pendingKey, setEditingHotkey, setPendingKey, onSave: saveHotkey }
                            return (
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    {t('settings.hotkeysTitle', 'Keyboard Shortcuts')}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                                    {t('settings.hotkeysDesc', 'The two highlighted shortcuts can be customised — click a key combo to change it.')}
                                </div>

                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                                    {t('settings.hotkeysGroupEditor', 'Writing & Editor')}
                                </div>
                                <table className="hotkeys-table" style={{ marginBottom: 24 }}>
                                    <tbody>
                                        <EditableHotkeyRow hotkeyKey="todo_marker" action={t('settings.hotkeyTodo', 'Insert #TODO marker')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="synonym_lookup" action={t('settings.hotkeySynonym', 'Open synonym lookup')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="search" action={t('settings.hotkeySearch', 'Find & replace')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="entity_palette" action={t('settings.hotkeyEntityPalette', 'Open entity command palette')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="quick_note_popup" action={t('settings.hotkeyQuickNotePopup', 'Quick note on selection')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="focus_normal" action={t('settings.hotkeyFocusNormal', 'Toggle focus (normal) mode')} {...rowProps} />
                                        <HotkeyRow keys={['Ctrl', 'B']} action={t('settings.hotkeyBold', 'Bold')} />
                                        <HotkeyRow keys={['Ctrl', 'I']} action={t('settings.hotkeyItalic', 'Italic')} />
                                        <HotkeyRow keys={['Ctrl', 'U']} action={t('settings.hotkeyUnderline', 'Underline')} />
                                    </tbody>
                                </table>

                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                                    {t('settings.hotkeysGroupJanitor', 'Janitor Panel (when focused)')}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    {t('settings.hotkeysJanitorNote', 'These shortcuts are active while the Janitor sidebar is open and focused.')}
                                </div>
                                <table className="hotkeys-table">
                                    <tbody>
                                        <EditableHotkeyRow hotkeyKey="janitor_open" action={t('settings.hotkeyOpenJanitorEditable', 'Open Janitor & focus it')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="janitor_accept" action={t('settings.hotkeyAccept', 'Accept selected suggestion')} {...rowProps} />
                                        <EditableHotkeyRow hotkeyKey="janitor_dismiss" action={t('settings.hotkeyDismiss', 'Dismiss selected suggestion')} {...rowProps} />
                                        <HotkeyRow keys={['↑ / ↓']} action={t('settings.hotkeyNavigate', 'Navigate suggestions')} />
                                        <HotkeyRow keys={['Esc']} action={t('settings.hotkeyReturn', 'Return focus to editor')} />
                                    </tbody>
                                </table>
                            </div>
                            )
                        })()}
                    </div>
                </div>
            </div>
        </div>
    )
}
