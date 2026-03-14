import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'

const POS_MAP = { n: 'noun', v: 'verb', a: 'adj', r: 'adv', s: 'adj' }

export default function SynonymPopup({
  word,
  position,
  synonymGroups,
  loading,
  error,
  onSelect,
  onClose
}) {
  const { t } = useTranslation()
  const menuRef = useRef(null)
  const [adjustedPos, setAdjustedPos] = useState(null)

  // Viewport bounds adjustment (same pattern as EntityContextMenu.jsx)
  useLayoutEffect(() => {
    if (menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect()
      let { x, y } = position

      if (x + rect.width > window.innerWidth) {
        x = window.innerWidth - rect.width - 8
      }
      if (x < 8) x = 8

      if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - 8
      }
      if (y < 8) y = 8

      setAdjustedPos({ x, y })
    }
  }, [position, synonymGroups, loading])

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = () => onClose()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="synonym-popup"
      style={{
        left: adjustedPos?.x ?? position.x,
        top: adjustedPos?.y ?? position.y,
        visibility: adjustedPos ? 'visible' : 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="synonym-popup-header">
        <span>{t('synonym.title', 'Synonyms')}</span>
        <span className="synonym-popup-word">{word}</span>
        <button className="popup-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="synonym-popup-body">
        {loading && (
          <div className="synonym-popup-loading">
            {t('synonym.loading', 'Looking up...')}
          </div>
        )}

        {error && (
          <div className="synonym-popup-empty">
            {t('synonym.error', 'Failed to load synonyms.')}
          </div>
        )}

        {!loading && !error && synonymGroups.length === 0 && (
          <div className="synonym-popup-empty">
            {t('synonym.noResults', 'No synonyms found.')}
          </div>
        )}

        {synonymGroups.map((group, gi) => (
          <div key={gi} className="synonym-group">
            <div className="synonym-group-header">
              <span className="synonym-pos">
                {t(`synonym.pos.${POS_MAP[group.pos]}`, POS_MAP[group.pos] || group.pos)}
              </span>
              <span className="synonym-definition">{group.definition}</span>
            </div>
            <div className="synonym-items">
              {group.synonyms.map((syn, si) => (
                <button
                  key={si}
                  className="synonym-item"
                  onClick={() => onSelect(syn)}
                >
                  {syn}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="synonym-popup-footer">
        <button className="synonym-dismiss" onClick={onClose}>
          {t('synonym.dismiss', 'Dismiss')}
        </button>
      </div>
    </div>
  )
}
