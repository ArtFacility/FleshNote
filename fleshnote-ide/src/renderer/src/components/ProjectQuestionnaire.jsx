import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
  X: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// Mirroring the Python presets
const GENRE_PRESETS = {
  fantasy: {
    track_species: true,
    species_label: 'Species',
    core_mechanic: 'magic',
    mechanic_label: 'Magic System',
    track_groups: true,
    group_label: 'Factions',
    track_knowledge: true,
    track_dual_timeline: true,
    lore_categories: ['mechanic', 'item', 'artifact', 'creature', 'material']
  },
  'sci-fi': {
    track_species: true,
    species_label: 'Species',
    core_mechanic: 'tech',
    mechanic_label: 'Technology',
    track_groups: true,
    group_label: 'Organizations',
    track_knowledge: true,
    track_dual_timeline: true,
    lore_categories: ['tech', 'item', 'weapon', 'vehicle', 'material']
  },
  romance: {
    track_species: false,
    species_label: 'Species',
    core_mechanic: 'none',
    mechanic_label: '',
    track_groups: false,
    group_label: 'Social Circles',
    track_knowledge: true,
    track_dual_timeline: false,
    lore_categories: ['item', 'tradition', 'location_detail']
  },
  thriller: {
    track_species: false,
    species_label: 'Species',
    core_mechanic: 'none',
    mechanic_label: '',
    track_groups: true,
    group_label: 'Organizations',
    track_knowledge: true,
    track_dual_timeline: true,
    lore_categories: ['item', 'evidence', 'weapon', 'document']
  },
  custom: {
    track_species: false,
    species_label: 'Species',
    core_mechanic: 'none',
    mechanic_label: '',
    track_groups: false,
    group_label: 'Groups',
    track_knowledge: true,
    track_dual_timeline: false,
    lore_categories: ['item']
  }
}

const GENRE_SUGGESTIONS = {
  fantasy: ['artifact', 'magic system', 'ritual', 'species', 'material'],
  'sci-fi': ['technology', 'vehicle', 'weapon', 'species', 'planet'],
  romance: ['tradition', 'location', 'event', 'social class', 'rumor'],
  thriller: ['evidence', 'weapon', 'document', 'suspect', 'location'],
  custom: ['concept', 'event', 'object', 'organization', 'location']
}

export default function ProjectQuestionnaire({ workspacePath, onCancel, onComplete }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [existingProjects, setExistingProjects] = useState([])

  useEffect(() => {
    if (workspacePath) {
      window.api.getProjects(workspacePath)
        .then(data => {
          const names = (data.projects || []).map(p => p.name.toLowerCase())
          setExistingProjects(names)
        })
        .catch(err => console.error('Failed to load existing projects', err))
    }
  }, [workspacePath])

  // Form State
  const [formData, setFormData] = useState({
    project_name: '',
    author_name: '',
    genre: 'custom',
    ...GENRE_PRESETS['custom'],
    default_chapter_target: 4000,
    story_start_date: '2016-05-28',
    extra_lore: [...GENRE_SUGGESTIONS['custom']]
  })

  const [newCategoryInput, setNewCategoryInput] = useState('')

  // Auto-fill defaults when genre changes
  const handleGenreChange = (e) => {
    const newGenre = e.target.value
    setFormData((prev) => ({
      ...prev,
      genre: newGenre,
      ...GENRE_PRESETS[newGenre],
      extra_lore: GENRE_SUGGESTIONS[newGenre] ? [...GENRE_SUGGESTIONS[newGenre]] : []
    }))
  }

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)

    const finalLoreCategories = [...formData.lore_categories]
    if (formData.extra_lore.length > 0) {
      finalLoreCategories.push(...formData.extra_lore)
    }

    const dateParts = (formData.story_start_date || '2016-05-28').split('-')

    const payload = {
      workspace_path: workspacePath,
      project_name: formData.project_name || 'Untitled Project',
      questionnaire: {
        ...formData,
        story_start_year: parseInt(dateParts[0], 10) || 2016,
        story_start_month: parseInt(dateParts[1], 10) || 5,
        story_start_day: parseInt(dateParts[2], 10) || 28,
        lore_categories: finalLoreCategories
      }
    }

    try {
      setError(null)
      const result = await window.api.initProject(payload)
      console.log('DB Generated Successfully:', result)
      setLoading(false)
      onComplete(result.project_path) // Pass the full path back to App.jsx
    } catch (err) {
      console.error('Failed to init project:', err)
      let msg = err.message || t('q.errorCreating', 'Error creating project.')
      // Strip redundant Electron prefix
      if (msg.includes("Error occurred in handler for 'api:initProject':")) {
        msg = msg.replace("Error occurred in handler for 'api:initProject':", "").trim()
        if (msg.startsWith('Error:')) msg = msg.replace('Error:', '').trim()
      }
      setError(msg)
      setLoading(false)
    }
  }

  // Reusable input styling
  const inputStyle = {
    width: '100%',
    padding: '10px',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    marginBottom: '16px'
  }

  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

  const projectNameCheck = (formData.project_name || 'Untitled Project').trim().toLowerCase()
  const nameTaken = existingProjects.includes(projectNameCheck)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        backgroundColor: 'var(--bg-deep)',
        padding: '20px'
      }}
    >
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <span>{step}/3</span> {t('q.logo', 'FLESHNOTE INIT')}
        </div>

        {step === 1 && (
          <div className="step-content">
            <h2 className="onboarding-title">{t('q.step1Title', 'Project Metadata')}</h2>
            <p className="onboarding-subtitle">
              {t('q.step1Subtitle', 'Establish the baseline parameters for your new project.')}
            </p>

            <label
              style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginBottom: '6px'
              }}
            >
              {t('q.projectNameLabel', 'PROJECT NAME')}
            </label>
            <input
              style={{
                ...inputStyle,
                borderColor: nameTaken ? 'var(--accent-red)' : 'var(--border-subtle)',
                marginBottom: nameTaken ? '4px' : '16px'
              }}
              value={formData.project_name}
              onChange={(e) => updateField('project_name', e.target.value)}
              placeholder={t('q.projectNamePlaceholder', 'e.g. The Resonance Archives')}
            />
            {nameTaken && (
              <div style={{ color: 'var(--accent-red)', fontSize: '11px', marginBottom: '16px' }}>
                {t('q.nameTaken', 'A project with this name already exists in this workspace.')}
              </div>
            )}

            <label
              style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginBottom: '6px'
              }}
            >
              {t('q.authorLabel', 'AUTHOR')}
            </label>
            <input
              style={inputStyle}
              value={formData.author_name}
              onChange={(e) => updateField('author_name', e.target.value)}
              placeholder={t('q.authorPlaceholder', 'Anonymous')}
            />

            <label
              style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginBottom: '6px'
              }}
            >
              {t('q.genreLabel', 'GENRE BASELINE (Auto-fills sensible defaults)')}
            </label>
            <select style={selectStyle} value={formData.genre} onChange={handleGenreChange}>
              <option value="fantasy">{t('q.genreFantasy', 'Fantasy')}</option>
              <option value="sci-fi">{t('q.genreSciFi', 'Sci-Fi')}</option>
              <option value="romance">{t('q.genreRomance', 'Romance')}</option>
              <option value="thriller">{t('q.genreThriller', 'Thriller')}</option>
              <option value="custom">{t('q.genreCustom', 'Custom (Blank Slate)')}</option>
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h2 className="onboarding-title">{t('q.step2Title', 'Worldbuilding Constraints')}</h2>
            <p className="onboarding-subtitle">{t('q.step2Subtitle', 'Configure the core physical and societal modules.')}</p>

            {/* Species Tracking */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.trackSpeciesLabel', 'TRACK SPECIES?')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.track_species ? 'yes' : 'no'}
                  onChange={(e) => updateField('track_species', e.target.value === 'yes')}
                >
                  <option value="yes">{t('q.yes', 'Yes')}</option>
                  <option value="no">{t('q.no', 'No')}</option>
                </select>
              </div>
              {formData.track_species && (
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      marginBottom: '6px'
                    }}
                  >
                    {t('q.speciesLabel', 'SPECIES LABEL')}
                  </label>
                  <input
                    style={inputStyle}
                    value={formData.species_label}
                    onChange={(e) => updateField('species_label', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Core Mechanic */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.coreMechanicLabel', 'CORE MECHANIC')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.core_mechanic}
                  onChange={(e) => updateField('core_mechanic', e.target.value)}
                >
                  <option value="magic">{t('q.mechanicMagic', 'Magic')}</option>
                  <option value="tech">{t('q.mechanicTech', 'Tech')}</option>
                  <option value="none">{t('q.mechanicNone', 'None')}</option>
                </select>
              </div>
              {formData.core_mechanic !== 'none' && (
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      marginBottom: '6px'
                    }}
                  >
                    {t('q.mechanicLabelText', 'MECHANIC LABEL')}
                  </label>
                  <input
                    style={inputStyle}
                    value={formData.mechanic_label}
                    onChange={(e) => updateField('mechanic_label', e.target.value)}
                    placeholder={t('q.mechanicPlaceholder', 'e.g. Bending, Cyberware')}
                  />
                </div>
              )}
            </div>

            {/* Group Tracking */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.trackGroupsLabel', 'TRACK GROUPS?')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.track_groups ? 'yes' : 'no'}
                  onChange={(e) => updateField('track_groups', e.target.value === 'yes')}
                >
                  <option value="yes">{t('q.yes', 'Yes')}</option>
                  <option value="no">{t('q.no', 'No')}</option>
                </select>
              </div>
              {formData.track_groups && (
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      marginBottom: '6px'
                    }}
                  >
                    {t('q.groupLabelText', 'GROUP LABEL')}
                  </label>
                  <input
                    style={inputStyle}
                    value={formData.group_label}
                    onChange={(e) => updateField('group_label', e.target.value)}
                    placeholder={t('q.groupPlaceholder', 'e.g. Noble Houses')}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <h2 className="onboarding-title">{t('q.step3Title', 'Advanced Systems')}</h2>
            <p className="onboarding-subtitle">
              {t('q.step3Subtitle', 'Toggles for plotting, pacing, and epistemic mechanics.')}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              {/* Epistemic */}
              <div style={{ flex: '1 1 45%' }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.epistemicLabel', 'EPISTEMIC FILTERING (Who knows what)')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.track_knowledge ? 'yes' : 'no'}
                  onChange={(e) => updateField('track_knowledge', e.target.value === 'yes')}
                >
                  <option value="yes">{t('q.enabled', 'Enabled')}</option>
                  <option value="no">{t('q.disabled', 'Disabled')}</option>
                </select>
              </div>

              {/* Dual Timeline */}
              <div style={{ flex: '1 1 45%' }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.timelineLabel', 'DUAL TIMELINE TRACKING')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.track_dual_timeline ? 'yes' : 'no'}
                  onChange={(e) => updateField('track_dual_timeline', e.target.value === 'yes')}
                >
                  <option value="yes">{t('q.enabled', 'Enabled')}</option>
                  <option value="no">{t('q.disabled', 'Disabled')}</option>
                </select>
              </div>

              {/* Story Start Date */}
              {formData.track_dual_timeline && (
                <div style={{ flex: '1 1 45%' }}>
                  <label
                    style={{
                      display: 'block',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      marginBottom: '6px'
                    }}
                  >
                    {t('q.startDateLabel', 'STORY START DATE')}
                  </label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={formData.story_start_date}
                    onChange={(e) => updateField('story_start_date', e.target.value)}
                  />
                </div>
              )}

              {/* Chapter Target */}
              <div style={{ flex: '1 1 45%' }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.wordTargetLabel', 'CHAPTER WORD TARGET')}
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  value={formData.default_chapter_target}
                  onChange={(e) =>
                    updateField('default_chapter_target', parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <label
              style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginBottom: '6px'
              }}
            >
              {t('q.extraLoreLabel', 'EXTRA LORE CATEGORIES')}
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {GENRE_SUGGESTIONS[formData.genre]?.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    if (!formData.extra_lore.includes(suggestion) && !formData.lore_categories.includes(suggestion)) {
                      updateField('extra_lore', [...formData.extra_lore, suggestion])
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-secondary)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  + {t(`categories.${suggestion}`, suggestion)}
                </button>
              ))}
            </div>

            {formData.extra_lore.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {formData.extra_lore.map((cat, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      backgroundColor: 'var(--entity-lore)',
                      color: 'var(--bg-deep)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold'
                    }}
                  >
                    <span>{t(`categories.${cat}`, cat)}</span>
                    <button
                      onClick={() => {
                        updateField(
                          'extra_lore',
                          formData.extra_lore.filter((_, i) => i !== index)
                        )
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                    >
                      <Icons.X />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = newCategoryInput.trim().toLowerCase()
                    if (val && !formData.extra_lore.includes(val) && !formData.lore_categories.includes(val)) {
                      updateField('extra_lore', [...formData.extra_lore, val])
                      setNewCategoryInput('')
                    }
                  }
                }}
                placeholder={t('q.extraLorePlaceholder', 'Type category & press Enter or +')}
              />
              <button
                onClick={() => {
                  const val = newCategoryInput.trim().toLowerCase()
                  if (val && !formData.extra_lore.includes(val) && !formData.lore_categories.includes(val)) {
                    updateField('extra_lore', [...formData.extra_lore, val])
                    setNewCategoryInput('')
                  }
                }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--text-secondary)'
                  e.currentTarget.style.color = 'var(--bg-elevated)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
              >
                +
              </button>
            </div>
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(255, 75, 75, 0.1)',
              border: '1px solid var(--accent-red)',
              borderRadius: '4px',
              color: 'var(--accent-red)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}
          >
            <Icons.AlertTriangle />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                opacity: 0.7
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
            >
              <Icons.X />
            </button>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          {step > 1 ? (
            <button
              className="onboarding-enter-btn"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              onClick={() => setStep(step - 1)}
            >
              {t('q.backBtn', 'Back')}
            </button>
          ) : (
            <button
              className="onboarding-enter-btn"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              onClick={onCancel}
            >
              {t('q.cancelBtn', 'Cancel')}
            </button>
          )}

          {step < 3 ? (
            <button
              className="onboarding-enter-btn"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && nameTaken}
              style={{
                opacity: (step === 1 && nameTaken) ? 0.5 : 1,
                cursor: (step === 1 && nameTaken) ? 'not-allowed' : 'pointer'
              }}
            >
              {t('q.nextBtn', 'Next Step')}
            </button>
          ) : (
            <button className="onboarding-enter-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? t('q.initializingBtn', 'INITIALIZING DB...') : t('q.generateBtn', 'GENERATE PROJECT')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
