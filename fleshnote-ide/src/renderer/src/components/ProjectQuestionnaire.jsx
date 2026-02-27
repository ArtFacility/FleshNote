import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Mirroring the Python presets
const GENRE_PRESETS = {
  fantasy: {
    track_species: true,
    species_label: 'Species',
    core_mechanic: 'magic',
    mechanic_label: 'Magic System',
    track_groups: true,
    group_label: 'Factions',
    track_milestones: true,
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
    track_milestones: true,
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
    track_milestones: true,
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
    track_milestones: true,
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
    track_milestones: true,
    track_knowledge: true,
    track_dual_timeline: false,
    lore_categories: ['item']
  }
}

export default function ProjectQuestionnaire({ workspacePath, onCancel, onComplete }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    project_name: '',
    author_name: '',
    genre: 'custom',
    ...GENRE_PRESETS['custom'],
    default_chapter_target: 4000,
    extra_lore: ''
  })

  // Auto-fill defaults when genre changes
  const handleGenreChange = (e) => {
    const newGenre = e.target.value
    setFormData((prev) => ({
      ...prev,
      genre: newGenre,
      ...GENRE_PRESETS[newGenre]
    }))
  }

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)

    const finalLoreCategories = [...formData.lore_categories]
    if (formData.extra_lore.trim()) {
      const extras = formData.extra_lore
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      finalLoreCategories.push(...extras)
    }

    const payload = {
      workspace_path: workspacePath,
      project_name: formData.project_name || 'Untitled Project',
      questionnaire: {
        ...formData,
        lore_categories: finalLoreCategories
      }
    }

    try {
      const result = await window.api.initProject(payload)
      console.log('DB Generated Successfully:', result)
      setLoading(false)
      onComplete(result.project_path) // Pass the full path back to App.jsx
    } catch (err) {
      console.error('Failed to init project:', err)
      alert(t('q.errorCreating', 'Error creating project. Check terminal for python logs.'))
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
              style={inputStyle}
              value={formData.project_name}
              onChange={(e) => updateField('project_name', e.target.value)}
              placeholder={t('q.projectNamePlaceholder', 'e.g. The Resonance Archives')}
            />

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

              {/* Milestones */}
              <div style={{ flex: '1 1 45%' }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}
                >
                  {t('q.milestonesLabel', 'PLOT MILESTONES')}
                </label>
                <select
                  style={selectStyle}
                  value={formData.track_milestones ? 'yes' : 'no'}
                  onChange={(e) => updateField('track_milestones', e.target.value === 'yes')}
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
              {t('q.extraLoreLabel', 'EXTRA LORE CATEGORIES (Comma separated)')}
            </label>
            <input
              style={inputStyle}
              value={formData.extra_lore}
              onChange={(e) => updateField('extra_lore', e.target.value)}
              placeholder={t('q.extraLorePlaceholder', 'e.g. spell, cyber-implant, drug')}
            />
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
            <button className="onboarding-enter-btn" onClick={() => setStep(step + 1)}>
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
