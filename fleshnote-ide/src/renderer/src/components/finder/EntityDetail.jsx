import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { moveTo, promoteAlias, rename, setLoreCategory, toggleAlias } from '../../utils/entityBoard'

/** Shelf choices, shared by the details drawer and the one-by-one sort. */
export function useShelfChoices() {
  const { t } = useTranslation()
  return [
    { shelf: 'character', label: t('finder.asPerson', 'Person'), key: '1' },
    { shelf: 'location', label: t('finder.asPlace', 'Place'), key: '2' },
    { shelf: 'lore', label: t('finder.asThing', 'Thing'), key: '3' },
    { shelf: 'skip', label: t('finder.asNotName', 'Not a name'), key: 'X' }
  ]
}

/** Lore category picker with an inline "new category" field. */
export function LoreCategoryPicker({ value, categories, onChange, onAdd }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const commit = () => {
    const name = draft.trim().toLowerCase()
    if (name) {
      onAdd(name)
      onChange(name)
    }
    setAdding(false)
    setDraft('')
  }
  if (adding) {
    return (
      <input
        className="start-input finder-category-input"
        autoFocus
        value={draft}
        placeholder={t('finder.newCategory', 'New category, then Enter')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setAdding(false)
        }}
        onBlur={commit}
      />
    )
  }
  return (
    <select
      className="start-input finder-category-input"
      value={value}
      onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}
    >
      {categories.map((c) => (
        <option key={c} value={c}>
          {t(`categories.${c}`, c)}
        </option>
      ))}
      <option value="__new">{t('finder.addCategory', 'New category…')}</option>
    </select>
  )
}

/** Side drawer for one found name: quotes, spellings, rename, and where it belongs. */
export default function EntityDetail({ item, items, onChange, onClose, loreCategories, onAddLoreCategory }) {
  const { t } = useTranslation()
  const choices = useShelfChoices()

  return (
    <aside className="finder-detail" aria-label={t('finder.details', 'Details')}>
      <div className="finder-detail-head">
        <input
          className="finder-name-input"
          dir="auto"
          value={item.name}
          onChange={(e) => onChange(rename(items, item.id, e.target.value))}
          aria-label={t('finder.name', 'Name')}
        />
        <button type="button" className="choice-close" onClick={onClose} aria-label={t('common.close', 'Close')}>
          ×
        </button>
      </div>
      <p className="finder-meta">
        {t('finder.mentions', '{{count}} mentions in {{chapters}} chapters', {
          count: item.frequency,
          chapters: item.chapterCount
        })}
      </p>

      <div className="finder-choice-row">
        {choices.map((c) => (
          <button
            key={c.shelf}
            type="button"
            className={`finder-choice ${item.shelf === c.shelf ? 'is-on' : ''} choice-${c.shelf}`}
            aria-pressed={item.shelf === c.shelf}
            onClick={() => onChange(moveTo(items, item.id, c.shelf))}
          >
            {c.label}
          </button>
        ))}
      </div>
      {item.shelf === 'lore' ? (
        <LoreCategoryPicker
          value={item.loreCategory}
          categories={loreCategories}
          onChange={(c) => onChange(setLoreCategory(items, item.id, c))}
          onAdd={onAddLoreCategory}
        />
      ) : null}

      {item.snippets.length ? (
        <div className="finder-quotes">
          {item.snippets.map((s, i) => (
            <blockquote key={i} dir="auto">
              {s}
            </blockquote>
          ))}
        </div>
      ) : null}

      {item.aliases.length ? (
        <div className="finder-aliases">
          <h4>{t('finder.alsoWritten', 'Also written as')}</h4>
          <p className="finder-hint">
            {t('finder.aliasHint', 'Ticked spellings are linked to this name in your text.')}
          </p>
          <ul>
            {item.aliases.map((a, i) => (
              <li key={`${a.name}-${i}`} className={a.on ? '' : 'is-off'}>
                <label>
                  <input type="checkbox" checked={a.on} onChange={() => onChange(toggleAlias(items, item.id, i))} />
                  <span dir="auto">{a.name}</span>
                </label>
                <button type="button" className="ms-text-btn" onClick={() => onChange(promoteAlias(items, item.id, i))}>
                  {t('finder.makeMain', 'Use as main name')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="finder-hint finder-merge-hint">
        {t('finder.mergeHint', 'Same person under another name? Drag one chip onto the other to merge them.')}
      </p>
    </aside>
  )
}
