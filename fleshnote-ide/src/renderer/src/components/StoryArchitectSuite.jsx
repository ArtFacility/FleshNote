import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import NarrativeCurveView from './NarrativeCurveView'
import BrainstormStep from './BrainstormStep'
import { STORY_GENRES } from '../utils/madlibs'
import { applyFrameworkVariant, inferEngineForArchetype, ENGINE_AXIS_FALLBACKS, suggestWordCount } from '../utils/frameworkStack'

const NARRATIVE_GOALS = [
  { id: 'commercial_thrill', label: 'Commercial Thriller / High Velocity', desc: 'Fast-paced tension, clear turning points, escalating stakes' },
  { id: 'epic_journey', label: 'Epic Mythic Quest', desc: 'Threshold departure, trials, supreme ordeal, and transformative return' },
  { id: 'tragic_descent', label: 'Psychological Tragedy', desc: 'Symmetrical rise and moral collapse driven by internal hubris' },
  { id: 'emotional_romance', label: 'Vulnerable Romance Arc', desc: 'Meet cute, emotional intimacy, devastating crisis, and grand gesture' },
  { id: 'non_conflict', label: 'Philosophical / Non-Conflict', desc: 'Juxtaposition, contextual rupture, and holistic cognitive synthesis' },
  { id: 'puzzle_mystery', label: 'Tightly Plotted Mystery / Heist', desc: 'Reverse-engineered clues, turning points, and decisive reveals' },
  { id: 'character_circle', label: 'Episodic Transformation Cycle', desc: 'Streamlined descent into chaos, paying the price, and return changed' }
]

const PLOT_ARCHETYPES = [
  { id: 'quest', label: 'The Quest', desc: 'Journey across perilous territory to claim a crucial prize or sanctuary' },
  { id: 'monster', label: 'Overcoming the Monster', desc: 'Confronting an overwhelming antagonistic evil threatening the community' },
  { id: 'voyage', label: 'Voyage and Return', desc: 'Hurled into a strange realm, facing menace, and escaping transformed' },
  { id: 'tragedy', label: 'Tragedy', desc: 'Flawed ambition leads inexorably to personal and moral destruction' },
  { id: 'rags', label: 'Rags to Riches', desc: 'An underdog faces loss and tests to earn authentic mature fulfillment' },
  { id: 'comedy', label: 'Comedy / Farce', desc: 'Escalating entanglements and misunderstandings resolved through revelation' },
  { id: 'rebirth', label: 'Rebirth', desc: 'A protagonist trapped in dark stasis is redeemed by connection and truth' }
]

const GENRES = STORY_GENRES

export default function StoryArchitectSuite({ workspacePath, onComplete, onCancel }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [existingProjects, setExistingProjects] = useState([])

  // Framework catalog & recommendations from backend
  const [allFrameworks, setAllFrameworks] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('three_act')
  const [browseAll, setBrowseAll] = useState(false)
  // Architecture stack: Layer 1 engine, structure flavor variant, Layer 3 emotional arc
  const [dramaticEngines, setDramaticEngines] = useState([])
  const [emotionalArcs, setEmotionalArcs] = useState([])
  const [engineMeta, setEngineMeta] = useState({})
  const [lengthConventions, setLengthConventions] = useState(null)
  const [genreLengthOffsets, setGenreLengthOffsets] = useState(null)
  const [wordCountTouched, setWordCountTouched] = useState(false)
  const [engineId, setEngineId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [arcId, setArcId] = useState('')
  const [protagonistOverride, setProtagonistOverride] = useState('')
  // Simple mode: sliders drive procedural synthesis; Advanced keeps manual chips
  const [simpleMode, setSimpleMode] = useState(true)
  const [sliders, setSliders] = useState({ intensity: 0.6, polarity: 0.2, pace: 0.5 })
  const [synth, setSynth] = useState(null)
  const [manualPick, setManualPick] = useState(false)
  const [adoptedFwId, setAdoptedFwId] = useState(null)
  const variantChoiceRef = useRef(null)
  const arcChoiceRef = useRef(null)
  const [brainstormEntities, setBrainstormEntities] = useState({
    characters: [],
    locations: [],
    notes: []
  })
  const [storySummary, setStorySummary] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    project_name: '',
    author_name: '',
    story_language: 'en',
    // Worldbuilding
    track_species: false,
    species_label: 'Species',
    core_mechanic: 'none',
    mechanic_label: '',
    track_groups: true,
    group_label: 'Factions',
    track_dual_timeline: false,
    track_knowledge: true,
    // Story Compass
    compass_genre: 'fantasy',
    compass_goal: 'epic_journey',
    compass_archetype: 'quest',
    // Pacing
    target_word_count: 70000,
    default_chapter_target: 3500,
    scaffold_chapters: true
  })

  // Load existing project names to guard against duplicates
  useEffect(() => {
    if (workspacePath && window.api?.getProjects) {
      window.api
        .getProjects(workspacePath)
        .then((data) => {
          const names = (data.projects || []).map((p) => p.name.toLowerCase())
          setExistingProjects(names)
        })
        .catch((err) => console.error('Failed to load existing projects', err))
    }
  }, [workspacePath])

  // Fetch all frameworks + architecture catalogs on mount
  useEffect(() => {
    if (window.api?.getPlannerFrameworks) {
      window.api
        .getPlannerFrameworks()
        .then((res) => {
          if (res.status === 'ok' && res.frameworks) {
            setAllFrameworks(res.frameworks)
            setDramaticEngines(res.engines || [])
            setEmotionalArcs(res.arcs || [])
            setEngineMeta(res.engine_meta || {})
            setLengthConventions(res.length_conventions || null)
            setGenreLengthOffsets(res.genre_length_offsets || null)
          }
        })
        .catch((err) => console.error('Failed to fetch frameworks:', err))
    }
  }, []);

  // Calculate recommendations whenever compass choices change
  useEffect(() => {
    if (window.api?.getFrameworkRecommendations) {
      window.api
        .getFrameworkRecommendations({
          genre: formData.compass_genre,
          narrative_goal: formData.compass_goal,
          plot_archetype: formData.compass_archetype
        })
        .then((res) => {
          if (res.status === 'ok' && res.recommendations) {
            setRecommendations(res.recommendations)
            // Default selection to top recommendation if user hasn't explicitly browsed
            if (!browseAll && res.recommendations.length > 0) {
              setSelectedFrameworkId(res.recommendations[0].framework_id)
            }
          }
        })
        .catch((err) => console.error('Failed to get recommendations:', err))
    }
  }, [formData.compass_genre, formData.compass_goal, formData.compass_archetype, browseAll])

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const selectedFramework = allFrameworks.find((f) => f.id === selectedFrameworkId) || allFrameworks[0]

  // ── Architecture stack derivations ──
  const frameworkVariants = selectedFramework?.variants || []
  const activeVariant = frameworkVariants.find((v) => v.id === variantId) || frameworkVariants[0]
  const activeVariantId = activeVariant?.id || ''

  const displayFramework = useMemo(
    () => applyFrameworkVariant(selectedFramework, activeVariantId),
    [selectedFramework, activeVariantId]
  )

  const selectedArc = emotionalArcs.find((a) => a.id === arcId) || null

  // In Simple mode the synthesized (slider-transformed) curves drive the chart
  const synthPrimary = simpleMode ? synth?.primary || null : null
  const chartFramework = synthPrimary
    ? { ...displayFramework, curve_points: synthPrimary.curve_points }
    : displayFramework
  const chartInternalCurve = synthPrimary ? synthPrimary.internal_curve : selectedArc?.internal_curve

  // Engine axis caption — gives the amber line's meaning per dramatic engine
  const engineCaptionKey = engineMeta?.[engineId]?.axis_caption_key
  const stakesLabel = engineCaptionKey
    ? t(`narrativeCurve.${engineCaptionKey}`, ENGINE_AXIS_FALLBACKS[engineId] || 'Stakes & Tension')
    : null

  // Auto-pick protagonist: role contains "protagonist", else first character
  const autoProtagonist = useMemo(() => {
    const chars = (brainstormEntities.characters || []).filter((c) => c && c.name)
    if (chars.length === 0) return null
    return chars.find((c) => (c.role || '').toLowerCase().includes('protagonist')) || chars[0]
  }, [brainstormEntities.characters])
  const protagonistName = protagonistOverride || autoProtagonist?.name || ''

  // Reset variant/arc when the framework changes, preserving explicit choices
  // (chip clicks / synthesis adoptions) that belong to the new framework
  useEffect(() => {
    const fw = allFrameworks.find((f) => f.id === selectedFrameworkId)
    if (!fw) return
    const variants = fw.variants || []
    setVariantId(() => {
      if (
        variantChoiceRef.current?.fw === selectedFrameworkId &&
        variants.some((v) => v.id === variantChoiceRef.current.id)
      ) {
        return variantChoiceRef.current.id
      }
      return variants[0]?.id || ''
    })
    setArcId(() => {
      if (arcChoiceRef.current?.fw === selectedFrameworkId) return arcChoiceRef.current.id
      return fw.default_arc || ''
    })
    setProtagonistOverride('')
  }, [selectedFrameworkId])

  // Engine tracks the compass archetype
  useEffect(() => {
    setEngineId(inferEngineForArchetype(formData.compass_archetype, dramaticEngines))
  }, [formData.compass_archetype, dramaticEngines])

  // ── Procedural synthesis (debounced; fetched in both modes so the
  // suggested-length chip works everywhere; auto-adopt only in Simple) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      window.api
        ?.synthesizeArchitecture?.({
          genre: formData.compass_genre,
          plot_archetype: formData.compass_archetype,
          intensity: sliders.intensity,
          polarity: sliders.polarity,
          pace: sliders.pace
        })
        .then((res) => {
          if (res.status === 'ok') setSynth(res)
        })
        .catch((err) => console.error('Synthesis failed:', err))
    }, 250)
    return () => clearTimeout(timer)
  }, [
    simpleMode,
    formData.compass_genre,
    formData.compass_archetype,
    sliders.intensity,
    sliders.polarity,
    sliders.pace
  ])

  const adoptStack = (stack) => {
    variantChoiceRef.current = { fw: stack.framework_id, id: stack.variant_id }
    arcChoiceRef.current = { fw: stack.framework_id, id: stack.arc_id }
    setSelectedFrameworkId(stack.framework_id)
    setVariantId(stack.variant_id)
    setArcId(stack.arc_id)
    setEngineId(stack.engine_id)
    setProtagonistOverride('')
    // Propagate the suggested manuscript length until the user overrides it
    if (!wordCountTouched && stack.length?.suggested) {
      setFormData((prev) => ({ ...prev, target_word_count: stack.length.suggested }))
    }
  }

  // In Simple mode the synthesis result drives the selection: auto-adopt the
  // primary stack unless the user manually picked a card (which stays sticky)
  useEffect(() => {
    if (!simpleMode || !synth?.stacks?.length) return
    const adopted = manualPick ? synth.stacks.find((s) => s.framework_id === adoptedFwId) : null
    const target = adopted || synth.primary
    if (!target) return
    if (!adopted && manualPick) {
      // Sticky pick no longer among the stacks → fall back to primary
      setManualPick(false)
      setAdoptedFwId(null)
    }
    adoptStack(target)
  }, [synth, simpleMode])

  const fitReason = (drivers) => {
    if (!drivers) return ''
    const intensity = drivers.intensity >= 0.66
      ? t('architect.fitHigh', 'High')
      : drivers.intensity <= 0.33 ? t('architect.fitGentle', 'Gentle') : t('architect.fitMeasured', 'Measured')
    const direction = drivers.polarity <= -0.33
      ? t('architect.fitTragic', 'tragic')
      : drivers.polarity >= 0.33 ? t('architect.fitTriumphant', 'triumphant') : t('architect.fitBalanced', 'balanced')
    const pace = drivers.pace >= 0.66
      ? t('architect.fitBreakneck', 'breakneck')
      : drivers.pace <= 0.33 ? t('architect.fitSlow', 'slow-burn') : t('architect.fitSteady', 'steady')
    return t('architect.stackFitReason', '{{intensity}} emotional intensity, a {{direction}} journey, {{pace}} pacing.', { intensity, direction, pace })
  }

  const projectNameCheck = (formData.project_name || '').trim().toLowerCase()
  const nameTaken = existingProjects.includes(projectNameCheck)

  const handleSubmit = async () => {
    if (!formData.project_name.trim()) {
      setError(t('architect.nameRequired', 'Please specify a project name.'))
      setStep(1)
      return
    }
    if (nameTaken) {
      setError(t('architect.nameTaken', 'A project with this name already exists in this workspace.'))
      setStep(1)
      return
    }

    setLoading(true)
    setError(null)

    // Fall back to a randomized in-universe chronological date so authors exploring don't need to specify one
    const randomYears = [1042, 1286, 1492, 1789, 1888, 1923, 2026, 2142, 2381]
    const randomYear = randomYears[Math.floor(Math.random() * randomYears.length)]
    const randomMonth = Math.floor(Math.random() * 12) + 1
    const randomDay = Math.floor(Math.random() * 28) + 1

    const payload = {
      workspace_path: workspacePath,
      project_name: formData.project_name.trim(),
      questionnaire: {
        ...formData,
        narrative_framework: selectedFrameworkId,
        framework_variant: activeVariantId,
        dramatic_engine: engineId,
        emotional_arc: arcId,
        framework_protagonist: protagonistName,
        scaffold_chapters: formData.scaffold_chapters,
        story_start_year: randomYear,
        story_start_month: randomMonth,
        story_start_day: randomDay,
        lore_categories: ['item', 'concept', 'location_detail'],
        initial_characters: brainstormEntities.characters,
        initial_locations: brainstormEntities.locations,
        initial_notes: brainstormEntities.notes,
        story_summary: storySummary
      }
    }

    try {
      const result = await window.api.initProject(payload)
      setLoading(false)
      if (onComplete) onComplete(result.project_path)
    } catch (err) {
      console.error('Failed to init project:', err)
      let msg = err.message || t('q.errorCreating', 'Error creating project.')
      if (msg.includes("Error occurred in handler for 'api:initProject':")) {
        msg = msg.replace("Error occurred in handler for 'api:initProject':", '').trim()
        if (msg.startsWith('Error:')) msg = msg.replace('Error:', '').trim()
      }
      setError(msg)
      setLoading(false)
    }
  }

  // Calculated chapter count
  const estimatedChapters = Math.max(1, Math.round(formData.target_word_count / Math.max(500, formData.default_chapter_target)))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-deep, #0c0c0e)',
        color: 'var(--text-primary, #eee)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* ── Top Suite Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          backgroundColor: 'var(--bg-base, #111114)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'var(--accent-amber, #d97706)',
              letterSpacing: '2px'
            }}
          >
            FLESHNOTE ARCHITECT
          </span>
          <span style={{ color: 'var(--text-tertiary, #555)' }}>/</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary, #aaa)' }}>
            {t('architect.suiteSubtitle', 'Story Onboarding & Narrative Blueprint Engine')}
          </span>
        </div>

        {/* Step Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {[
            { num: 1, rune: '𐲌', label: t('architect.step1Short', 'Identity') },
            { num: 2, rune: '𐲐', label: t('architect.step2Short', 'Brainstorm') },
            { num: 3, rune: '𐲛', label: t('architect.step3Short', 'World') },
            { num: 4, rune: '𐲦', label: t('architect.step4Short', 'Compass & Structure') },
            { num: 5, rune: '𐲮', label: t('architect.step5Short', 'Pacing & Launch') }
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: s.num < step ? 'pointer' : 'default',
                opacity: step === s.num ? 1 : step > s.num ? 0.8 : 0.4
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: 0,
                  border: step === s.num
                    ? '1px solid var(--accent-amber, #d97706)'
                    : '1px solid rgba(255,255,255,0.15)',
                  fontSize: '13px',
                  fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)",
                  backgroundColor: step === s.num ? 'var(--accent-amber, #d97706)' : 'rgba(255,255,255,0.04)',
                  color: step === s.num ? '#000' : 'var(--text-secondary, #ccc)',
                  fontWeight: 'bold',
                  lineHeight: 1
                }}
              >
                {step > s.num ? '✓' : s.rune}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans, sans-serif)',
                  fontWeight: step === s.num ? '600' : 'normal',
                  color: step === s.num ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #aaa)'
                }}
              >
                {s.label}
              </span>
            </div>
          ))}

          <button
            onClick={onCancel}
            style={{
              marginLeft: '20px',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary, #888)',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>
      </div>

      {/* ── Main Content Area (Scrollable) ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '36px 20px'
        }}
      >
        <div style={{ width: '100%', maxWidth: '960px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(225, 29, 72, 0.12)',
                border: '1px solid rgba(225, 29, 72, 0.4)',
                borderRadius: 0,
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '24px'
              }}
            >
              {error}
            </div>
          )}

          {/* ═════════ STEP 1: IDENTITY ═════════ */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0' }}>
                {t('architect.step1Title', 'Story Identity & Metadata')}
              </h2>
              <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px', marginBottom: '28px' }}>
                {t('architect.step1Desc', 'Establish the core title, authorship, and chronological anchor for your book.')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>{t('q.projectNameLabel', 'PROJECT NAME')}</label>
                  <input
                    style={{
                      ...inputStyle,
                      borderColor: nameTaken ? 'var(--accent-red, #e11d48)' : 'var(--border-subtle, rgba(255,255,255,0.12))'
                    }}
                    placeholder={t('q.projectNamePlaceholder', 'e.g. The Iron Crown of Eld')}
                    value={formData.project_name}
                    onChange={(e) => updateField('project_name', e.target.value)}
                    autoFocus
                  />
                  {nameTaken && (
                    <div style={{ color: 'var(--accent-red, #e11d48)', fontSize: '11px', marginTop: '4px' }}>
                      {t('q.nameTaken', 'A project with this name already exists in this workspace.')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t('q.authorLabel', 'AUTHOR')}</label>
                    <input
                      style={inputStyle}
                      placeholder={t('q.authorPlaceholder', 'Anonymous')}
                      value={formData.author_name}
                      onChange={(e) => updateField('author_name', e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t('q.storyLanguageLabel', 'STORY LANGUAGE')}</label>
                    <select
                      style={selectStyle}
                      value={formData.story_language}
                      onChange={(e) => updateField('story_language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="hu">Magyar</option>
                      <option value="pl">Polski</option>
                      <option value="ar">عربي</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ STEP 2: BRAINSTORM SPARKS (OPTIONAL) ═════════ */}
          {step === 2 && (
            <BrainstormStep
              entities={brainstormEntities}
              onUpdateEntities={setBrainstormEntities}
              onNext={() => setStep(3)}
              language={formData.story_language || 'en'}
              genre={formData.compass_genre}
              onGenreChange={(g) => updateField('compass_genre', g)}
              storySummary={storySummary}
              onStorySummary={setStorySummary}
            />
          )}

          {/* ═════════ STEP 3: WORLDBUILDING ═════════ */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0' }}>
                {t('architect.step3WorldTitle', 'Worldbuilding Systems')}
              </h2>
              <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px', marginBottom: '28px' }}>
                {t('architect.step3WorldDesc', 'Toggle and customize the societal, epistemic, and physical modules for your world.')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Groups / Factions */}
                <div style={moduleBoxStyle}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                      {t('architect.groupsTitle', 'Groups & Factions')}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
                      {t('architect.groupsDesc', 'Track character allegiances, temporal membership, and organizational milestones.')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {formData.track_groups && (
                      <input
                        style={{ ...inputStyle, width: '140px', marginBottom: 0 }}
                        value={formData.group_label}
                        onChange={(e) => updateField('group_label', e.target.value)}
                        placeholder="Label (e.g. Guilds)"
                      />
                    )}
                    <button
                      type="button"
                      style={toggleButtonStyle(formData.track_groups)}
                      onClick={() => updateField('track_groups', !formData.track_groups)}
                    >
                      {formData.track_groups ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Core Mechanic (Magic/Tech) */}
                <div style={moduleBoxStyle}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                      {t('architect.mechanicTitle', 'Core World Mechanic')}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
                      {t('architect.mechanicDesc', 'Specialized lore tracking for magic, cyberware, or scientific systems.')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <select
                      style={{ ...selectStyle, width: '110px', marginBottom: 0 }}
                      value={formData.core_mechanic}
                      onChange={(e) => updateField('core_mechanic', e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="magic">Magic</option>
                      <option value="tech">Tech</option>
                    </select>
                    {formData.core_mechanic !== 'none' && (
                      <input
                        style={{ ...inputStyle, width: '130px', marginBottom: 0 }}
                        value={formData.mechanic_label}
                        onChange={(e) => updateField('mechanic_label', e.target.value)}
                        placeholder="Label"
                      />
                    )}
                  </div>
                </div>

                {/* Species / Races */}
                <div style={moduleBoxStyle}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                      {t('architect.speciesTitle', 'Species & Races')}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
                      {t('architect.speciesDesc', 'Biological and cultural origins for non-human characters.')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {formData.track_species && (
                      <input
                        style={{ ...inputStyle, width: '140px', marginBottom: 0 }}
                        value={formData.species_label}
                        onChange={(e) => updateField('species_label', e.target.value)}
                        placeholder="Label"
                      />
                    )}
                    <button
                      type="button"
                      style={toggleButtonStyle(formData.track_species)}
                      onClick={() => updateField('track_species', !formData.track_species)}
                    >
                      {formData.track_species ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Dual Timeline & Knowledge Tracking */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ ...moduleBoxStyle, flex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '13px' }}>Dual Timeline</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)' }}>
                        In-universe world time alongside reading order
                      </span>
                    </div>
                    <button
                      type="button"
                      style={toggleButtonStyle(formData.track_dual_timeline)}
                      onClick={() => updateField('track_dual_timeline', !formData.track_dual_timeline)}
                    >
                      {formData.track_dual_timeline ? 'Active' : 'Off'}
                    </button>
                  </div>

                  <div style={{ ...moduleBoxStyle, flex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '13px' }}>Knowledge State Tracking</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)' }}>
                        Epistemic character knowledge offsets
                      </span>
                    </div>
                    <button
                      type="button"
                      style={toggleButtonStyle(formData.track_knowledge)}
                      onClick={() => updateField('track_knowledge', !formData.track_knowledge)}
                    >
                      {formData.track_knowledge ? 'Active' : 'Off'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ STEP 4: STORY COMPASS & FRAMEWORKS ═════════ */}
          {step === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
                  {t('architect.step4CompassTitle', 'The Story Compass & Narrative Framework')}
                </h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    <button
                      type="button"
                      onClick={() => setSimpleMode(true)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 0,
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono, monospace)',
                        background: simpleMode ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                        color: simpleMode ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #888)',
                        border: simpleMode ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                        cursor: 'pointer'
                      }}
                    >
                      {t('architect.modeSimple', 'Simple')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimpleMode(false)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 0,
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono, monospace)',
                        background: !simpleMode ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                        color: !simpleMode ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #888)',
                        border: !simpleMode ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                        cursor: 'pointer'
                      }}
                    >
                      {t('architect.modeAdvanced', 'Advanced')}
                    </button>
                  </div>
                  {!simpleMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => setBrowseAll(false)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 0,
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono, monospace)',
                          background: !browseAll ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                          color: !browseAll ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #888)',
                          border: !browseAll ? '1px solid var(--accent-amber, #d97706)' : '1px solid transparent',
                          cursor: 'pointer'
                        }}
                      >
                        Compass Recommendations
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrowseAll(true)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 0,
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono, monospace)',
                          background: browseAll ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                          color: browseAll ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #888)',
                          border: browseAll ? '1px solid var(--accent-amber, #d97706)' : '1px solid transparent',
                          cursor: 'pointer'
                        }}
                      >
                        Browse All ({allFrameworks.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px', marginBottom: '24px' }}>
                {simpleMode
                  ? t('architect.stepSimpleDesc', 'Set the feel of your story — FleshNote synthesizes the optimal architecture stack for you.')
                  : t('architect.step3Desc', 'Answer 3 guided questions to discover your ideal structural blueprint, or browse the complete dramatic taxonomy.')}
              </p>

              {simpleMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px' }}>
                  {/* Compact genre + archetype */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '16px',
                      padding: '16px',
                      backgroundColor: 'var(--bg-elevated, #16161c)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                      borderRadius: 0
                    }}
                  >
                    <div>
                      <label style={labelStyle}>{t('architect.compassGenre', 'GENRE')}</label>
                      <select
                        style={{ ...selectStyle, marginBottom: 0 }}
                        value={formData.compass_genre}
                        onChange={(e) => updateField('compass_genre', e.target.value)}
                      >
                        {GENRES.map((g) => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('architect.compassArchetype', 'PLOT ARCHETYPE')}</label>
                      <select
                        style={{ ...selectStyle, marginBottom: 0 }}
                        value={formData.compass_archetype}
                        onChange={(e) => updateField('compass_archetype', e.target.value)}
                      >
                        {PLOT_ARCHETYPES.map((a) => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Feel sliders — drive the procedural synthesis */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '20px',
                      padding: '18px',
                      backgroundColor: 'var(--bg-elevated, #16161c)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                      borderRadius: 0
                    }}
                  >
                    {[
                      { key: 'intensity', label: t('architect.sliderIntensity', 'EMOTIONAL INTENSITY'), low: t('architect.intensityLow', 'Gentle'), high: t('architect.intensityHigh', 'Overwhelming') },
                      { key: 'polarity', label: t('architect.sliderPolarity', 'JOURNEY POLARITY'), low: t('architect.polarityLow', 'Tragic Fall'), high: t('architect.polarityHigh', 'Triumphant Rise') },
                      { key: 'pace', label: t('architect.sliderPace', 'PACING VELOCITY'), low: t('architect.paceLow', 'Slow Burn'), high: t('architect.paceHigh', 'Breakneck') }
                    ].map((sl) => (
                      <div key={sl.key}>
                        <label style={labelStyle}>{sl.label}</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(sliders[sl.key] * 100)}
                          onChange={(e) => {
                            setSliders((prev) => ({ ...prev, [sl.key]: Number(e.target.value) / 100 }))
                            setManualPick(false)
                            setAdoptedFwId(null)
                          }}
                          style={{ width: '100%', accentColor: 'var(--accent-amber, #d97706)', cursor: 'pointer' }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono, monospace)',
                            color: 'var(--text-tertiary, #777)',
                            marginTop: '2px'
                          }}
                        >
                          <span>{sl.low}</span>
                          <span>{sl.high}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Optimal stack cards from the synthesis engine */}
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--accent-amber, #d97706)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)", fontSize: '13px', lineHeight: 1 }}>𐲦</span>
                      <span>{t('architect.stackOptimal', 'Optimal Architectures for your story:')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                      {(synth?.stacks || []).map((s, idx) => {
                        const isSelected = selectedFrameworkId === s.framework_id && activeVariantId === s.variant_id
                        return (
                          <div
                            key={`${s.framework_id}-${s.variant_id}`}
                            onClick={() => { setManualPick(true); setAdoptedFwId(s.framework_id); adoptStack(s) }}
                            style={{
                              padding: '14px 16px',
                              backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-base, #121216)',
                              border: isSelected ? '2px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                              borderRadius: 0,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: idx === 0 ? '#000' : 'var(--accent-amber, #d97706)', backgroundColor: idx === 0 ? 'var(--accent-amber, #d97706)' : 'rgba(217, 119, 6, 0.15)', padding: '2px 6px', borderRadius: 0, fontWeight: 'bold' }}>
                                {idx === 0 ? t('architect.bestFit', 'Best Fit') : `${s.match_score}%`}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #777)', fontFamily: 'var(--font-mono, monospace)' }}>
                                {s.beats_count} {t('architect.beatsShort', 'Beats')}
                              </span>
                            </div>
                            <strong style={{ display: 'block', fontSize: '14px', color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-primary, #eee)', marginBottom: '2px' }}>
                              {s.name}
                            </strong>
                            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary, #aaa)', marginBottom: '6px' }}>
                              {[s.variant_label, dramaticEngines.find((e) => e.id === s.engine_id)?.name, s.arc_name].filter(Boolean).join(' · ')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #888)', lineHeight: 1.4 }}>
                              {fitReason(s.drivers)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!simpleMode && (
                <>
              {/* The 3 Story Compass Selectors */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-elevated, #16161c)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  borderRadius: 0,
                  marginBottom: '24px'
                }}
              >
                {/* Compass 1: Genre */}
                <div>
                  <label style={labelStyle}>1. GENRE</label>
                  <select
                    style={{ ...selectStyle, marginBottom: 0 }}
                    value={formData.compass_genre}
                    onChange={(e) => updateField('compass_genre', e.target.value)}
                  >
                    {GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compass 2: Narrative Goal */}
                <div>
                  <label style={labelStyle}>2. NARRATIVE DYNAMIC</label>
                  <select
                    style={{ ...selectStyle, marginBottom: 0 }}
                    value={formData.compass_goal}
                    onChange={(e) => updateField('compass_goal', e.target.value)}
                  >
                    {NARRATIVE_GOALS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compass 3: Plot Archetype */}
                <div>
                  <label style={labelStyle}>3. PLOT ARCHETYPE</label>
                  <select
                    style={{ ...selectStyle, marginBottom: 0 }}
                    value={formData.compass_archetype}
                    onChange={(e) => updateField('compass_archetype', e.target.value)}
                  >
                    {PLOT_ARCHETYPES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recommendations Cards or Browse All Grid */}
              {!browseAll ? (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--accent-amber, #d97706)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)", fontSize: '13px', lineHeight: 1 }}>𐲦</span>
                    <span>Top Recommended Structures for your Story Compass:</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                    {recommendations.map((rec, idx) => {
                      const isSelected = selectedFrameworkId === rec.framework_id
                      return (
                        <div
                          key={rec.framework_id}
                          onClick={() => setSelectedFrameworkId(rec.framework_id)}
                          style={{
                            padding: '14px 16px',
                            backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-base, #121216)',
                            border: isSelected ? '2px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                            borderRadius: 0,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono, monospace)',
                                color: idx === 0 ? '#000' : 'var(--accent-amber, #d97706)',
                                backgroundColor: idx === 0 ? 'var(--accent-amber, #d97706)' : 'rgba(217, 119, 6, 0.15)',
                                padding: '2px 6px',
                                borderRadius: 0,
                                fontWeight: 'bold'
                              }}
                            >
                              {idx === 0 ? 'Best Match' : `${rec.match_score}% Match`}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #777)', fontFamily: 'var(--font-mono, monospace)' }}>
                              {rec.beats_count} Beats
                            </span>
                          </div>

                          <strong style={{ display: 'block', fontSize: '14px', color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-primary, #eee)', marginBottom: '2px' }}>
                            {rec.name}
                          </strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #888)', marginBottom: '8px' }}>
                            {rec.tagline}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #aaa)', lineHeight: 1.4 }}>
                            {rec.match_reason}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* Browse All Grid */
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {allFrameworks.map((fw) => {
                      const isSelected = selectedFrameworkId === fw.id
                      return (
                        <div
                          key={fw.id}
                          onClick={() => setSelectedFrameworkId(fw.id)}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-base, #121216)',
                            border: isSelected ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                            borderRadius: 0,
                            cursor: 'pointer'
                          }}
                        >
                          <strong style={{ display: 'block', fontSize: '13px', color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-primary, #eee)' }}>
                            {fw.name}
                          </strong>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #777)' }}>
                            {fw.tagline} ({fw.beats_count} beats)
                          </div>
                        </div>
                      )
                     })}
                   </div>
                 </div>
               )}
                </>
              )}

              {/* Selected Framework Blueprint Display: Details + Tension Curve */}
              {selectedFramework && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-base, #121216)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: 0,
                    padding: '20px',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--accent-amber, #d97706)' }}>
                        {selectedFramework.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono, monospace)',
                          padding: '2px 8px',
                          borderRadius: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-secondary, #aaa)'
                        }}
                      >
                        {selectedFramework.category}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 10px 0', fontSize: '13px', color: 'var(--text-secondary, #ccc)', lineHeight: 1.5 }}>
                      {selectedFramework.description}
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #888)' }}>
                      <strong>Best For:</strong> {selectedFramework.best_for}
                    </div>
                  </div>

                  {/* Sub-architecture refinement rows (auto-filled, progressive disclosure) */}
                  {!simpleMode && frameworkVariants.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={refineLabelStyle}>{t('architect.flavorTitle', 'STRUCTURE FLAVOR')}</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {frameworkVariants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              variantChoiceRef.current = { fw: selectedFrameworkId, id: v.id }
                              setVariantId(v.id)
                              if (v.arc_id) {
                                arcChoiceRef.current = { fw: selectedFrameworkId, id: v.arc_id }
                                setArcId(v.arc_id)
                              }
                            }}
                            title={v.description}
                            style={chipStyle(activeVariantId === v.id)}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!simpleMode && (
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {dramaticEngines.length > 0 && (
                        <div style={{ flex: 1, minWidth: '280px' }}>
                          <div style={refineLabelStyle}>
                            {t('architect.engineTitle', 'DRAMATIC ENGINE')}
                            <span style={{ color: 'var(--text-tertiary, #777)', textTransform: 'none', letterSpacing: 0 }}>
                              {' '}{t('architect.engineAuto', '(from your Plot Archetype)')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {dramaticEngines.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => setEngineId(e.id)}
                                title={`${e.lineage} — ${e.description}`}
                                style={chipStyle(engineId === e.id, true)}
                              >
                                {engineMeta?.[e.id]?.fits?.includes(selectedFrameworkId) && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: '6px',
                                      height: '6px',
                                      marginRight: '6px',
                                      backgroundColor: 'var(--accent-amber, #d97706)',
                                      verticalAlign: 'middle'
                                    }}
                                  />
                                )}
                                {e.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {emotionalArcs.length > 0 && (
                        <div style={{ flex: 1, minWidth: '280px' }}>
                          <div style={refineLabelStyle}>{t('architect.arcTitle', 'EMOTIONAL ARC')}</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {emotionalArcs.map((a) => {
                              const isFit = selectedFramework?.default_arc === a.id || activeVariant?.arc_id === a.id
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => {
                                    arcChoiceRef.current = { fw: selectedFrameworkId, id: a.id }
                                    setArcId(a.id)
                                  }}
                                  title={`${a.source} — ${a.description}`}
                                  style={chipStyle(arcId === a.id, true)}
                                >
                                  {isFit && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        marginRight: '6px',
                                        backgroundColor: 'var(--accent-amber, #d97706)',
                                        verticalAlign: 'middle'
                                      }}
                                    />
                                  )}
                                  {a.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {protagonistName && (
                    <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary, #aaa)' }}>
                      {t('architect.protagonistTracking', 'Character-state line tracked for')}:{' '}
                      <strong style={{ color: 'var(--accent-blue, #5c8ec4)' }}>{protagonistName}</strong>
                      {autoProtagonist && (
                        <button
                          type="button"
                          onClick={() => setProtagonistOverride(autoProtagonist.name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-tertiary, #777)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            marginLeft: '10px',
                            textDecoration: 'underline',
                            fontFamily: 'var(--font-mono, monospace)'
                          }}
                        >
                          {t('architect.useCharacter', 'use {{name}} instead', { name: autoProtagonist.name })}
                        </button>
                      )}
                    </div>
                  )}

                  {/* The Dual-Layer SVG Curve with Old Hungarian Rovás Markers */}
                  <NarrativeCurveView
                    framework={chartFramework}
                    height={220}
                    interactive={true}
                    internalCurve={chartInternalCurve}
                    characterLabel={protagonistName}
                    stakesLabelOverride={stakesLabel}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═════════ STEP 5: PACING & CHAPTER SCAFFOLDING ═════════ */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0' }}>
                {t('architect.step5PacingTitle', 'Pacing & Chapter Scaffolding')}
              </h2>
              <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px', marginBottom: '28px' }}>
                {t('architect.step5PacingDesc', 'Configure word count goals and choose whether to generate starter chapters matching your framework beats.')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Summary Pill of selected framework */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    backgroundColor: 'rgba(217, 119, 6, 0.08)',
                    border: '1px solid rgba(217, 119, 6, 0.25)',
                    borderRadius: 0
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--accent-amber, #d97706)' }}>
                      SELECTED BLUEPRINT
                    </div>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary, #eee)' }}>
                      {selectedFramework?.name}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary, #aaa)', marginLeft: '10px' }}>
                      ({selectedFramework?.beats_count || 0} Beats across {selectedFramework?.acts_count || 0} Movements)
                    </span>
                    {(activeVariant || engineId || arcId) && (
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-tertiary, #888)', marginTop: '2px' }}>
                        {[
                          activeVariant?.label,
                          dramaticEngines.find((e) => e.id === engineId)?.name,
                          emotionalArcs.find((a) => a.id === arcId)?.name,
                          protagonistName ? t('architect.protagonistTag', 'Lead: {{name}}', { name: protagonistName }) : null
                        ]
                          .filter(Boolean)
                          .join('  ·  ')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--accent-amber, #d97706)',
                      color: 'var(--accent-amber, #d97706)',
                      borderRadius: 0,
                      padding: '4px 10px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Change Structure
                  </button>
                </div>

                {/* Suggested length (architecture conventions) + word sliders */}
                {(() => {
                  const activeStack = synth?.stacks?.find((s) => s.framework_id === selectedFrameworkId)
                  const suggestedWords =
                    activeStack?.length?.suggested ||
                    suggestWordCount(
                      selectedFrameworkId,
                      engineId,
                      formData.compass_genre,
                      synth?.primary?.drivers || null,
                      lengthConventions,
                      genreLengthOffsets
                    ).suggested
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          backgroundColor: 'var(--bg-elevated, #16161c)',
                          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                          borderRadius: 0,
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-tertiary, #888)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {t('architect.suggestedLengthChip', 'Suggested for this architecture:')}
                        </span>
                        <strong style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '14px', color: 'var(--accent-amber, #d97706)' }}>
                          {suggestedWords.toLocaleString()} {t('architect.wordsUnit', 'words')}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            updateField('target_word_count', suggestedWords)
                            setWordCountTouched(false)
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--accent-amber, #d97706)',
                            color: 'var(--accent-amber, #d97706)',
                            borderRadius: 0,
                            padding: '3px 10px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono, monospace)',
                            cursor: 'pointer'
                          }}
                        >
                          {t('architect.adoptSuggestion', 'Adopt')}
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ flex: 2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <label style={labelStyle}>{t('architect.targetWordsLabel', 'TOTAL TARGET NOVEL WORDS')}</label>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: 'var(--text-primary, #eee)' }}>
                              {formData.target_word_count.toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="40000"
                            max="200000"
                            step="500"
                            value={formData.target_word_count}
                            onChange={(e) => {
                              updateField('target_word_count', Number(e.target.value))
                              setWordCountTouched(true)
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-amber, #d97706)', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-tertiary, #777)', marginTop: '2px' }}>
                            <span>{t('architect.wordsLow', 'Novella 40k')}</span>
                            <span>{t('architect.wordsHigh', 'Epic 200k')}</span>
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <label style={labelStyle}>{t('architect.avgChapterWordsLabel', 'AVERAGE CHAPTER LENGTH')}</label>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: 'var(--text-primary, #eee)' }}>
                              {formData.default_chapter_target.toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1000"
                            max="10000"
                            step="500"
                            value={formData.default_chapter_target}
                            onChange={(e) => {
                              updateField('default_chapter_target', Number(e.target.value))
                              setWordCountTouched(true)
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-amber, #d97706)', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-tertiary, #777)', marginTop: '2px' }}>
                            <span>{t('architect.chapterLow', 'Vignette 1k')}</span>
                            <span>{t('architect.chapterHigh', 'Chunky 10k')}</span>
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>ESTIMATED CHAPTERS</label>
                          <div
                            style={{
                              ...inputStyle,
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              color: 'var(--accent-amber, #d97706)',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            ~{estimatedChapters} Chapters
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Chapter Scaffolding Toggle */}
                <div
                  onClick={() => updateField('scaffold_chapters', !formData.scaffold_chapters)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '18px 20px',
                    backgroundColor: formData.scaffold_chapters ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-elevated, #16161c)',
                    border: formData.scaffold_chapters ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    borderRadius: 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.scaffold_chapters}
                    onChange={() => {}}
                    style={{ marginTop: '4px', cursor: 'pointer', accentColor: 'var(--accent-amber, #d97706)' }}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: formData.scaffold_chapters ? 'var(--accent-amber, #d97706)' : 'var(--text-primary, #eee)', marginBottom: '4px' }}>
                      {t('architect.scaffoldChaptersTitle', 'Auto-scaffold starter chapters for framework beats')}
                    </strong>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #aaa)', lineHeight: 1.5 }}>
                      {t(
                        'architect.scaffoldChaptersDesc',
                        'If enabled, FleshNote will create chapter files and records named after each beat (e.g. Chapter 1: Ordinary World, Chapter 2: The Catalyst) linked directly to your Plot Planner blocks. If unchecked, your project starts with a single clean Chapter 1.'
                      )}
                    </p>
                  </div>
                </div>

                {/* Beat List Preview */}
                {selectedFramework?.blocks && selectedFramework.blocks.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-tertiary, #888)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Blueprint Beats to be seeded into Plot Planner:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedFramework.blocks.map((b, bIdx) => (
                        <span
                          key={bIdx}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono, monospace)',
                            padding: '4px 8px',
                            borderRadius: 0,
                            backgroundColor: 'var(--bg-elevated, #1a1a22)',
                            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                            color: 'var(--text-secondary, #bbb)'
                          }}
                        >
                          <span style={{ color: 'var(--accent-amber, #d97706)', marginRight: '6px' }}>
                            {b.pct}%
                          </span>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Suite Action Bar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 32px',
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          backgroundColor: 'var(--bg-base, #111114)'
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (step > 1) setStep(step - 1)
            else onCancel()
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
            color: 'var(--text-secondary, #ccc)',
            borderRadius: 0,
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'var(--font-mono, monospace)'
          }}
        >
          {step > 1 ? '← Back' : t('common.cancel', 'Cancel')}
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !formData.project_name.trim()) {
                  setError(t('architect.nameRequired', 'Please specify a project name.'))
                  return
                }
                if (step === 1 && nameTaken) {
                  setError(t('architect.nameTaken', 'A project with this name already exists in this workspace.'))
                  return
                }
                setError(null)
                setStep(step + 1)
              }}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--accent-amber, #d97706)',
                border: 'none',
                color: '#000',
                borderRadius: 0,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)'
              }}
            >
              {step === 2 && brainstormEntities.characters.length === 0 && brainstormEntities.locations.length === 0
                ? 'Skip to World Systems →'
                : 'Continue →'}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              style={{
                padding: '10px 28px',
                backgroundColor: 'var(--accent-amber, #d97706)',
                border: 'none',
                color: '#000',
                borderRadius: 0,
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)',
                boxShadow: '0 0 16px rgba(217, 119, 6, 0.4)'
              }}
            >
              {loading ? 'Generating Blueprint...' : 'Initialize Project & Launch'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  color: 'var(--text-secondary, #aaa)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono, monospace)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '6px'
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--bg-elevated, #181820)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  color: 'var(--text-primary, #eee)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '13px',
  borderRadius: 0,
  boxSizing: 'border-box'
}

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer'
}

const moduleBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  backgroundColor: 'var(--bg-elevated, #16161c)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
  borderRadius: 0
}

const toggleButtonStyle = (isActive) => ({
  padding: '6px 14px',
  backgroundColor: isActive ? 'rgba(217, 119, 6, 0.15)' : 'rgba(255,255,255,0.05)',
  border: isActive ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  color: isActive ? 'var(--accent-amber, #d97706)' : 'var(--text-tertiary, #777)',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '11px',
  fontWeight: isActive ? 'bold' : 'normal',
  transition: 'all 0.2s ease'
})

const refineLabelStyle = {
  color: 'var(--text-tertiary, #888)',
  fontSize: '10px',
  fontFamily: 'var(--font-mono, monospace)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '6px'
}

const chipStyle = (isSelected, compact = false) => ({
  padding: compact ? '5px 10px' : '6px 12px',
  backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
  border: isSelected ? '1px solid var(--accent-amber, #d97706)' : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #999)',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '11px',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s ease'
})
