import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  generateLocationSpark,
  rollLocationDescription,
  getLocationMetadata
} from '../utils/madlibs'
import { generateLocationCandidates } from '../utils/namegen'

const GEO_SUGGESTIONS = [
  'peaks', 'crags', 'canyon', 'caldera', 'glacier', 'sunken reef',
  'valley', 'tundra', 'moor', 'marsh', 'fjord', 'archipelago'
]

const FOUNDER_SUGGESTIONS = ['Vael', 'Maren', 'Edric', 'Aldric', 'Sorn', 'Gareth', 'Kira', 'Dawyn', 'Thorn']

const HISTORY_SUGGESTIONS = [
  'ancient siege', 'fallen dynasty', 'dragon fire', 'astral collision',
  'forgotten treaty', 'exile colony', 'curse of shadows'
]

const LANDMARK_TAGS = [
  'Obsidian Pillars', 'Perpetual Fog', 'Crumbling Aqueducts', 'Runic Monoliths',
  'Howling Chasm', 'Sunken Crypts', 'Iron Ramparts'
]

function AutoTextarea({ value, onChange, className, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

const shapeFor = (siteType) => {
  const s = String(siteType || '').toLowerCase()
  if (/citadel|fortress|spire|monolith|sanctum|megastructure|necropolis|outpost/.test(s)) return 'spires'
  if (/colony|orbital|station|planet|metropolis|city/.test(s)) return 'dome'
  if (/ruins|abyss|under-city|undercity/.test(s)) return 'ruins'
  return 'peaks'
}

function PlaceShape({ shape }) {
  const stroke = 'var(--accent-blue, #5c8ec4)'
  const fill = 'rgba(92, 142, 196, 0.06)'
  return (
    <svg width="320" height="240" viewBox="0 0 320 240" fill="none">
      <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="miter">
        {shape === 'spires' ? (
          <>
            <polygon points="160,24 188,170 132,170" />
            <polygon points="96,80 116,170 76,170" />
            <polygon points="224,70 244,170 204,170" />
            <rect x="60" y="170" width="200" height="14" />
            <rect x="150" y="184" width="20" height="26" />
          </>
        ) : shape === 'dome' ? (
          <>
            <path d="M60,190 A100,100 0 0 1 260,190 Z" />
            <line x1="160" y1="92" x2="160" y2="52" />
            <circle cx="160" cy="46" r="5" />
            <rect x="40" y="190" width="240" height="12" />
          </>
        ) : shape === 'ruins' ? (
          <>
            <polygon points="70,60 96,52 92,190 66,190" />
            <polygon points="130,90 156,84 154,190 128,190" />
            <polygon points="196,70 222,64 226,190 200,190" />
            <polygon points="250,110 274,106 272,190 248,190" />
            <rect x="44" y="190" width="232" height="12" />
          </>
        ) : (
          <>
            <polygon points="24,200 96,96 150,160 208,44 272,150 296,124 296,200" />
            <rect x="24" y="200" width="272" height="10" />
            <circle cx="262" cy="54" r="16" />
          </>
        )}
      </g>
    </svg>
  )
}

export default function LocationForge({ entity, language = 'en', onSave, onBack, onDelete }) {
  const { t } = useTranslation()
  const locMeta = getLocationMetadata(language)

  const boot = useMemo(() => {
    if (entity) {
      return {
        name: entity.name && !String(entity.name).startsWith('Unnamed') ? entity.name : '',
        siteType: entity.siteType || 'Citadel',
        population: entity.population || 'settlement',
        climate: entity.climate || 'temperate',
        scale: entity.scale || 'local',
        description: entity.description || ''
      }
    }
    return generateLocationSpark({ lang: language })
  }, [])

  const [name, setName] = useState(boot.name)
  const [type, setType] = useState(boot.siteType)
  const [pop, setPop] = useState(boot.population)
  const [climate, setClimate] = useState(boot.climate)
  const [scale, setScale] = useState(boot.scale)
  const [desc, setDesc] = useState(boot.description)

  const [locGenre, setLocGenre] = useState('fantasy')
  const [geoKeyword, setGeoKeyword] = useState(
    `${boot.siteType.toLowerCase()} ${boot.climate}`
  )
  const [founder, setFounder] = useState('')
  const [history, setHistory] = useState('ancient siege')
  const [nativeTongue, setNativeTongue] = useState('')
  const [mythos, setMythos] = useState('')
  const [sciSiteType, setSciSiteType] = useState('planet')
  const [importance, setImportance] = useState('medium')
  const [vowelHarmony, setVowelHarmony] = useState(false)
  const [drift, setDrift] = useState(25)
  const [candidates, setCandidates] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  const [leftOpen, setLeftOpen] = useState(false)
  const [leftTab, setLeftTab] = useState('essentials')
  const [rightOpen, setRightOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const stateRef = useRef()
  stateRef.current = { locGenre, geoKeyword, founder, history, nativeTongue, mythos, importance, vowelHarmony, drift, sciSiteType, type, climate }

  const rollCandidates = async (overrides = {}, applyFirst = false) => {
    setIsGenerating(true)
    const s = stateRef.current
    const names = await generateLocationCandidates({
      genre: overrides.genre !== undefined ? overrides.genre : s.locGenre,
      geography: overrides.geography !== undefined ? overrides.geography : s.geoKeyword,
      founder: overrides.founder !== undefined ? overrides.founder : s.founder,
      history: overrides.history !== undefined ? overrides.history : s.history,
      nativeTongue: overrides.nativeTongue !== undefined ? overrides.nativeTongue : s.nativeTongue,
      mythos: overrides.mythos !== undefined ? overrides.mythos : s.mythos,
      importance: overrides.importance !== undefined ? overrides.importance : s.importance,
      vowelHarmony: overrides.vowelHarmony !== undefined ? overrides.vowelHarmony : s.vowelHarmony,
      drift: overrides.drift !== undefined ? overrides.drift : s.drift,
      siteType: overrides.siteType !== undefined ? overrides.siteType : (s.locGenre === 'scifi' ? s.sciSiteType : s.type),
      lang: language
    })
    setCandidates(names)
    if (applyFirst && names.length > 0) setName(names[0])
    setIsGenerating(false)
  }

  useEffect(() => {
    if (!entity) rollCandidates({ genre: 'fantasy' }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReimagine = async () => {
    const spark = generateLocationSpark({ lang: language })
    setType(spark.siteType)
    setPop(spark.population)
    setClimate(spark.climate)
    setScale(spark.scale)
    setDesc(spark.description)
    const newGeo = `${spark.siteType.toLowerCase()} ${spark.climate}`
    setGeoKeyword(newGeo)
    stateRef.current = { ...stateRef.current, type: spark.siteType, climate: spark.climate, geoKeyword: newGeo }
    await rollCandidates({ geography: newGeo, siteType: spark.siteType }, true)
  }

  const handleRerollDesc = () => {
    setDesc(
      rollLocationDescription({ lang: language, siteType: type, climate, scale })
    )
  }

  const handleSave = () => {
    onSave({
      id: entity?.id || 'loc_' + Math.random().toString(36).substr(2, 9),
      type: 'location',
      name: name.trim() || 'Unnamed Site',
      siteType: type,
      population: pop,
      climate,
      scale,
      description: desc,
      notes: `Type: ${type} | Scale: ${scale} | Climate: ${climate} | Population: ${pop} | Geo: ${geoKeyword}`
    })
  }

  const driftLabel = drift <= 15 ? 'Pristine' : drift <= 55 ? 'Lenition & Softening' : 'Heavy Syllable Drift'

  return (
    <div className="forge-overlay">
      <header className="forge-topbar">
        <button type="button" className="forge-back" onClick={onBack}>
          <span className="forge-back-arrow">←</span>
          {t('brainstorm.backToSigil', 'Back to the Sigil')}
        </button>

        <div className="forge-name-cluster">
          <input
            className="forge-name-input blue"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('brainstorm.placePlaceholder', 'A place, half-remembered...')}
          />
          <button
            type="button"
            className="forge-dice"
            onClick={() => rollCandidates({}, true)}
            disabled={isGenerating}
            title={t('brainstorm.rollName', 'Roll a new name')}
          >
            <span className="rune-inline">𐲐</span>
          </button>
        </div>

        <button type="button" className="forge-reimagine blue" onClick={handleReimagine}>
          <span className="rune-inline">𐲉</span>
          {t('brainstorm.reimagine', 'Re-imagine')}
        </button>
      </header>

      <div className="forge-stage">
        <div className="forge-figure wide">
          <div className="forge-figure-glow blue" />
          <PlaceShape shape={shapeFor(type)} />
        </div>

        <div className="forge-desc">
          <button
            type="button"
            className="forge-desc-reroll blue"
            onClick={handleRerollDesc}
            title={t('brainstorm.reRollDesc', 'Re-roll Description')}
          >
            <span className="rune-inline">𐲐</span>
          </button>
          <AutoTextarea
            className="forge-desc-input"
            value={desc}
            onChange={setDesc}
            placeholder={t('brainstorm.descPlaceholder', 'Describe this place — edit freely')}
          />
        </div>
      </div>

      <div className={`forge-notch notch-left ${leftOpen ? 'open' : ''}`}>
        <button type="button" className="notch-handle" onClick={() => setLeftOpen(!leftOpen)}>
          {t('brainstorm.essentials', 'Essentials')}
        </button>
        <div className="notch-panel">
          <div className="notch-tabs">
            <button
              type="button"
              className={`notch-tab ${leftTab === 'essentials' ? 'active' : ''}`}
              onClick={() => setLeftTab('essentials')}
            >
              {t('brainstorm.essentials', 'Essentials')}
            </button>
            <button
              type="button"
              className={`notch-tab ${leftTab === 'foundry' ? 'active' : ''}`}
              onClick={() => setLeftTab('foundry')}
            >
              {t('brainstorm.nameFoundry', 'Name Foundry')}
            </button>
          </div>

          {leftTab === 'essentials' ? (
            <>
              <label className="forge-label">{t('brainstorm.siteTypeLabel', 'SITE ARCHETYPE')}</label>
              <select
                className="forge-select"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  const g = `${e.target.value.toLowerCase()} ${climate}`
                  setGeoKeyword(g)
                  rollCandidates({ siteType: e.target.value, geography: g })
                }}
              >
                {locMeta.siteTypes.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {[
                {
                  label: t('brainstorm.populationLabel', 'POPULATION DENSITY'),
                  value: pop,
                  setValue: setPop,
                  options: locMeta.populations.map((p) => (typeof p === 'string' ? p : p.id)),
                  accent: 'var(--accent-blue, #5c8ec4)'
                },
                {
                  label: t('brainstorm.climateLabel', 'BIOME & CLIMATE'),
                  value: climate,
                  setValue: (v) => {
                    setClimate(v)
                    const g = `${type.toLowerCase()} ${v}`
                    setGeoKeyword(g)
                    rollCandidates({ geography: g })
                  },
                  options: locMeta.climates.map((c) => (typeof c === 'string' ? c : c.id)),
                  accent: '#10b981'
                },
                {
                  label: t('brainstorm.scaleLabel', 'GEOGRAPHIC SCALE'),
                  value: scale,
                  setValue: setScale,
                  options: locMeta.scales.map((s) => (typeof s === 'string' ? s : s.id)),
                  accent: 'var(--accent-amber, #d4a052)'
                }
              ].map((sl) => (
                <div key={sl.label} style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="forge-label">{sl.label}</label>
                    <span className="slider-badge" style={{ color: sl.accent }}>
                      {sl.value}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={sl.options.length - 1}
                    value={Math.max(0, sl.options.indexOf(sl.value))}
                    onChange={(e) => sl.setValue(sl.options[Number(e.target.value)])}
                    style={{ width: '100%', accentColor: sl.accent, marginTop: '6px' }}
                  />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="notch-subtabs">
                {['fantasy', 'scifi'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`notch-tab small ${locGenre === g ? 'active' : ''}`}
                    onClick={() => {
                      setLocGenre(g)
                      rollCandidates({ genre: g })
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <label className="forge-label">{t('brainstorm.geoKeywords', 'GEOGRAPHY / BIOME KEYWORDS')}</label>
              <input
                className="forge-input"
                value={geoKeyword}
                onChange={(e) => setGeoKeyword(e.target.value)}
                placeholder="e.g. peaks, caldera, sunken reef"
              />
              <div className="suggestion-row">
                {GEO_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => {
                      setGeoKeyword(s)
                      rollCandidates({ geography: s })
                    }}
                  >
                    +{s}
                  </button>
                ))}
              </div>

              <label className="forge-label" style={{ marginTop: '12px' }}>
                {t('brainstorm.founderLabel', 'HISTORICAL FOUNDER')}
              </label>
              <input
                className="forge-input"
                value={founder}
                onChange={(e) => setFounder(e.target.value)}
                placeholder="e.g. Vael, Maren"
              />
              <div className="suggestion-row">
                {FOUNDER_SUGGESTIONS.slice(0, 5).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => {
                      setFounder(f)
                      rollCandidates({ founder: f })
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <label className="forge-label" style={{ marginTop: '12px' }}>
                {t('brainstorm.historyFlavor', 'HISTORICAL EVENT / LORE')}
              </label>
              <input
                className="forge-input"
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                placeholder="e.g. ancient siege, fallen dynasty"
              />
              <div className="suggestion-row">
                {HISTORY_SUGGESTIONS.slice(0, 4).map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => {
                      setHistory(h)
                      rollCandidates({ history: h })
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>

              {locGenre === 'fantasy' ? (
                <>
                  <label className="forge-label" style={{ marginTop: '12px' }}>
                    {t('brainstorm.nativeTongue', 'NATIVE TONGUE / ARCHAIC INFLUENCE')}
                  </label>
                  <input
                    className="forge-input"
                    value={nativeTongue}
                    onChange={(e) => {
                      setNativeTongue(e.target.value)
                      rollCandidates({ nativeTongue: e.target.value })
                    }}
                    placeholder="e.g. Runic, Old Valyrian, High Sylph"
                  />
                </>
              ) : (
                <>
                  <label className="forge-label" style={{ marginTop: '12px' }}>
                    {t('brainstorm.sciSiteType', 'SITE TYPE')}
                  </label>
                  <select
                    className="forge-select"
                    value={sciSiteType}
                    onChange={(e) => {
                      setSciSiteType(e.target.value)
                      rollCandidates({ siteType: e.target.value })
                    }}
                  >
                    <option value="planet">Planet</option>
                    <option value="colony">Colony</option>
                    <option value="facility">Facility</option>
                    <option value="system">Star System</option>
                  </select>

                  <label className="forge-label" style={{ marginTop: '12px' }}>
                    {t('brainstorm.importance', 'IMPORTANCE')}
                  </label>
                  <select
                    className="forge-select"
                    value={importance}
                    onChange={(e) => {
                      setImportance(e.target.value)
                      rollCandidates({ importance: e.target.value })
                    }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <label className="forge-label" style={{ marginTop: '12px' }}>
                    {t('brainstorm.mythos', 'MYTHOS / DESIGNATION')}
                  </label>
                  <input
                    className="forge-input"
                    value={mythos}
                    onChange={(e) => {
                      setMythos(e.target.value)
                      rollCandidates({ mythos: e.target.value })
                    }}
                    placeholder="e.g. Aegis, Sector 9"
                  />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <label className="forge-label">{t('brainstorm.driftLabel', 'PHONETIC DRIFT')}</label>
                <span className="slider-badge" style={{ color: 'var(--accent-blue, #5c8ec4)' }}>
                  {drift}% · {driftLabel}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                value={drift}
                onChange={(e) => {
                  const d = Number(e.target.value)
                  setDrift(d)
                  rollCandidates({ drift: d })
                }}
                style={{ width: '100%', accentColor: 'var(--accent-blue, #5c8ec4)', marginTop: '6px' }}
              />

              <label className="forge-checkbox-row">
                <input
                  type="checkbox"
                  checked={vowelHarmony}
                  onChange={(e) => {
                    setVowelHarmony(e.target.checked)
                    rollCandidates({ vowelHarmony: e.target.checked })
                  }}
                />
                <span>{t('brainstorm.vowelHarmony', 'Vowel Harmony')}</span>
              </label>
            </>
          )}
        </div>
      </div>

      <div className={`forge-notch notch-right ${rightOpen ? 'open' : ''}`}>
        <button type="button" className="notch-handle" onClick={() => setRightOpen(!rightOpen)}>
          {t('brainstorm.atmosphere', 'Atmosphere')}
        </button>
        <div className="notch-panel">
          <div className="notch-panel-header">
            <h4>{t('brainstorm.atmosphereTags', 'Sensory Details')}</h4>
            <p className="forge-hint">
              {t(
                'brainstorm.atmosphereHint',
                'Click a landmark to weave it into the description, or re-roll the whole atmosphere.'
              )}
            </p>
            <button type="button" className="forge-panel-action" onClick={handleRerollDesc}>
              <span className="rune-inline">𐲐</span>
              {t('brainstorm.reRollDesc', 'Re-roll Description')}
            </button>
          </div>

          <div className="vault-section">
            <div className="vault-section-title blue">
              {t('brainstorm.landmarks', 'LANDMARKS & SENSORY TAGS')}
            </div>
            <div className="vault-tags">
              {LANDMARK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="vault-tag blue"
                  onClick={() => {
                    setDesc((prev) => (prev ? `${prev.trim()} Features ${tag.toLowerCase()}.` : `${tag}.`))
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {candidates.length > 0 ? (
            <div className="vault-section">
              <div className="vault-section-title blue">
                {t('brainstorm.candidates', 'NAME CANDIDATES')}
              </div>
              <div className="vault-tags">
                {candidates.map((cand) => (
                  <button
                    key={cand}
                    type="button"
                    className={`vault-tag blue ${name.trim().toLowerCase() === cand.trim().toLowerCase() ? 'selected' : ''}`}
                    onClick={() => setName(cand)}
                  >
                    {cand}
                  </button>
                ))}
              </div>
              <button type="button" className="forge-panel-action" onClick={() => rollCandidates()} disabled={isGenerating}>
                <span className="rune-inline">𐲐</span>
                {isGenerating ? t('brainstorm.synthesizing', 'Synthesizing...') : t('brainstorm.rerollCandidates', 'Re-roll Candidates')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="forge-footer">
        <div>
          {entity ? (
            confirmDelete ? (
              <button type="button" className="forge-delete confirm" onClick={onDelete}>
                {t('brainstorm.confirmDelete', 'Remove for certain?')}
              </button>
            ) : (
              <button type="button" className="forge-delete" onClick={() => setConfirmDelete(true)}>
                {t('brainstorm.removeFromStory', 'Remove from story')}
              </button>
            )
          ) : (
            <span className="forge-footer-hint">
              {t('brainstorm.placeFooterHint', 'Every story needs somewhere to happen')}
            </span>
          )}
        </div>
        <button type="button" className="forge-cta blue" onClick={handleSave}>
          {t('brainstorm.addToStory', 'Add to story')}
        </button>
      </footer>
    </div>
  )
}
