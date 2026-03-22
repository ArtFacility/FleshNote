import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/janitor.css'
import { matchesHotkey } from '../utils/hotkeyMatcher'

const RUNE_ICONS = {
  link_existing: 'ᚠ',
  create_entity: 'ᚢ',
  alias: 'ᚦ',
  typo: 'ᚱ',
  synonym: 'ᛋ',
  weak_adverbs: 'ᛗ',
  passive_voice: 'ᛈ',
  show_dont_tell: 'ᛚ',
  pacing: 'ᚫ',
  five_senses: 'ᛉ',
  readability: 'ᚾ',
}

const CARD_ACCENT = {
  link_existing_character: '#c4a74c',
  link_existing_location: '#4caf76',
  link_existing_lore: '#9c6fc4',
  link_existing_default: '#c4a74c',
  create_entity_character: '#4c8ec4',
  create_entity_location: '#4caf76',
  create_entity_lore: '#9c6fc4',
  create_entity_default: '#4c8ec4',
  alias: '#c4a74c',
  typo: '#ef4444',
  synonym: '#f43f5e',
  weak_adverbs: '#f97316',
  passive_voice: '#a855f7',
  show_dont_tell: '#fb923c',
  pacing: '#3b82f6',
  five_senses: '#14b8a6',
  readability: '#f59e0b',
}

function getAccent(suggestion) {
  if (suggestion.type === 'link_existing' || suggestion.type === 'create_entity') {
    const key = `${suggestion.type}_${suggestion.entity_type || 'default'}`
    return CARD_ACCENT[key] || CARD_ACCENT[`${suggestion.type}_default`]
  }
  return CARD_ACCENT[suggestion.type] || '#c4a74c'
}

function getDismissKey(projectPath, chapterId) {
  try {
    return `fn_janitor_dismissed_${btoa(projectPath.slice(-20))}_${chapterId}`
  } catch {
    return `fn_janitor_dismissed_${chapterId}`
  }
}

function ContextSnippet({ context, highlightStart, highlightEnd, onClick }) {
  const before = context.slice(0, highlightStart)
  const highlight = context.slice(highlightStart, highlightEnd)
  const after = context.slice(highlightEnd)
  return (
    <div className="janitor-context" onClick={onClick} title="Click to navigate">
      {before && <span>{before}</span>}
      {highlight && <span className="janitor-context-highlight">{highlight}</span>}
      {after && <span>{after}</span>}
    </div>
  )
}

export default function JanitorPanel({
  suggestions,
  isLoading,
  isCollapsed,
  onToggle,
  onDismiss,
  onAccept,
  onNavigate,
  chapterId,
  projectPath,
  projectConfig,
  autoFocusSignal,
  onReturnFocus,
  onActivity,
  hotkeys = { janitor_accept: 'y', janitor_dismiss: 'n' },
}) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Which suggestion types are enabled (default: all true)
  const enabledTypes = useMemo(() => {
    const cfg = projectConfig || {}
    return {
      link_existing: cfg.janitor_show_link_existing !== false,
      create_entity: cfg.janitor_show_create_entity !== false,
      alias: cfg.janitor_show_alias !== false,
      typo: cfg.janitor_show_typo !== false,
      synonym: cfg.janitor_show_synonym !== false,
      weak_adverbs: cfg.janitor_show_weak_adverbs !== false,
      passive_voice: cfg.janitor_show_passive_voice !== false,
      show_dont_tell: cfg.janitor_show_show_dont_tell !== false,
      pacing: cfg.janitor_show_pacing !== false,
      five_senses: cfg.janitor_show_five_senses !== false,
      readability: cfg.janitor_show_readability !== false,
    }
  }, [projectConfig])

  const dismissedIds = useMemo(() => {
    if (!projectPath || !chapterId) return new Set()
    const key = getDismissKey(projectPath, chapterId)
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      return new Set(stored.map(item => item.id))
    } catch {
      return new Set()
    }
  }, [projectPath, chapterId, suggestions])

  const visibleSuggestions = useMemo(
    () => suggestions.filter(s => !dismissedIds.has(s.id) && enabledTypes[s.type]),
    [suggestions, dismissedIds, enabledTypes]
  )

  // Auto-focus panel when Alt+J signal fires
  useEffect(() => {
    if (!autoFocusSignal) return
    setSelectedIndex(0)
    if (!isCollapsed && panelRef.current) {
      panelRef.current.focus()
    }
  }, [autoFocusSignal, isCollapsed])

  // Clamp selectedIndex when list shrinks
  useEffect(() => {
    if (visibleSuggestions.length > 0 && selectedIndex >= visibleSuggestions.length) {
      setSelectedIndex(visibleSuggestions.length - 1)
    }
  }, [visibleSuggestions.length, selectedIndex])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, visibleSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (matchesHotkey(e, hotkeys.janitor_accept)) {
      e.preventDefault()
      const s = visibleSuggestions[selectedIndex]
      if (s) onAccept(s)
    } else if (matchesHotkey(e, hotkeys.janitor_dismiss)) {
      e.preventDefault()
      const s = visibleSuggestions[selectedIndex]
      if (s) onDismiss(s)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onReturnFocus?.()
    }
  }, [visibleSuggestions, selectedIndex, onAccept, onDismiss, onReturnFocus, hotkeys])

  const acceptLabel = (type) => {
    switch (type) {
      case 'link_existing': return t('janitor.linkIt', 'Link It')
      case 'create_entity': return t('janitor.createIt', 'Create')
      case 'alias': return t('janitor.addAlias', 'Add Alias')
      case 'typo': return t('janitor.fixIt', 'Fix It')
      case 'synonym': return t('janitor.useSynonym', 'Replace')
      case 'weak_adverbs': return t('janitor.rewrite', 'Rewrite')
      case 'passive_voice': return t('janitor.rewrite', 'Rewrite')
      case 'show_dont_tell': return t('janitor.rewrite', 'Rewrite')
      case 'pacing': return t('janitor.edit', 'Edit')
      case 'five_senses': return t('janitor.noted', 'Noted')
      case 'readability': return t('janitor.noted', 'Noted')
      default: return t('janitor.accept', 'Accept')
    }
  }

  const typeLabel = (type) => {
    if (type === 'show_dont_tell') return t('janitor.types.show_dont_tell', "Show, Don't Tell")
    if (type === 'pacing') return t('janitor.types.pacing', 'Pacing & Rhythm')
    if (type === 'weak_adverbs') return t('janitor.types.weak_adverbs', 'Weak Adverbs')
    if (type === 'passive_voice') return t('janitor.types.passive_voice', 'Passive Voice')
    if (type === 'five_senses') return t('janitor.types.five_senses', 'Missing Senses')
    if (type === 'readability') return t('janitor.types.readability', 'Readability')
    return t(`janitor.types.${type}`, type)
  }

  const sdtSubLabel = (entityType) => {
    const map = {
      emotion_label: 'emotion label',
      filter_verb: 'filter verb',
      realize_verb: 'cognitive verb',
      adverb_emotion: 'emotion adverb',
    }
    return map[entityType] || entityType
  }

  return (
    <div
      ref={panelRef}
      className={`panel-right ${isCollapsed ? 'collapsed' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={onActivity}
      style={{ outline: 'none' }}
    >
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          <span className="janitor-rune" style={{ marginInlineEnd: 6 }}>𐲟</span>
          {t('janitor.title', 'The Janitor')}
        </span>
        <button
          className="ide-titlebar-btn"
          onClick={onToggle}
          title={t('janitor.toggleTitle', 'Toggle Janitor Panel')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="panel-content" style={{ overflowY: 'auto', padding: '8px' }}>
          {isLoading ? (
            <div className="janitor-scanning">
              <div className="janitor-scanning-dot" />
              {t('janitor.scanning', 'Scanning...')}
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div style={{
              padding: '16px 12px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textAlign: 'center',
              opacity: 0.6
            }}>
              {t('janitor.noSuggestions', 'All clean.')}
            </div>
          ) : (
            visibleSuggestions.map((s, idx) => {
              const accent = getAccent(s)
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={s.id}
                  className={`inbox-card${isSelected ? ' janitor-card-selected' : ''}`}
                  style={{ borderLeft: `3px solid ${accent}`, marginBottom: 8 }}
                  onClick={() => { setSelectedIndex(idx); onActivity?.() }}
                >
                  <div className="inbox-content">
                    {/* Card header: rune + type label */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                      <span className="janitor-rune" style={{ color: accent }}>
                        {RUNE_ICONS[s.type] || 'ᚠ'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: accent,
                        fontWeight: 600
                      }}>
                        {typeLabel(s.type)}
                        {s.type === 'show_dont_tell' && s.entity_type && ` — ${sdtSubLabel(s.entity_type)}`}
                        {s.type === 'readability' && s.entity_type && ` — ${s.entity_type.replace(/_/g, ' ')}`}
                        {s.type !== 'show_dont_tell' && s.type !== 'readability' && s.type !== 'five_senses' && s.entity_name && ` — ${s.entity_name}`}
                      </span>
                    </div>

                    {/* Advisory description for five_senses / readability */}
                    {s.type === 'five_senses' && (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {t('janitor.missingSensesDesc', 'Not present in this chapter:')} <span style={{ color: accent }}>{s.matched_text}</span>
                      </div>
                    )}
                    {s.type === 'readability' && (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {s.matched_text} — {t('janitor.readabilityDesc', 'See Stats → Senses for the full breakdown')}
                      </div>
                    )}

                    {/* Context snippet */}
                    {s.type !== 'five_senses' && s.type !== 'readability' && (
                      <ContextSnippet
                        context={s.context}
                        highlightStart={s.context_highlight_start}
                        highlightEnd={s.context_highlight_end}
                        onClick={() => onNavigate(s)}
                      />
                    )}

                    {/* Replacement preview for typo/synonym */}
                    {(s.type === 'typo' || s.type === 'synonym') && s.replacement && (
                      <div style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        marginBottom: 8
                      }}>
                        → <span style={{ color: accent }}>{s.replacement}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAccept(s) }}
                        style={{
                          flex: 1,
                          padding: '5px 0',
                          background: 'transparent',
                          border: `1px solid ${accent}`,
                          color: accent,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${accent}22` }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {acceptLabel(s.type)}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDismiss(s) }}
                        style={{
                          flex: 1,
                          padding: '5px 0',
                          background: 'transparent',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                      >
                        {t('janitor.dismiss', 'Dismiss')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
