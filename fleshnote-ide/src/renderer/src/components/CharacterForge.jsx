import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getTraitPools,
  generateCharacterSpark,
  rollCharacterDescription,
  pickRandomN,
  DEFAULT_ROLES
} from '../utils/madlibs'
import { generateCharacterName } from '../utils/namegen'

const TRAIT_SLOTS = [
  { top: '-6%', left: '50%' },
  { top: '16%', left: '-16%' },
  { top: '16%', right: '-16%' },
  { top: '44%', left: '-22%' },
  { top: '44%', right: '-22%' },
  { top: '2%', left: '2%' },
  { top: '2%', right: '2%' },
  { bottom: '12%', left: '50%' }
]

const getAgeBracket = (age) => {
  if (age <= 12) return { label: 'Child', color: '#60a5fa' }
  if (age <= 19) return { label: 'Teenager', color: '#38bdf8' }
  if (age <= 29) return { label: 'Young Adult', color: '#34d399' }
  if (age <= 49) return { label: 'Prime Adult', color: '#fbbf24' }
  if (age <= 69) return { label: 'Middle-Aged', color: '#f97316' }
  if (age <= 85) return { label: 'Elder', color: '#f43f5e' }
  return { label: 'Venerable', color: '#a855f7' }
}

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

/* PLACEHOLDER FIGURE — user will replace with custom art once available */
function Silhouette() {  return (
    <svg width="220" height="340" viewBox="0 0 220 340" fill="none">
      <g stroke="var(--accent-amber, #d4a052)" strokeWidth="2.5" fill="rgba(212, 160, 82, 0.06)" strokeLinejoin="miter">
        <circle cx="110" cy="52" r="30" />
        <rect x="100" y="80" width="20" height="16" />
        <polygon points="58,126 88,96 132,96 162,126 154,238 66,238" />
        <polygon points="58,126 30,212 44,218 66,142" />
        <polygon points="162,126 190,212 176,218 154,142" />
        <polygon points="72,238 58,324 82,324 94,238" />
        <polygon points="148,238 162,324 138,324 126,238" />
      </g>
    </svg>
  )
}

export default function CharacterForge({ entity, language = 'en', onSave, onBack, onDelete }) {
  const { t } = useTranslation()
  const traitPools = getTraitPools(language)
  const rolesList = traitPools?.roles || DEFAULT_ROLES

  const boot = useMemo(() => {
    if (entity) {
      return {
        name: entity.name && !String(entity.name).startsWith('Unnamed') ? entity.name : '',
        role: entity.role || 'Protagonist',
        age: typeof entity.age === 'number' ? entity.age : 28,
        positive: entity.positiveTraits || [],
        negative: entity.negativeTraits || [],
        desc: entity.description || ''
      }
    }
    return null
  }, [])

  const [name, setName] = useState(boot ? boot.name : '')
  const [role, setRole] = useState(boot ? boot.role : 'Protagonist')
  const [age, setAge] = useState(boot ? boot.age : 28)
  const [positive, setPositive] = useState(boot ? boot.positive : [])
  const [negative, setNegative] = useState(boot ? boot.negative : [])
  const [desc, setDesc] = useState(boot ? boot.desc : '')

  const [nameMode, setNameMode] = useState('real')
  const [realOrigin, setRealOrigin] = useState(
    language === 'hu' ? 'hungarian' : language === 'pl' ? 'polish' : 'english'
  )
  const [preset, setPreset] = useState('elvish')
  const [gender, setGender] = useState('any')
  const [isRollingName, setIsRollingName] = useState(false)

  const [traitFilter, setTraitFilter] = useState('')
  const [leftOpen, setLeftOpen] = useState(false)
  const [leftTab, setLeftTab] = useState('basics')
  const [rightOpen, setRightOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [nameGenOrigins, setNameGenOrigins] = useState(['english', 'hungarian', 'polish'])
  const [nameGenPresets, setNameGenPresets] = useState([
    'demon', 'dwarf', 'elvish', 'goblin', 'gods', 'nordic', 'orcish', 'scifi', 'wizard'
  ])

  useEffect(() => {
    if (window.api?.getNameGenOrigins) {
      window.api
        .getNameGenOrigins({ project_path: '' })
        .then((res) => {
          if (res?.origins?.length) setNameGenOrigins(res.origins)
        })
        .catch(() => {})
    }
    if (window.api?.getNameGenPresets) {
      window.api
        .getNameGenPresets({ project_path: '' })
        .then((res) => {
          if (res?.presets?.length) setNameGenPresets(res.presets)
        })
        .catch(() => {})
    }
  }, [])

  const rollName = async (mode = nameMode, origin = realOrigin, pre = preset, gen = gender) => {
    setIsRollingName(true)
    const n = await generateCharacterName({ mode, origin, preset: pre, gender: gen, lang: language })
    setName(n)
    setIsRollingName(false)
  }

  useEffect(() => {
    if (!entity) rollName()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReimagine = async () => {
    const spark = generateCharacterSpark({ lang: language })
    setRole(spark.role)
    setAge(spark.age)
    setPositive(spark.positiveTraits)
    setNegative(spark.negativeTraits)
    setDesc(spark.description)
    await rollName()
  }

  const handleToggleTrait = (trait, isPos) => {
    if (isPos) {
      if (positive.includes(trait)) setPositive(positive.filter((x) => x !== trait))
      else if (positive.length < 4) setPositive([...positive, trait])
    } else {
      if (negative.includes(trait)) setNegative(negative.filter((x) => x !== trait))
      else if (negative.length < 4) setNegative([...negative, trait])
    }
  }

  const handleRandomizeTraits = () => {
    setPositive(pickRandomN(traitPools?.positive || [], 2))
    setNegative(pickRandomN(traitPools?.negative || [], 2))
  }

  const handleSave = () => {
    onSave({
      id: entity?.id || 'char_' + Math.random().toString(36).substr(2, 9),
      type: 'character',
      name: name.trim() || 'Unnamed Character',
      role,
      age,
      positiveTraits: positive,
      negativeTraits: negative,
      description: desc,
      notes: `Age: ${age} | Strengths: ${positive.join(', ')} | Flaws: ${negative.join(', ')}`
    })
  }

  const ageBracket = getAgeBracket(age)
  const lowerFilter = traitFilter.toLowerCase().trim()
  const filteredPositive = (traitPools?.positive || []).filter((x) => x.toLowerCase().includes(lowerFilter))
  const filteredNegative = (traitPools?.negative || []).filter((x) => x.toLowerCase().includes(lowerFilter))

  const activeTags = [
    ...positive.map((tr) => ({ trait: tr, isPos: true })),
    ...negative.map((tr) => ({ trait: tr, isPos: false }))
  ]

  return (
    <div className="forge-overlay">
      <header className="forge-topbar">
        <button type="button" className="forge-back" onClick={onBack}>
          <span className="forge-back-arrow">←</span>
          {t('brainstorm.backToSigil', 'Back to the Sigil')}
        </button>

        <div className="forge-name-cluster">
          <input
            className="forge-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('brainstorm.namePlaceholder', 'A name, once spoken...')}
          />
          <button
            type="button"
            className="forge-dice"
            onClick={() => rollName()}
            disabled={isRollingName}
            title={t('brainstorm.rollName', 'Roll a new name')}
          >
            <span className="rune-inline">𐲐</span>
          </button>
        </div>

        <button type="button" className="forge-reimagine" onClick={handleReimagine}>
          <span className="rune-inline">𐲉</span>
          {t('brainstorm.reimagine', 'Re-imagine')}
        </button>
      </header>

      <div className="forge-stage">
        <div className="forge-figure">
          <div className="forge-figure-glow" />
          <Silhouette />
          {activeTags.map((tag, i) => {
            const slot = TRAIT_SLOTS[i % TRAIT_SLOTS.length]
            const style = { ...slot, animationDelay: `-${(i * 0.7).toFixed(1)}s`, animationDuration: `${5 + (i % 3)}s` }
            return (
              <button
                key={tag.trait}
                type="button"
                className={`forge-float-tag ${tag.isPos ? 'pos' : 'neg'}`}
                style={style}
                onClick={() => handleToggleTrait(tag.trait, tag.isPos)}
                title={t('brainstorm.removeTrait', 'Click to remove')}
              >
                {tag.isPos ? '+' : '−'}
                {tag.trait}
              </button>
            )
          })}
        </div>

        <div className="forge-desc">
          <button
            type="button"
            className="forge-desc-reroll"
            onClick={() => setDesc(rollCharacterDescription(language))}
            title={t('brainstorm.reRollLogline', 'Re-roll Sentence')}
          >
            <span className="rune-inline">𐲐</span>
          </button>
          <AutoTextarea
            className="forge-desc-input"
            value={desc}
            onChange={setDesc}
            placeholder={t('brainstorm.descPlaceholder', 'Describe them — edit freely')}
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
              className={`notch-tab ${leftTab === 'basics' ? 'active' : ''}`}
              onClick={() => setLeftTab('basics')}
            >
              {t('brainstorm.essentials', 'Essentials')}
            </button>
            <button
              type="button"
              className={`notch-tab ${leftTab === 'nameengine' ? 'active' : ''}`}
              onClick={() => setLeftTab('nameengine')}
            >
              {t('brainstorm.nameEngine', 'Name Engine')}
            </button>
          </div>

          {leftTab === 'basics' ? (
            <>
              <label className="forge-label">{t('brainstorm.roleLabel', 'NARRATIVE ROLE')}</label>
              <select className="forge-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {rolesList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px' }}>
                <label className="forge-label">{t('brainstorm.ageLabel', 'AGE')}</label>
                <span
                  className="age-bracket-badge"
                  style={{ backgroundColor: `${ageBracket.color}22`, color: ageBracket.color }}
                >
                  {ageBracket.label} ({age})
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={95}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber, #d97706)', marginTop: '8px' }}
              />

              <label className="forge-label" style={{ marginTop: '18px' }}>
                {t('brainstorm.genderLabel', 'GENDER (FOR NAME ROLLS)')}
              </label>
              <select className="forge-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="any">Any</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </>
          ) : (
            <>
              <div className="notch-subtabs">
                {[
                  { id: 'real', label: 'Realistic' },
                  { id: 'preset', label: 'Preset' },
                  { id: 'procedural', label: 'Procedural' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`notch-tab small ${nameMode === m.id ? 'active' : ''}`}
                    onClick={() => {
                      setNameMode(m.id)
                      rollName(m.id, realOrigin, preset, gender)
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {nameMode === 'real' ? (
                <>
                  <label className="forge-label">{t('brainstorm.cultureLabel', 'CULTURE')}</label>
                  <select
                    className="forge-select"
                    value={realOrigin}
                    onChange={(e) => {
                      setRealOrigin(e.target.value)
                      rollName('real', e.target.value, preset, gender)
                    }}
                  >
                    {nameGenOrigins.map((o) => (
                      <option key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {nameMode === 'preset' ? (
                <>
                  <label className="forge-label">{t('brainstorm.archetypeLabel', 'ARCHETYPE')}</label>
                  <select
                    className="forge-select"
                    value={preset}
                    onChange={(e) => {
                      setPreset(e.target.value)
                      rollName('preset', realOrigin, e.target.value, gender)
                    }}
                  >
                    {nameGenPresets.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {nameMode === 'procedural' ? (
                <p className="forge-hint">
                  {t(
                    'brainstorm.proceduralHint',
                    'Procedural mode syllable-spins names from scratch. Just hit the dice by the name.'
                  )}
                </p>
              ) : null}

              <button type="button" className="forge-panel-action" onClick={() => rollName()}>
                <span className="rune-inline">𐲐</span>
                {t('brainstorm.rollName', 'Roll a new name')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`forge-notch notch-right ${rightOpen ? 'open' : ''}`}>
        <button type="button" className="notch-handle" onClick={() => setRightOpen(!rightOpen)}>
          {t('brainstorm.traitsVault', 'The Trait Vault')}
        </button>
        <div className="notch-panel">
          <div className="notch-panel-header">
            <h4>
              <span className="rune-inline green">𐲈</span>
              <span className="rune-inline red">𐲮</span>
              {t('brainstorm.traitsVault', 'The Trait Vault')}
            </h4>
            <input
              className="forge-input"
              placeholder={t('brainstorm.searchTraits', 'Filter traits (e.g. Brave, Cynical)...')}
              value={traitFilter}
              onChange={(e) => setTraitFilter(e.target.value)}
            />
          </div>

          <div className="vault-section">
            <div className="vault-section-title green">
              {t('brainstorm.positiveTraits', 'STRENGTHS')} ({positive.length}/4)
              <button type="button" className="vault-randomize" onClick={handleRandomizeTraits}>
                <span className="rune-inline">𐲐</span>
                {t('brainstorm.randomizeTraits', 'Randomize')}
              </button>
            </div>
            <div className="vault-tags">
              {filteredPositive.map((trait) => {
                const isSelected = positive.includes(trait)
                return (
                  <button
                    key={trait}
                    type="button"
                    className={`vault-tag ${isSelected ? 'selected green' : 'green'}`}
                    onClick={() => handleToggleTrait(trait, true)}
                  >
                    {isSelected ? '✓' : '+'} {trait}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="vault-section">
            <div className="vault-section-title red">{t('brainstorm.negativeTraits', 'FLAWS')} ({negative.length}/4)</div>
            <div className="vault-tags">
              {filteredNegative.map((trait) => {
                const isSelected = negative.includes(trait)
                return (
                  <button
                    key={trait}
                    type="button"
                    className={`vault-tag ${isSelected ? 'selected red' : 'red'}`}
                    onClick={() => handleToggleTrait(trait, false)}
                  >
                    {isSelected ? '✓' : '−'} {trait}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="forge-hint">
            {t(
              'brainstorm.traitVaultHint',
              'Click a trait to bind it to the figure — click the floating label to unbind it.'
            )}
          </p>
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
              {positive.length + negative.length > 0
                ? t('brainstorm.traitsBound', `${positive.length + negative.length} traits bound`)
                : t('brainstorm.noTraitsBound', 'No traits bound yet')}
            </span>
          )}
        </div>
        <button type="button" className="forge-cta amber" onClick={handleSave}>
          {t('brainstorm.addToStory', 'Add to story')}
        </button>
      </footer>
    </div>
  )
}
