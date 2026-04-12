import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import EntityExtractor from './EntityExtractor'
import ImportManuscript from './ImportManuscript'
import NameGeneratorModal from './NameGeneratorModal'

// ─── ICONS ──────────────────────────────────────────────────────────────────

const Icons = {
  Feather: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  ),
  BookOpen: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Upload: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  MapPin: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  User: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Target: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  X: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Wand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8L19 13"></path>
      <path d="M15 9h.01"></path>
      <path d="M17.8 6.2L19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  )
}

// ─── REUSABLE STYLES ────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  marginBottom: '12px'
}

const labelStyle = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '6px'
}

const STORY_SCOPES = [
  { key: 'short', labelKey: 'setup.scopeShort', descKey: 'setup.scopeShortDesc', count: 3 },
  { key: 'novella', labelKey: 'setup.scopeNovella', descKey: 'setup.scopeNovellaDesc', count: 10 },
  { key: 'novel', labelKey: 'setup.scopeNovel', descKey: 'setup.scopeNovelDesc', count: 25 },
  { key: 'epic', labelKey: 'setup.scopeEpic', descKey: 'setup.scopeEpicDesc', count: 40 },
  { key: 'custom', labelKey: 'setup.scopeCustom', descKey: 'setup.scopeCustomDesc', count: 0 }
]

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function ProjectSetup({ projectPath, projectConfig, onComplete, onSkip }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(null) // null | "fresh" | "import"
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // ── Fresh Path State ────────────────────────────────
  const [worldName, setWorldName] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationRegion, setLocationRegion] = useState('')
  const [characters, setCharacters] = useState([
    { name: '', role: 'Protagonist', species: '', bio: '' }
  ])
  const [storyScope, setStoryScope] = useState('novel')
  const [customChapterCount, setCustomChapterCount] = useState(25)
  const [showNameGenForIndex, setShowNameGenForIndex] = useState(null)

  // ── Import Path State ───────────────────────────────
  const [splits, setSplits] = useState([])
  const [showExtractor, setShowExtractor] = useState(false)

  const genre = projectConfig?.genre || 'custom'
  const trackSpecies = projectConfig?.track_species || false
  const defaultWorldName = genre === 'romance' || genre === 'thriller' ? 'Earth' : ''

  // ── Character list management ───────────────────────
  const addCharacter = () => {
    setCharacters((prev) => [
      ...prev,
      { name: '', role: 'Supporting', species: '', bio: '' }
    ])
  }

  const updateCharacter = (index, field, value) => {
    setCharacters((prev) => prev.map((ch, i) => (i === index ? { ...ch, [field]: value } : ch)))
  }

  const removeCharacter = (index) => {
    if (characters.length <= 1) return
    setCharacters((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Fresh: Submit all data ──────────────────────────
  const handleFreshComplete = async () => {
    setLoading(true)
    try {
      // 1. Create Location Hierarchy (World -> Region -> Starting Location)
      let currentParentId = null

      if (worldName.trim()) {
        const wwRes = await window.api.createLocation({
          project_path: projectPath,
          name: worldName.trim(),
          region: ''
        })
        currentParentId = wwRes.location.id
      }

      if (locationRegion.trim()) {
        const regRes = await window.api.createLocation({
          project_path: projectPath,
          name: locationRegion.trim(),
          region: '',
          parent_location_id: currentParentId
        })
        currentParentId = regRes.location.id
      }

      if (locationName.trim()) {
        await window.api.createLocation({
          project_path: projectPath,
          name: locationName.trim(),
          region: '',
          parent_location_id: currentParentId
        })
      }

      // 2. Create characters
      const validChars = characters.filter((c) => c.name.trim())
      let protagonistId = null

      if (validChars.length > 0) {
        const result = await window.api.bulkCreateCharacters({
          project_path: projectPath,
          characters: validChars.map((c) => ({
            name: c.name.trim(),
            role: c.role,
            species: c.species,
            bio: c.bio
          }))
        })
        // First character is the protagonist / POV
        if (result.characters && result.characters.length > 0) {
          protagonistId = result.characters[0].id
        }
      }

      // 3. Create chapters based on scope
      const scopeObj = STORY_SCOPES.find((s) => s.key === storyScope)
      const chapterCount = storyScope === 'custom' ? customChapterCount : scopeObj?.count || 25

      await window.api.bulkCreateChapters({
        project_path: projectPath,
        count: chapterCount,
        pov_character_id: protagonistId,
        target_word_count: parseInt(projectConfig?.default_chapter_target) || 4000
      })

      onComplete()
    } catch (err) {
      console.error('Project setup failed:', err)
      alert(t('q.errorCreating', 'Setup failed: ') + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Import: Confirm splits ──────────────────────────
  const handleConfirmSplits = async () => {
    setLoading(true)
    try {
      await window.api.importConfirmSplits({
        project_path: projectPath,
        splits: splits,
        target_word_count: parseInt(projectConfig?.default_chapter_target) || 4000
      })
      // Move to worldbuilding data (step 2 of import)
      setStep(2)
    } catch (err) {
      console.error('Import failed:', err)
      alert('Import failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Import: Character setup then complete ───────────
  const handleImportCharacterComplete = async () => {
    setLoading(true)
    try {
      const validChars = characters.filter((c) => c.name.trim())
      if (validChars.length > 0) {
        await window.api.bulkCreateCharacters({
          project_path: projectPath,
          characters: validChars.map((c) => ({
            name: c.name.trim(),
            role: c.role,
            species: c.species,
            bio: c.bio
          }))
        })
      }
      onComplete()
    } catch (err) {
      console.error('Character creation failed:', err)
      alert('Failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── RENDER: Mode Selection ───────────────────────────────────────────────

  if (mode === null) {
    return (
      <div className="setup-overlay">
        <div className="setup-card" style={{ maxWidth: 520 }}>
          <div className="setup-logo">
            <Icons.Feather /> {t('setup.logo', 'FLESHNOTE')}
          </div>
          <h2 className="setup-title">{t('setup.readyTitle', 'Your project is ready.')}</h2>
          <p className="setup-subtitle">{t('setup.readySubtitle', 'How would you like to start?')}</p>

          <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
            <button
              className="setup-mode-btn"
              onClick={() => {
                setMode('fresh')
                setStep(1)
              }}
            >
              <Icons.BookOpen />
              <div className="setup-mode-label">{t('setup.startFresh', 'Start Fresh')}</div>
              <div className="setup-mode-desc">
                {t('setup.startFreshDesc', 'Set up your world and start writing from Chapter 1')}
              </div>
            </button>
            <button
              className="setup-mode-btn"
              onClick={() => {
                setMode('import')
                setStep(1)
              }}
            >
              <Icons.Upload />
              <div className="setup-mode-label">{t('setup.importStory', 'Import Story')}</div>
              <div className="setup-mode-desc">
                {t('setup.importStoryDesc', 'Bring in an existing manuscript and split it into chapters')}
              </div>
            </button>
          </div>

          <button className="setup-skip" onClick={onSkip}>
            {t('setup.skipSetup', 'Skip setup — I\'ll configure everything manually')}
          </button>
        </div>
      </div>
    )
  }

  // ─── RENDER: Fresh Path ───────────────────────────────────────────────────

  if (mode === 'fresh') {
    return (
      <div className="setup-overlay">
        <div className="setup-card" style={{ maxWidth: (step === 2 && showExtractor) ? 900 : undefined, transition: 'max-width 0.3s ease' }}>
          <div className="setup-logo">
            <span>{step}/3</span> {t('setup.projectSetupLabel', 'PROJECT SETUP')}
          </div>

          {/* Step 1: World & Setting */}
          {step === 1 && (
            <>
              <h2 className="setup-title">{t('setup.worldSettingTitle', 'World & Setting')}</h2>
              <p className="setup-subtitle">{t('setup.worldSettingSubtitle', 'Establish the baseline for your story\'s world.')}</p>

              <label style={labelStyle}>{t('setup.worldName', 'WORLD NAME')}</label>
              <input
                style={inputStyle}
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                placeholder={defaultWorldName || 'e.g. The Shattered Realms'}
              />

              <label style={labelStyle}>{t('setup.startingLocationLabel', 'STARTING LOCATION')}</label>
              <input
                style={inputStyle}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder={t('setup.startingLocationPlaceholder', 'e.g. The Atheric Academy')}
              />

              <label style={labelStyle}>{t('setup.regionLabel', 'REGION (optional)')}</label>
              <input
                style={inputStyle}
                value={locationRegion}
                onChange={(e) => setLocationRegion(e.target.value)}
                placeholder={t('setup.regionPlaceholder', 'e.g. Vael Plateau, Northern Reaches')}
              />
            </>
          )}

          {/* Step 2: Characters */}
          {step === 2 && !showExtractor && (
            <>
              <h2 className="setup-title">{t('setup.charactersTitle', 'Characters')}</h2>
              <p className="setup-subtitle">
                {t('setup.charactersSubtitle', 'Add your protagonist and key characters. The first character becomes the POV for Chapter 1.')}
              </p>

              {characters.map((char, i) => (
                <div key={i} className="setup-character-card">
                  <div className="setup-character-header">
                    <span
                      style={{
                        color: 'var(--accent-amber)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10
                      }}
                    >
                      {i === 0 ? t('setup.protagonistPov', 'PROTAGONIST / POV') : t('setup.characterN', 'CHARACTER {{n}}', { n: i + 1 })}
                    </span>
                    {characters.length > 1 && (
                      <button className="setup-remove-btn" onClick={() => removeCharacter(i)}>
                        <Icons.X />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>{t('setup.nameLabel', 'NAME *')}</label>
                        <button onClick={() => setShowNameGenForIndex(i)} style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }} title={t('namegen.generate_tooltip', 'Generate Name')}><Icons.Wand /> {t('namegen.generate_btn', 'Generate')}</button>
                      </div>
                      <input
                        style={inputStyle}
                        value={char.name}
                        onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                        placeholder={t('setup.namePlaceholder', 'Character name')}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>{t('setup.roleLabel', 'ROLE')}</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                        value={char.role}
                        onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                      >
                        <option value="Protagonist">{t('setup.roleProtagonist', 'Protagonist')}</option>
                        <option value="Antagonist">{t('setup.roleAntagonist', 'Antagonist')}</option>
                        <option value="Supporting">{t('setup.roleSupporting', 'Supporting')}</option>
                        <option value="Other">{t('setup.roleOther', 'Other')}</option>
                      </select>
                    </div>
                  </div>

                  {trackSpecies && (
                    <div>
                      <label style={labelStyle}>
                        {projectConfig?.species_label || t('extractor.fieldSpecies', 'SPECIES')}
                      </label>
                      <input
                        style={inputStyle}
                        value={char.species}
                        onChange={(e) => updateCharacter(i, 'species', e.target.value)}
                        placeholder="e.g. Human"
                      />
                    </div>
                  )}

                  <label style={labelStyle}>{t('setup.bioLabel', 'BIO (optional, 1-2 sentences)')}</label>
                  <textarea
                    style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                    value={char.bio}
                    onChange={(e) => updateCharacter(i, 'bio', e.target.value)}
                    placeholder={t('setup.bioPlaceholder', 'A brief description...')}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="setup-add-btn" style={{ flex: 1 }} onClick={addCharacter}>
                  <Icons.Plus /> {t('setup.addCharacterBtn', 'Add another character')}
                </button>
                <button
                  className="setup-add-btn"
                  style={{ flex: 1, borderColor: 'var(--accent-amber)' }}
                  onClick={() => setShowExtractor(true)}
                >
                  <Icons.Target /> {t('setup.importFromNotes', 'Import from Notes')}
                </button>
              </div>
            </>
          )}

          {step === 2 && showExtractor && (
            <EntityExtractor
              projectPath={projectPath}
              projectConfig={projectConfig}
              onDone={() => setShowExtractor(false)}
            />
          )}

          {/* Step 3: Story Scope */}
          {step === 3 && (
            <>
              <h2 className="setup-title">{t('setup.storyScopeTitle', 'Story Scope')}</h2>
              <p className="setup-subtitle">
                {t('setup.storyScopeSubtitle', 'How long is your story? This generates a chapter skeleton you can always edit later.')}
              </p>

              <div className="setup-scope-grid">
                {STORY_SCOPES.map((scope) => (
                  <button
                    key={scope.key}
                    className={`setup-scope-btn ${storyScope === scope.key ? 'active' : ''}`}
                    onClick={() => setStoryScope(scope.key)}
                  >
                    <div className="setup-scope-label">{t(scope.labelKey)}</div>
                    <div className="setup-scope-desc">{t(scope.descKey)}</div>
                    {scope.count > 0 && (
                      <div className="setup-scope-count">{t('setup.chapterCountUnit', '{{count}} chapters', { count: scope.count })}</div>
                    )}
                  </button>
                ))}
              </div>

              {storyScope === 'custom' && (
                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>{t('setup.numChaptersLabel', 'NUMBER OF CHAPTERS')}</label>
                  <input
                    style={{ ...inputStyle, width: 120 }}
                    type="number"
                    min="1"
                    max="200"
                    value={customChapterCount}
                    onChange={(e) => setCustomChapterCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button
              className="setup-btn secondary"
              onClick={() => (step > 1 ? setStep(step - 1) : setMode(null))}
            >
              {step > 1 ? t('setup.back', 'Back') : t('setup.cancel', 'Cancel')}
            </button>

            {step < 3 ? (
              <button className="setup-btn primary" onClick={() => setStep(step + 1)}>
                {t('setup.next', 'Next')}
              </button>
            ) : (
              <button
                className="setup-btn primary"
                onClick={handleFreshComplete}
                disabled={loading}
              >
                {loading ? t('setup.settingUp', 'Setting up...') : t('setup.startWriting', 'Start Writing')}
              </button>
            )}
          </div>
        </div>
        {showNameGenForIndex !== null && (
          <NameGeneratorModal
            projectPath={projectPath}
            projectConfig={projectConfig}
            onClose={() => setShowNameGenForIndex(null)}
            onConfirm={(name) => {
              updateCharacter(showNameGenForIndex, 'name', name)
              setShowNameGenForIndex(null)
            }}
          />
        )}
      </div>
    )
  }

  // ─── RENDER: Import Path ──────────────────────────────────────────────────

  if (mode === 'import') {
    return (
      <div className="setup-overlay">
        <div className="setup-card" style={{ maxWidth: step === 2 ? 900 : 700, transition: 'max-width 0.3s ease' }}>
          <div className="setup-logo">
            <span>{step}/3</span> {t('setup.importTitleLabel', 'IMPORT STORY')}
          </div>

          {/* Step 1: Chapter Import */}
          {step === 1 && (
            <ImportManuscript 
              projectPath={projectPath} 
              splits={splits} 
              setSplits={setSplits} 
              onCancel={() => setMode(null)} 
              onConfirm={handleConfirmSplits} 
              loading={loading} 
            />
          )}

          {/* Step 2: Entity Detection */}
          {step === 2 && (
            <EntityExtractor
              projectPath={projectPath}
              projectConfig={projectConfig}
              chapterTexts={splits.map((s, i) => ({
                index: i,
                title: s.title,
                content: s.content
              }))}
              onDone={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {/* Step 3: Character & POV Setup */}
          {step === 3 && (
            <>
              <h2 className="setup-title">{t('setup.charSetupTitle', 'Character Setup')}</h2>
              <p className="setup-subtitle">
                {t('setup.charSetupSubtitle', 'Add at least one character to set as the POV for your first chapter.')}
              </p>

              {characters.map((char, i) => (
                <div key={i} className="setup-character-card">
                  <div className="setup-character-header">
                    <span
                      style={{
                        color: 'var(--accent-amber)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10
                      }}
                    >
                      {i === 0 ? t('setup.mainPovChar', 'MAIN POV CHARACTER') : t('setup.characterN', 'CHARACTER {{n}}', { n: i + 1 })}
                    </span>
                    {characters.length > 1 && (
                      <button className="setup-remove-btn" onClick={() => removeCharacter(i)}>
                        <Icons.X />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>{t('setup.nameLabel', 'NAME *')}</label>
                      <input
                        style={inputStyle}
                        value={char.name}
                        onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                        placeholder={t('setup.namePlaceholder', 'Character name')}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>{t('setup.roleLabel', 'ROLE')}</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                        value={char.role}
                        onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                      >
                        <option value="Protagonist">{t('setup.roleProtagonist', 'Protagonist')}</option>
                        <option value="Antagonist">{t('setup.roleAntagonist', 'Antagonist')}</option>
                        <option value="Supporting">{t('setup.roleSupporting', 'Supporting')}</option>
                      </select>
                    </div>
                  </div>

                  <label style={labelStyle}>{t('setup.bioLabelShort', 'BIO (optional)')}</label>
                  <textarea
                    style={{ ...inputStyle, height: 50, resize: 'vertical' }}
                    value={char.bio}
                    onChange={(e) => updateCharacter(i, 'bio', e.target.value)}
                    placeholder={t('setup.bioPlaceholder', 'Brief description...')}
                  />
                </div>
              ))}

              <button className="setup-add-btn" onClick={addCharacter}>
                <Icons.Plus /> {t('setup.addCharacterBtn', 'Add another character')}
              </button>
            </>
          )}

          {/* Navigation (hidden on step 1 and 2 since they have their own) */}
          {step === 3 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button
                className="setup-btn secondary"
                onClick={() => setStep(step - 1)}
              >
                {t('setup.back', 'Back')}
              </button>

              {step === 3 && (
                <button
                  className="setup-btn primary"
                  onClick={handleImportCharacterComplete}
                  disabled={loading}
                >
                  {loading ? t('setup.settingUp', 'Setting up...') : t('setup.startWriting', 'Start Writing')}
                </button>
              )}
            </div>
          )}
        </div>
        {showNameGenForIndex !== null && (
          <NameGeneratorModal
            projectPath={projectPath}
            projectConfig={projectConfig}
            onClose={() => setShowNameGenForIndex(null)}
            onConfirm={(name) => {
              updateCharacter(showNameGenForIndex, 'name', name)
              setShowNameGenForIndex(null)
            }}
          />
        )}
      </div>
    )
  }

  return null
}
