import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'

// ── Inline SVG Icons ────────────────────────────────────────────────────────

const Icons = {
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
  Gem: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M2 9h20" />
      <path d="M12 22L6 3" />
      <path d="M12 22l6-19" />
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
  ChevronRight: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  FileText: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Link: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Eye: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Unlink: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Feather: () => (
    <svg
      width="14"
      height="14"
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
  Shield: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function EntityContextMenu({
  position,
  selectedText,
  entities,
  onClose,
  onCreateEntity,
  onLinkEntity,
  onAction, // Generic action handler: onAction(actionType, data)
  entityAtCursor // Entity link under cursor (if any): { type, id }
}) {
  const { t } = useTranslation()
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const [adjustedPos, setAdjustedPos] = useState(position)
  const [submenuLeft, setSubmenuLeft] = useState(false)
  const menuRef = useRef(null)

  // Bounds logic
  useLayoutEffect(() => {
    if (menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect()
      let { x, y } = position

      let pushedLeft = false
      if (x + rect.width > window.innerWidth) {
        x = window.innerWidth - rect.width - 8
        pushedLeft = true
      }
      if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - 8
      }

      // If we pushed the main menu left or if there's no space on the right for a ~240px submenu
      if (pushedLeft || x + rect.width + 240 > window.innerWidth) {
        setSubmenuLeft(true)
      } else {
        setSubmenuLeft(false)
      }

      setAdjustedPos({ x, y })
    }
  }, [position])

  // Close on any outside click or Escape
  useEffect(() => {
    const handleClose = () => onClose()
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('click', handleClose)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  if (!position || !selectedText) return null

  // Find existing entities that match selected text
  const normalizedText = selectedText.toLowerCase()
  const matchingEntities = entities.filter(
    (e) =>
      e.name.toLowerCase() === normalizedText ||
      (e.aliases || []).some((a) => a.toLowerCase() === normalizedText)
  )

  // Truncate display text
  const displayText =
    selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText

  // Find PARTIAL matches for "Add Alias To ->"
  const exactMatchIds = new Set(matchingEntities.map((e) => `${e.type}-${e.id}`))
  const partialMatches = entities
    .filter((e) => {
      if (e.type === 'quicknote') return false
      if (exactMatchIds.has(`${e.type}-${e.id}`)) return false

      const nameNorm = (e.name || '').toLowerCase()
      if (
        nameNorm.length > 3 &&
        (normalizedText.includes(nameNorm) || nameNorm.includes(normalizedText))
      ) {
        return true
      }

      if (e.aliases && Array.isArray(e.aliases)) {
        for (const al of e.aliases) {
          const alNorm = al.toLowerCase()
          if (
            alNorm.length > 3 &&
            (normalizedText.includes(alNorm) || alNorm.includes(normalizedText))
          ) {
            return true
          }
        }
      }
      return false
    })
    .slice(0, 5) // max 5 suggestions

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: adjustedPos?.x || position.x,
        top: adjustedPos?.y || position.y,
        visibility: adjustedPos ? 'visible' : 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Link to existing entity if match found ────── */}
      {matchingEntities.length > 0 && (
        <>
          <div className="context-menu-header">{t('contextMenu.linkToExisting', 'Link to Existing')}</div>
          {matchingEntities.map((e) => (
            <button
              key={`${e.type}-${e.id}`}
              className="context-menu-item"
              onClick={() => onLinkEntity(e)}
            >
              <span className="icon" style={{ color: `var(--entity-${e.type})` }}>
                {e.type === 'character' ? (
                  <Icons.User />
                ) : e.type === 'location' ? (
                  <Icons.MapPin />
                ) : (
                  <Icons.Gem />
                )}
              </span>
              {e.name}
              <span className="shortcut">{e.type}</span>
            </button>
          ))}
          <div className="context-menu-divider" />
        </>
      )}

      {/* ── Create New (Submenu) ─────────────────────── */}
      <div
        className={`context-menu-item has-submenu ${activeSubmenu === 'create' ? 'active' : ''}`}
        onMouseEnter={() => setActiveSubmenu('create')}
      >
        <span className="icon">
          <Icons.Plus />
        </span>
        {t('contextMenu.createNew', 'Create New')}
        <span className="chevron">
          <Icons.ChevronRight />
        </span>
        {activeSubmenu === 'create' && (
          <div
            className={`context-menu-submenu ${submenuLeft ? 'submenu-left' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="context-menu-item" onClick={() => onCreateEntity('character')}>
              <span className="icon" style={{ color: 'var(--entity-character)' }}>
                <Icons.User />
              </span>
              {t('contextMenu.createCharacter', 'Character:')} &quot;{displayText}&quot;
            </button>
            <button className="context-menu-item" onClick={() => onCreateEntity('lore')}>
              <span className="icon" style={{ color: 'var(--entity-item)' }}>
                <Icons.Gem />
              </span>
              {t('contextMenu.createLore', 'Item/Lore:')} &quot;{displayText}&quot;
            </button>
            <button className="context-menu-item" onClick={() => onCreateEntity('location')}>
              <span className="icon" style={{ color: 'var(--entity-location)' }}>
                <Icons.MapPin />
              </span>
              {t('contextMenu.createLocation', 'Location:')} &quot;{displayText}&quot;
            </button>
            <div className="context-menu-divider" />
            <button
              className="context-menu-item"
              onClick={() => onAction?.('customLore', { text: selectedText })}
            >
              <span className="icon">
                <Icons.Gem />
              </span>
              {t('contextMenu.custom', 'Custom...')}
            </button>
          </div>
        )}
      </div>

      {/* ── Add Alias To ───────────────────── */}
      {partialMatches.length > 0 ? (
        <div
          className={`context-menu-item has-submenu ${activeSubmenu === 'alias' ? 'active' : ''}`}
          onMouseEnter={() => setActiveSubmenu('alias')}
        >
          <span className="icon">
            <Icons.Link />
          </span>
          {t('contextMenu.addAliasTo', 'Add Alias To')}
          <span className="chevron">
            <Icons.ChevronRight />
          </span>
          {activeSubmenu === 'alias' && (
            <div
              className={`context-menu-submenu ${submenuLeft ? 'submenu-left' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="context-menu-header" style={{ marginBottom: '4px' }}>
                {t('contextMenu.matchesFound', 'Matches found')}
              </div>
              {partialMatches.map((e) => (
                <button
                  key={`alias-${e.type}-${e.id}`}
                  className="context-menu-item"
                  onClick={() => onAction?.('addAliasDirect', { text: selectedText, entity: e })}
                >
                  <span className="icon" style={{ color: `var(--entity-${e.type})` }}>
                    {e.type === 'character' ? (
                      <Icons.User />
                    ) : e.type === 'location' ? (
                      <Icons.MapPin />
                    ) : (
                      <Icons.Gem />
                    )}
                  </span>
                  {e.name}
                  <span className="shortcut">{e.type}</span>
                </button>
              ))}
              <div className="context-menu-divider" />
              <button
                className="context-menu-item"
                onClick={() => onAction?.('addAliasSearch', { text: selectedText })}
              >
                <span className="icon">
                  <Icons.Gem />
                </span>
                {t('contextMenu.search', 'Search...')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          className="context-menu-item"
          onClick={() => onAction?.('addAliasSearch', { text: selectedText })}
          onMouseEnter={() => setActiveSubmenu(null)}
        >
          <span className="icon">
            <Icons.Link />
          </span>
          {t('contextMenu.addAliasToEllipsis', 'Add Alias To...')}
        </button>
      )}

      {/* ── Append Description ───────────────────────── */}
      <button
        className="context-menu-item"
        onClick={() => onAction?.('appendDescription', { text: selectedText })}
        onMouseEnter={() => setActiveSubmenu(null)}
      >
        <span className="icon">
          <Icons.FileText />
        </span>
        {t('contextMenu.appendDescription', 'Append Description')}
      </button>

      {/* ── Make Connection ──────────────────────────── */}
      <button
        className="context-menu-item"
        onClick={() => onAction?.('makeConnection', { text: selectedText })}
        onMouseEnter={() => setActiveSubmenu(null)}
      >
        <span className="icon">
          <Icons.Link />
        </span>
        {t('contextMenu.makeConnection', 'Make Connection')}
      </button>

      {/* ── Tag as Foreshadowing ─────────────────────── */}
      <button
        className="context-menu-item"
        onClick={() => onAction?.('foreshadowing', { text: selectedText })}
        onMouseEnter={() => setActiveSubmenu(null)}
      >
        <span className="icon">
          <Icons.Shield />
        </span>
        {t('contextMenu.tagForeshadowing', 'Tag as Foreshadowing')}
      </button>

      {/* ── Set as POV (only if entity link is a character) ── */}
      {entityAtCursor && entityAtCursor.type === 'character' && (
        <button
          className="context-menu-item"
          onClick={() => onAction?.('setAsPov', { entityId: entityAtCursor.id })}
          onMouseEnter={() => setActiveSubmenu(null)}
        >
          <span className="icon" style={{ color: 'var(--accent-amber)' }}>
            <Icons.Eye />
          </span>
          {t('contextMenu.setPov', 'Set as POV')}
        </button>
      )}

      {/* ── Quick Note ──────────────────────────────── */}
      <button
        className="context-menu-item"
        onClick={() => onAction?.('quickNote', { text: selectedText })}
        onMouseEnter={() => setActiveSubmenu(null)}
      >
        <span className="icon">
          <Icons.Feather />
        </span>
        {t('contextMenu.quickNote', 'Quick Note')}
      </button>

      {/* ── Remove Entity Link ──────────────────────── */}
      {entityAtCursor && (
        <>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item danger"
            onClick={() => onAction?.('removeLink')}
            onMouseEnter={() => setActiveSubmenu(null)}
          >
            <span className="icon">
              <Icons.Unlink />
            </span>
            {t('contextMenu.removeLink', 'Remove Entity Link')}
          </button>
        </>
      )}
    </div>
  )
}
