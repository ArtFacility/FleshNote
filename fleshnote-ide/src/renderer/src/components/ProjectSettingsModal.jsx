import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProjectSettingsModal({ isOpen, onClose, projectPath }) {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState('general')
    const [config, setConfig] = useState(null)
    const [loading, setLoading] = useState(true)

    // NLP Model states
    const [modelExists, setModelExists] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)

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

                                <div className="settings-card">
                                    <div className="settings-field">
                                        <label>{t('settings.loreCategories', 'Lore Categories (Comma separated)')}</label>
                                        <input
                                            type="text"
                                            value={(config.lore_categories || []).join(', ')}
                                            onChange={(e) => {
                                                const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                handleUpdate('lore_categories', arr, 'json')
                                            }}
                                            placeholder="e.g. item, artifact, weapon"
                                        />
                                    </div>
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
                                            checked={config.track_knowledge || false}
                                            onChange={() => handleToggle('track_knowledge')}
                                        />
                                        <div>
                                            <strong>{t('settings.epistemicFiltering', 'Epistemic Filtering (Knowledge States)')}</strong>
                                            <p className="settings-desc">{t('settings.epistemicDesc', 'Track who knows what, and filter the entity inspector based on the current POV character.')}</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="settings-card">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.track_milestones || false}
                                            onChange={() => handleToggle('track_milestones')}
                                        />
                                        <div>
                                            <strong>{t('settings.milestones', 'Plot Milestones')}</strong>
                                            <p className="settings-desc">{t('settings.milestonesDesc', 'Track future plot points and their prerequisites.')}</p>
                                        </div>
                                    </label>
                                </div>
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
                                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('settings.modelRequiredText', 'Required for advanced AI features.')}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="settings-card">
                                    <h4>{t('settings.experimentalFeatures', 'Experimental Analysis Features')}</h4>
                                    <p className="settings-desc mb-4">{t('settings.experimentalDesc', 'These features require a downloaded model for full capabilities.')}</p>

                                    <label className="checkbox-label mb-3">
                                        <input
                                            type="checkbox"
                                            checked={config.feature_sensory_check || false}
                                            onChange={() => handleToggle('feature_sensory_check')}
                                        />
                                        <div>
                                            <strong>{t('settings.sensoryCheck', 'Sensory Description Checker')}</strong>
                                            <p className="settings-desc">{t('settings.sensoryCheckDesc', 'Analyze prose for balance of sight, sound, smell, touch, and taste.')}</p>
                                        </div>
                                    </label>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.feature_voice_detector || false}
                                            onChange={() => handleToggle('feature_voice_detector')}
                                        />
                                        <div>
                                            <strong>{t('settings.voiceDetector', 'Character Voice Consistency')}</strong>
                                            <p className="settings-desc">{t('settings.voiceDetectorDesc', 'Detect variations in dialogue vocabulary and structure between characters.')}</p>
                                        </div>
                                    </label>
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
