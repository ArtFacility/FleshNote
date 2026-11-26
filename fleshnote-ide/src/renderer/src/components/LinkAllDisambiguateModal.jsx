import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const ENTITY_DOT_COLORS = {
  character: 'var(--entity-character, #c4a74c)',
  location: 'var(--entity-location, #4caf76)',
  lore: 'var(--entity-lore, #9c6fc4)',
  group: 'var(--entity-group, #c4a74c)',
}

/**
 * Sequential disambiguation modal for Link All when a mention matches
 * multiple entities in the project.
 */
export default function LinkAllDisambiguateModal({
  isOpen,
  autoCount = 0,
  items = [],
  onComplete,
  onCancel,
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState([])
  const [skippedTerms, setSkippedTerms] = useState(() => new Set())

  useEffect(() => {
    if (isOpen) {
      setIndex(0)
      setChosen([])
      setSkippedTerms(new Set())
    }
  }, [isOpen, items])

  const advance = useCallback((nextIdx, nextChosen, nextSkipped) => {
    let cursor = nextIdx
    while (
      cursor < items.length &&
      nextSkipped.has((items[cursor].matched_text || '').toLowerCase())
    ) {
      cursor += 1
    }
    if (cursor >= items.length) {
      onComplete(nextChosen)
    } else {
      setIndex(cursor)
      setChosen(nextChosen)
      setSkippedTerms(nextSkipped)
    }
  }, [items, onComplete])

  const current = isOpen && index < items.length ? items[index] : null
  const candidates = current?.candidates || []

  const handleChoose = useCallback((candidate) => {
    if (!current || !candidate) return
    const nextChosen = [
      ...chosen,
      {
        char_offset: current.char_offset,
        matched_text: current.matched_text,
        entity_type: candidate.entity_type,
        entity_id: candidate.entity_id,
        entity_name: candidate.entity_name,
      },
    ]
    advance(index + 1, nextChosen, skippedTerms)
  }, [current, chosen, index, skippedTerms, advance])

  const handleSkip = useCallback(() => {
    advance(index + 1, chosen, skippedTerms)
  }, [index, chosen, skippedTerms, advance])

  const handleSkipAllTerm = useCallback(() => {
    if (!current) return
    const nextSkipped = new Set(skippedTerms)
    nextSkipped.add((current.matched_text || '').toLowerCase())
    advance(index + 1, chosen, nextSkipped)
  }, [current, skippedTerms, index, chosen, advance])

  useEffect(() => {
    if (!isOpen || !current) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (candidates[idx]) {
          e.preventDefault()
          e.stopPropagation()
          handleChoose(candidates[idx])
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        e.stopPropagation()
        handleSkip()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen, current, candidates, handleChoose, handleSkip, onCancel])

  if (!isOpen || !current) return null

  const currentTermLower = (current.matched_text || '').toLowerCase()
  const remainingItems = items
    .slice(index)
    .filter((it) => !skippedTerms.has((it.matched_text || '').toLowerCase()))
  const remaining = remainingItems.length
  const remainingSameTerm = remainingItems.filter(
    (it) => (it.matched_text || '').toLowerCase() === currentTermLower
  ).length

  const ctx = current.context || ''
  const hlStart = Math.max(0, current.context_highlight_start ?? 0)
  const hlEnd = Math.min(ctx.length, current.context_highlight_end ?? hlStart)
  const before = ctx.slice(0, hlStart)
  const highlight = ctx.slice(hlStart, hlEnd)
  const after = ctx.slice(hlEnd)

  return (
    <div className="popup-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div
        className="popup-panel janitor-disambig-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <span className="janitor-disambig-header-title">
            <span className="janitor-rune" style={{ marginInlineEnd: 6 }}>ᚠ</span>
            {t('janitor.disambiguateTitle', 'Disambiguate Entity Link')}
          </span>
          <div className="janitor-disambig-header-right">
            <span className="janitor-disambig-progress">
              {index + 1} / {items.length}
            </span>
            <button className="popup-close" onClick={onCancel} aria-label={t('ide.cancel', 'Cancel')}>
              &times;
            </button>
          </div>
        </div>

        <div className="popup-subtitle">
          <div>
            {t('janitor.disambiguatePrompt', 'Multiple entities match "{{term}}". Choose which one to link:', {
              term: current.matched_text,
            })}
          </div>
          {autoCount > 0 && (
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              {t('janitor.disambiguateAutoReady', '{{count}} unambiguous matches will also be linked.', {
                count: autoCount,
              })}
            </div>
          )}
        </div>

        <div className="janitor-disambig-body">
          {ctx && (
            <div className="janitor-context">
              {before && <span>{before}</span>}
              {highlight && <span className="janitor-context-highlight">{highlight}</span>}
              {after && <span>{after}</span>}
            </div>
          )}

          <div className="janitor-disambig-list">
            {candidates.map((c, idx) => (
              <button
                key={`${c.entity_type}-${c.entity_id}-${idx}`}
                type="button"
                className="popup-suggestion-item janitor-disambig-option"
                onClick={() => handleChoose(c)}
              >
                {idx < 9 && <span className="janitor-disambig-key">{idx + 1}</span>}
                <span
                  className="popup-entity-dot"
                  style={{ background: ENTITY_DOT_COLORS[c.entity_type] || 'var(--accent-amber)' }}
                />
                <span className="janitor-disambig-label">
                  <span className="popup-entity-name">{c.entity_name}</span>
                  {c.aliases?.length > 0 && (
                    <span className="janitor-disambig-aliases">
                      ({c.aliases.join(', ')})
                    </span>
                  )}
                </span>
                <span className="popup-entity-type">{c.entity_type}</span>
              </button>
            ))}
          </div>
          <div className="janitor-disambig-shortcuts">
            1–9 · S {t('janitor.skip', 'Skip')} · Esc {t('ide.cancel', 'Cancel')}
          </div>
        </div>

        <div className="popup-actions janitor-disambig-footer">
          <div className="janitor-disambig-footer-group">
            <button type="button" className="popup-btn cancel" onClick={handleSkip}>
              {t('janitor.skip', 'Skip')}
            </button>
            {remainingSameTerm > 1 && (
              <button type="button" className="popup-btn cancel" onClick={handleSkipAllTerm}>
                {t('janitor.skipAllTerm', 'Skip all "{{term}}"', { term: current.matched_text })}
              </button>
            )}
          </div>
          <div className="janitor-disambig-footer-group">
            <button type="button" className="popup-btn cancel" onClick={onCancel}>
              {t('ide.cancel', 'Cancel')}
            </button>
            {remaining > 1 && autoCount + chosen.length > 0 && (
              <button type="button" className="popup-btn save" onClick={() => onComplete(chosen)}>
                {t('janitor.skipRestApply', 'Skip rest & apply')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
