import { useEffect, useState } from 'react'
import OptionCard from '../OptionCard'
import { bindableEntities } from './BoardPanels'

/*
 * "Make it an entity": choose what a node becomes (and, for lore, its
 * category). The board does the creating; this only asks.
 */

const line = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter'
}

const ICONS = {
  character: (
    <svg {...line}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 V19 a5 5 0 0 1 5 -5 H15 a5 5 0 0 1 5 5 V21" />
    </svg>
  ),
  location: (
    <svg {...line}>
      <path d="M12 21 C 7 15 5 12 5 9 a7 7 0 0 1 14 0 c0 3 -2 6 -7 12 Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  lore: (
    <svg {...line}>
      <path d="M5 3 H15 L19 7 V21 H5 Z" />
      <path d="M9 11 H15 M9 15 H15" />
    </svg>
  ),
  group: (
    <svg {...line}>
      <path d="M6 21 V3 M6 4 H18 L15 8 L18 12 H6" />
    </svg>
  )
}

/** Lore categories from the project's settings and its existing lore. */
function useLoreCategories(projectPath, entities) {
  const [fromConfig, setFromConfig] = useState([])
  useEffect(() => {
    window.api
      .getProjectConfig(projectPath)
      .then((res) => {
        const raw = (res?.config || res || {}).lore_categories
        const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : []
        setFromConfig(list.filter((c) => typeof c === 'string'))
      })
      .catch(() => setFromConfig([]))
  }, [projectPath])
  const cats = new Set(fromConfig.map((c) => c.toLowerCase().trim()).filter(Boolean))
  for (const e of entities)
    if (e.type === 'lore' && e.category) cats.add(String(e.category).toLowerCase().trim())
  if (!cats.size) cats.add('item')
  return [...cats].sort()
}

export default function PromoteDialog({ node, projectPath, entities, onPick, onLink, onClose, t }) {
  const [step, setStep] = useState('kind')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const categories = useLoreCategories(projectPath, entities)
  const name = (node.name || '').trim()
  // An entity with this name already: linking to it is likely what was meant.
  const existing = bindableEntities(entities).find(
    (e) => e.name.trim().toLowerCase() === name.toLowerCase()
  )

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const pick = async (kind, category) => {
    setBusy(true)
    setError(null)
    try {
      await onPick(kind, category)
    } catch {
      setError(t('sketchboard.promoteFailed', 'It could not be created. Nothing was changed.'))
      setBusy(false)
    }
  }

  const kinds = [
    [
      'character',
      t('sketchboard.promoteCharacter', 'Character'),
      t('sketchboard.promoteCharacterDesc', 'Its description becomes the bio.')
    ],
    [
      'location',
      t('sketchboard.promoteLocation', 'Place'),
      t('sketchboard.promoteLocationDesc', 'A location in your world.')
    ],
    [
      'lore',
      t('sketchboard.promoteLore', 'Lore entry'),
      t(
        'sketchboard.promoteLoreDesc',
        'Properties named Rules, Limitations or Origin fill those fields.'
      )
    ],
    [
      'group',
      t('sketchboard.promoteGroup', 'Faction'),
      t('sketchboard.promoteGroupDesc', 'A group, order or nation.')
    ]
  ]

  return (
    <div
      className="settings-modal-overlay"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="settings-modal option-popup" onClick={(e) => e.stopPropagation()}>
        <div className="option-popup-head">
          <h2>
            {step === 'kind'
              ? t('sketchboard.promoteTitle', 'Make “{{name}}” an entity', { name })
              : t('sketchboard.promoteCategory', 'Which kind of lore?')}
          </h2>
          <button
            className="option-popup-icon-btn"
            onClick={onClose}
            aria-label={t('sketchboard.close', 'Close')}
            title={t('sketchboard.close', 'Close')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="option-popup-body">
          {step === 'kind' && existing && (
            <button type="button" className="sk-suggest" onClick={() => onLink(existing)}>
              {t('sketchboard.promoteExisting', '“{{name}}” already exists. Link to it instead?', {
                name: existing.name
              })}
            </button>
          )}
          {step === 'kind'
            ? kinds.map(([kind, title, desc], i) => (
                <OptionCard
                  key={kind}
                  autoFocus={i === 0}
                  icon={ICONS[kind]}
                  title={title}
                  desc={desc}
                  disabled={busy}
                  onClick={() => (kind === 'lore' ? setStep('category') : pick(kind))}
                />
              ))
            : categories.map((c, i) => (
                <OptionCard
                  key={c}
                  autoFocus={i === 0}
                  icon={ICONS.lore}
                  title={c.charAt(0).toUpperCase() + c.slice(1)}
                  disabled={busy}
                  onClick={() => pick('lore', c)}
                />
              ))}
          {error && <div className="sk-warning">{error}</div>}
        </div>
      </div>
    </div>
  )
}
