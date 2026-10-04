import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { moveTo, rename, setLoreCategory } from '../../utils/entityBoard'
import { LoreCategoryPicker, useShelfChoices } from './EntityDetail'

/**
 * One name at a time for what's in the "Not sure" tray (one-off mentions only
 * when the tray is showing them). Keys 1/2/3/X sort,
 * → skips, ← goes back. The list is fixed when the sort starts, so sorted names
 * can be revisited with ←.
 */
export default function QuickSort({ items, onChange, onDone, loreCategories, onAddLoreCategory, includeRare = false }) {
  const { t } = useTranslation()
  const choices = useShelfChoices()
  const queue = useRef(
    items
      .filter((it) => it.shelf === 'unsure' && (includeRare || it.frequency >= 2))
      .sort((a, b) => b.frequency - a.frequency)
      .map((it) => it.id)
  )
  const [index, setIndex] = useState(0)

  const ids = queue.current
  const current = items.find((it) => it.id === ids[index]) || null

  const advance = () => {
    if (index + 1 >= ids.length) onDone()
    else setIndex(index + 1)
  }

  const sort = (shelf) => {
    if (!current) return
    onChange(moveTo(items, current.id, shelf))
    // Things get a moment to pick a category; everything else moves on.
    if (shelf !== 'lore') advance()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const choice = choices.find((c) => c.key.toLowerCase() === e.key.toLowerCase())
      if (choice) {
        e.preventDefault()
        sort(choice.shelf)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Escape') {
        onDone()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!current) {
    return (
      <div className="finder-quick">
        <p className="finder-quick-done">{t('finder.allSorted', 'All sorted.')}</p>
        <button type="button" className="start-primary" onClick={onDone}>
          {t('finder.backToBoard', 'Back to the board')}
        </button>
      </div>
    )
  }

  return (
    <div className="finder-quick">
      <div className="finder-quick-progress">
        {t('finder.progress', '{{n}} of {{total}}', { n: index + 1, total: ids.length })}
      </div>
      <input
        className="finder-quick-name"
        dir="auto"
        value={current.name}
        onChange={(e) => onChange(rename(items, current.id, e.target.value))}
        aria-label={t('finder.name', 'Name')}
      />
      <p className="finder-meta">
        {t('finder.mentions', '{{count}} mentions in {{chapters}} chapters', {
          count: current.frequency,
          chapters: current.chapterCount
        })}
      </p>
      <div className="finder-quotes centered">
        {current.snippets.map((s, i) => (
          <blockquote key={i} dir="auto">
            {s}
          </blockquote>
        ))}
      </div>

      <div className="finder-choice-row large">
        {choices.map((c) => (
          <button
            key={c.shelf}
            type="button"
            className={`finder-choice choice-${c.shelf} ${current.shelf === c.shelf ? 'is-on' : ''}`}
            onClick={() => sort(c.shelf)}
          >
            {c.label}
            <kbd>{c.key}</kbd>
          </button>
        ))}
      </div>
      {current.shelf === 'lore' ? (
        <div className="finder-quick-category">
          <LoreCategoryPicker
            value={current.loreCategory}
            categories={loreCategories}
            onChange={(c) => onChange(setLoreCategory(items, current.id, c))}
            onAdd={onAddLoreCategory}
          />
          <button type="button" className="ms-text-btn" onClick={advance}>
            {t('finder.next', 'Next')}
          </button>
        </div>
      ) : null}

      <div className="finder-quick-nav">
        <button type="button" className="ms-text-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t('finder.previous', 'Previous')}
        </button>
        <button type="button" className="ms-text-btn" onClick={onDone}>
          {t('finder.backToBoard', 'Back to the board')}
        </button>
        <button type="button" className="ms-text-btn" onClick={advance}>
          {t('finder.skipOne', 'Decide later')}
        </button>
      </div>
    </div>
  )
}
