import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chipSize, merge, moveTo, onShelf } from '../../utils/entityBoard'
import EntityDetail from './EntityDetail'

const DRAG_TYPE = 'application/x-fleshnote-entity'

/**
 * The finder's board: found names as chips on People / Places / Things shelves,
 * a "Not sure" tray and a bin. Drag a chip to another shelf to retype it, onto
 * another chip to merge the two, or into the bin. Click a chip for details.
 */
export default function EntityBoard({
  items,
  onChange,
  selectedId,
  onSelect,
  onStartQuickSort,
  loreCategories,
  onAddLoreCategory
}) {
  const { t } = useTranslation()
  const [dragId, setDragId] = useState(null)
  const [overShelf, setOverShelf] = useState(null)
  const [overChip, setOverChip] = useState(null)
  const [binOpen, setBinOpen] = useState(false)
  const [showRare, setShowRare] = useState(false)

  const maxFrequency = Math.max(1, ...items.map((it) => it.frequency))
  const selected = items.find((it) => it.id === selectedId) || null

  const endDrag = () => {
    setDragId(null)
    setOverShelf(null)
    setOverChip(null)
  }

  const shelfDrop = (shelf) => ({
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      setOverShelf(shelf)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOverShelf((s) => (s === shelf ? null : s))
    },
    onDrop: (e) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      onChange(moveTo(items, e.dataTransfer.getData(DRAG_TYPE), shelf))
      endDrag()
    }
  })

  const chip = (it, size) => (
    <button
      key={it.id}
      type="button"
      className={[
        'finder-chip',
        `on-${it.shelf}`,
        it.id === selectedId ? 'is-selected' : '',
        overChip === it.id && dragId !== it.id ? 'is-merge-target' : '',
        dragId === it.id ? 'is-dragging' : ''
      ].join(' ')}
      style={size ? { fontSize: `${size}px` } : undefined}
      draggable
      dir="auto"
      title={t('finder.chipTitle', '{{count}} mentions — drag to sort, drop on another name to merge', {
        count: it.frequency
      })}
      onClick={() => onSelect(it.id === selectedId ? null : it.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, it.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragId(it.id)
      }}
      onDragEnd={endDrag}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE) || dragId === it.id) return
        e.preventDefault()
        e.stopPropagation()
        setOverChip(it.id)
      }}
      onDragLeave={() => setOverChip((c) => (c === it.id ? null : c))}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.stopPropagation()
        const source = e.dataTransfer.getData(DRAG_TYPE)
        if (source && source !== it.id) {
          onChange(merge(items, source, it.id))
          onSelect(it.id)
        }
        endDrag()
      }}
    >
      {it.name}
    </button>
  )

  const shelf = (id, label, hint) => {
    const list = onShelf(items, id)
    return (
      <section className={`finder-shelf shelf-${id} ${overShelf === id ? 'is-over' : ''}`} {...shelfDrop(id)}>
        <header className="finder-shelf-head">
          <h3>{label}</h3>
          <span className="finder-count">{list.length}</span>
        </header>
        <div className="finder-chips">
          {list.length ? list.map((it) => chip(it, chipSize(it.frequency, maxFrequency))) : (
            <p className="finder-empty">{hint}</p>
          )}
        </div>
      </section>
    )
  }

  // Names seen only once are mostly noise; they stay out of the way unless asked for.
  const allUnsure = onShelf(items, 'unsure')
  const rareCount = allUnsure.filter((it) => it.frequency < 2).length
  const unsure = showRare ? allUnsure : allUnsure.filter((it) => it.frequency >= 2)
  const binned = onShelf(items, 'skip')

  return (
    <div className="finder-board-wrap">
      <div className="finder-board">
        {shelf('character', t('finder.people', 'People'), t('finder.dropPeople', 'Drop characters here'))}
        {shelf('location', t('finder.places', 'Places'), t('finder.dropPlaces', 'Drop places here'))}
        {shelf('lore', t('finder.things', 'Things & lore'), t('finder.dropThings', 'Objects, groups, magic, creatures…'))}

        <section className={`finder-shelf shelf-unsure ${overShelf === 'unsure' ? 'is-over' : ''}`} {...shelfDrop('unsure')}>
          <header className="finder-shelf-head">
            <h3>{t('finder.unsure', 'Not sure')}</h3>
            <span className="finder-count">{unsure.length}</span>
            {rareCount ? (
              <button type="button" className="ms-text-btn finder-sort-btn" onClick={() => setShowRare(!showRare)}>
                {showRare
                  ? t('finder.hideRare', 'Hide one-off mentions')
                  : t('finder.showRare', 'Show {{count}} one-off mentions', { count: rareCount })}
              </button>
            ) : null}
            {unsure.length ? (
              <button
                type="button"
                className={`ms-text-btn ${rareCount ? '' : 'finder-sort-btn'}`}
                onClick={() => onStartQuickSort(showRare)}
              >
                {t('finder.sortThem', 'Sort them one by one')}
              </button>
            ) : null}
          </header>
          <div className="finder-chips small">
            {unsure.length ? unsure.map((it) => chip(it)) : (
              <p className="finder-empty">{t('finder.unsureEmpty', 'Nothing left to decide.')}</p>
            )}
          </div>
        </section>

        <section className={`finder-shelf shelf-skip ${overShelf === 'skip' ? 'is-over' : ''}`} {...shelfDrop('skip')}>
          <header className="finder-shelf-head">
            <h3>{t('finder.bin', 'Not names')}</h3>
            <span className="finder-count">{binned.length}</span>
            {binned.length ? (
              <button type="button" className="ms-text-btn finder-sort-btn" onClick={() => setBinOpen(!binOpen)}>
                {binOpen ? t('finder.hide', 'Hide') : t('finder.show', 'Show')}
              </button>
            ) : null}
          </header>
          <div className="finder-chips small">
            {binOpen ? binned.map((it) => chip(it)) : (
              <p className="finder-empty">{t('finder.binHint', 'Drag anything that isn’t a name here.')}</p>
            )}
          </div>
        </section>
      </div>

      {selected ? (
        <EntityDetail
          item={selected}
          items={items}
          onChange={onChange}
          onClose={() => onSelect(null)}
          loreCategories={loreCategories}
          onAddLoreCategory={onAddLoreCategory}
        />
      ) : null}
    </div>
  )
}
