import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const TYPE_COLORS = {
  character: 'var(--entity-character)',
  location:  'var(--entity-location)',
  lore:      'var(--entity-lore)',
}

const TYPE_ICONS = {
  character: '◉',
  location:  '◈',
  lore:      '◆',
}

export default function EntityCommandPalette({
  position,       // { x, y }
  selectedText,   // current word/selection in editor
  entities,       // all entities array
  onClose,
  onLink,         // (entity) => void
  onCreate,       // (type) => void  — creates entity from selectedText with given type
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(selectedText || '')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  // Fuzzy filter entities
  const filteredEntities = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) {
      return entities
        .filter(e => ['character', 'location', 'lore'].includes(e.type))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
    }
    return entities
      .filter(e => {
        if (!['character', 'location', 'lore'].includes(e.type)) return false
        const name = (e.name || '').toLowerCase()
        const aliases = (e.aliases || []).map(a => a.toLowerCase())
        return name.includes(q) || aliases.some(a => a.includes(q))
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const aExact = aName === q || aName.startsWith(q)
        const bExact = bName === q || bName.startsWith(q)
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return aName.localeCompare(bName)
      })
      .slice(0, 8)
  }, [entities, query])

  const createOptions = [
    { type: 'character', label: t('contextMenu.createCharacter', 'Character') },
    { type: 'location',  label: t('contextMenu.createLocation', 'Location')  },
    { type: 'lore',      label: t('contextMenu.createLore', 'Item / Lore')   },
  ]

  const totalItems = filteredEntities.length + createOptions.length
  const clampedIndex = Math.min(selectedIndex, totalItems - 1)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const i = clampedIndex
      if (i < filteredEntities.length) {
        onLink(filteredEntities[i])
      } else {
        const createOpt = createOptions[i - filteredEntities.length]
        if (createOpt) onCreate(createOpt.type)
      }
      onClose()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Clamp position to viewport synchronously — no async state jump
  const panelLeft = Math.min(Math.max(8, position.x), window.innerWidth - 296)
  const panelTop  = Math.min(Math.max(8, position.y), window.innerHeight - 420)

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel"
        onClick={e => e.stopPropagation()}
        style={{ left: panelLeft, top: panelTop, width: 280, fontFamily: 'var(--font-mono)', padding: 0 }}
      >
        {/* Search input */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('palette.searchEntities', 'Search or create entity…')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          />
        </div>

        {/* Existing entity results */}
        {filteredEntities.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '5px 10px 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('palette.linkExisting', 'Link existing')}
            </div>
            {filteredEntities.map((entity, i) => (
              <div
                key={`${entity.type}-${entity.id}`}
                onClick={() => { onLink(entity); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', cursor: 'pointer',
                  background: i === clampedIndex ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: i === clampedIndex ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  fontSize: 13, color: 'var(--text-primary)',
                }}
              >
                <span style={{ color: TYPE_COLORS[entity.type], fontSize: 11 }}>{TYPE_ICONS[entity.type]}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.7 }}>{entity.type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Create options */}
        <div style={{ borderTop: filteredEntities.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '5px 10px 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('palette.createAs', 'Create')} {query ? `"${query.length > 20 ? query.slice(0, 20) + '…' : query}"` : t('palette.asNew', 'selection')} {t('palette.asType', 'as')}
          </div>
          {createOptions.map((opt, i) => {
            const idx = filteredEntities.length + i
            return (
              <div
                key={opt.type}
                onClick={() => { onCreate(opt.type); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', cursor: 'pointer',
                  background: idx === clampedIndex ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: idx === clampedIndex ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  fontSize: 13, color: TYPE_COLORS[opt.type],
                }}
              >
                <span style={{ fontSize: 11 }}>{TYPE_ICONS[opt.type]}</span>
                <span>{opt.label}</span>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '4px 10px 6px', fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  )
}
