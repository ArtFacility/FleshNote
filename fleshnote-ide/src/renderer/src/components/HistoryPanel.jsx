import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { diffLines } from '../utils/proseDiff'

/**
 * HistoryPanel — prose rollback ("Edit History"). A right-side panel mirroring JanitorPanel
 * (.panel-right, 300px → width 0 when collapsed). Shows a timeline of prose snapshots for the
 * active chapter (auto-taken per writing session, manual pins, pre-restore safety copies),
 * with a diff preview vs the current text and a two-step Restore. Restoring swaps the editor
 * content via onRestored and always leaves a 'pre_restore' snapshot so it can be undone.
 */

function fmtDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

const KIND_ACCENT = { session: '#3fa093', manual: 'var(--accent-amber)', pre_restore: 'var(--text-tertiary)' }

export default function HistoryPanel({
  projectPath, activeChapter, isCollapsed, onToggle, onRestored, onBeforeSnapshot,
}) {
  const { t, i18n } = useTranslation()
  const chapterId = activeChapter?.id || null

  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentHtml, setCurrentHtml] = useState('')
  const [openId, setOpenId] = useState(null)          // snapshot being previewed
  const [previewHtml, setPreviewHtml] = useState(null)
  const [confirmId, setConfirmId] = useState(null)     // snapshot awaiting restore confirm
  const [pinLabel, setPinLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const [hoveredDiff, setHoveredDiff] = useState(null)
  const hoverTimeoutRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const handleDiffMouseEnter = useCallback((e, cur, prev, label) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredDiff(prevHover => {
      if (prevHover) {
        return { rect, currentHtml: cur, snapshotHtml: prev, label }
      }
      
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredDiff({ rect, currentHtml: cur, snapshotHtml: prev, label })
      }, 500)
      
      return null
    })
  }, [])

  const handleDiffMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredDiff(null)
    }, 200)
  }, [])

  const refresh = useCallback(async () => {
    if (!projectPath || !chapterId) { setSnapshots([]); return }
    setLoading(true)
    try {
      const [list, content] = await Promise.all([
        window.api.chapterHistoryList({ project_path: projectPath, chapter_id: chapterId }),
        window.api.loadChapterContent(projectPath, chapterId),
      ])
      setSnapshots(list?.snapshots || [])
      setCurrentHtml(content?.content || '')
    } catch {
      setSnapshots([])
    } finally {
      setLoading(false)
    }
  }, [projectPath, chapterId])

  // Load when the panel is open on a chapter; reset transient UI on chapter change.
  useEffect(() => {
    setOpenId(null); setPreviewHtml(null); setConfirmId(null); setMsg(null)
    if (!isCollapsed) refresh()
  }, [isCollapsed, chapterId, refresh])

  const kindLabel = useCallback((s) => {
    if (s.kind === 'manual') return s.label ? `${t('history.pinned', 'Pinned')} · ${s.label}` : t('history.pinned', 'Pinned')
    if (s.kind === 'pre_restore') return t('history.beforeRestore', 'Before restore')
    return s.session_num
      ? t('history.session', 'Session {{n}}', { n: s.session_num })
      : t('history.autosnapshot', 'Session')
  }, [t])

  const handlePreview = useCallback(async (s) => {
    if (openId === s.id) { setOpenId(null); setPreviewHtml(null); return }
    setOpenId(s.id); setPreviewHtml(null); setConfirmId(null)
    try {
      const res = await window.api.chapterHistoryPreview({ project_path: projectPath, snapshot_id: s.id })
      setPreviewHtml(res?.content_html || '')
    } catch { setPreviewHtml('') }
  }, [openId, projectPath])

  const handlePin = useCallback(async () => {
    setBusy(true); setMsg(null)
    try {
      await onBeforeSnapshot?.()   // flush the editor's pending save so the pin captures the latest text
      await window.api.chapterHistoryPin({
        project_path: projectPath, chapter_id: chapterId, label: pinLabel.trim() || null,
      })
      setPinLabel('')
      setMsg(t('history.pinnedDone', 'Version pinned.'))
      refresh()
    } catch { setMsg(t('history.failed', 'Something went wrong.')) }
    finally { setBusy(false) }
  }, [projectPath, chapterId, pinLabel, refresh, t, onBeforeSnapshot])

  const handleRestore = useCallback(async (s) => {
    setBusy(true); setMsg(null); setConfirmId(null)
    try {
      await onBeforeSnapshot?.()   // flush pending save so the pre-restore safety snapshot holds the true current text
      const res = await window.api.chapterHistoryRestore({ project_path: projectPath, snapshot_id: s.id })
      if (res?.content_html != null) {
        onRestored?.(res.content_html, res.word_count || 0, res.chapter_id || chapterId)
        setMsg(t('history.restored', 'Restored. The previous text is saved as “Before restore”.'))
        setOpenId(null); setPreviewHtml(null)
        refresh()
      } else {
        setMsg(t('history.failed', 'Something went wrong.'))
      }
    } catch { setMsg(t('history.failed', 'Something went wrong.')) }
    finally { setBusy(false) }
  }, [projectPath, chapterId, onRestored, refresh, t, onBeforeSnapshot])

  return (
    <div className={`panel-right ${isCollapsed ? 'collapsed' : ''}`} style={{ outline: 'none' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          <span style={{ marginInlineEnd: 6 }}>◷</span>
          {t('history.title', 'History')}
        </span>
        <button className="ide-titlebar-btn" onClick={onToggle} title={t('history.toggleTitle', 'Toggle History Panel')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={isCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="panel-content" style={{ overflowY: 'auto', padding: '10px' }}>
          {!chapterId ? (
            <div style={emptyStyle}>{t('history.pickChapter', 'Open a chapter to see its history.')}</div>
          ) : (
            <>
              {/* Pin current version */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  value={pinLabel}
                  onChange={e => setPinLabel(e.target.value)}
                  placeholder={t('history.pinPlaceholder', 'Label (optional)')}
                  style={{ flex: 1, minWidth: 0, padding: '5px 8px', fontSize: 11, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
                />
                <button className="import-btn secondary" style={{ padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap' }} disabled={busy} onClick={handlePin}>
                  {t('history.pin', 'Pin current')}
                </button>
              </div>

              {msg && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{msg}</div>}

              {loading && <div style={emptyStyle}>{t('history.loading', 'Loading history…')}</div>}
              {!loading && snapshots.length === 0 && (
                <div style={emptyStyle}>{t('history.empty', 'No saved versions yet. A version is kept each time you finish a writing session, or when you pin one.')}</div>
              )}

              {!loading && snapshots.map((s, i) => {
                const older = snapshots[i + 1]
                const delta = older ? (s.word_count - older.word_count) : null
                const accent = KIND_ACCENT[s.kind] || 'var(--text-tertiary)'
                const isOpen = openId === s.id
                return (
                  <div key={s.id} className="inbox-card" style={{ borderInlineStart: `3px solid ${accent}`, marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '9px 11px', cursor: 'pointer' }} onClick={() => handlePreview(s)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: accent, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {kindLabel(s)}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{fmtDateTime(s.created_at)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {(s.word_count || 0).toLocaleString()} {t('history.words', 'words')}
                        </span>
                        {delta != null && delta !== 0 && (
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: delta > 0 ? '#69f0ae' : '#ff8a80' }}>
                            {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div
                          style={{ padding: '6px 11px', maxHeight: 220, overflowY: 'auto', cursor: 'help' }}
                          onMouseEnter={(e) => handleDiffMouseEnter(e, currentHtml, previewHtml, kindLabel(s))}
                          onMouseLeave={handleDiffMouseLeave}
                        >
                          {previewHtml == null ? (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('history.loadingPreview', 'Loading…')}</div>
                          ) : (
                            <DiffView currentHtml={currentHtml} snapshotHtml={previewHtml} t={t} />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderTop: '1px solid var(--border-subtle)' }}>
                          {confirmId === s.id ? (
                            <>
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)', flex: 1 }}>{t('history.restoreConfirm', 'Replace the current text with this version?')}</span>
                              <button className="import-btn" style={{ padding: '4px 10px', fontSize: 11, background: 'var(--accent-amber)', color: '#1a1508' }} disabled={busy} onClick={() => handleRestore(s)}>
                                {t('history.restoreYes', 'Restore')}
                              </button>
                              <button className="import-btn secondary" style={{ padding: '4px 10px', fontSize: 11 }} disabled={busy} onClick={() => setConfirmId(null)}>
                                {t('history.cancel', 'Cancel')}
                              </button>
                            </>
                          ) : (
                            <button className="import-btn secondary" style={{ padding: '4px 12px', fontSize: 11, marginInlineStart: 'auto' }} disabled={busy} onClick={() => setConfirmId(s.id)}>
                              {t('history.restore', 'Restore this version')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      {hoveredDiff && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(20, Math.min(hoveredDiff.rect.top, window.innerHeight - 470)),
            left: Math.max(
              10,
              Math.min(
                window.innerWidth - 510 - 10,
                i18n?.dir() === 'rtl'
                  ? hoveredDiff.rect.right + 12
                  : hoveredDiff.rect.left - 500 - 12
              )
            ),
            width: 500,
            maxHeight: 450,
            background: 'var(--bg-surface, #1e222d)',
            border: '1px solid var(--border-subtle, #323846)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
            borderRadius: 6,
            padding: 16,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          }}
          onMouseLeave={handleDiffMouseLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle, #323846)', paddingBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-amber)', fontWeight: 600 }}>
              {t('history.diffPreview', 'Full Diff Preview')}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {hoveredDiff.label}
            </span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            <DiffView currentHtml={hoveredDiff.currentHtml} snapshotHtml={hoveredDiff.snapshotHtml} t={t} />
          </div>
        </div>
      )}
    </div>
  )
}

const emptyStyle = { padding: '14px 8px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, textAlign: 'center', opacity: 0.75 }

// Line diff: what restoring would change. '−' lines are in the current text but not this
// version (would be removed); '+' lines are in this version but not current (would return).
function DiffView({ currentHtml, snapshotHtml, t }) {
  const lines = useMemo(() => diffLines(currentHtml, snapshotHtml), [currentHtml, snapshotHtml])
  const changed = lines.some(l => l.type !== 'same')
  if (!changed) {
    return <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('history.identical', 'Identical to the current text.')}</div>
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 4, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        <span><span style={{ color: '#ff8a80' }}>−</span> {t('history.nowText', 'current')}</span>
        <span><span style={{ color: '#69f0ae' }}>+</span> {t('history.thisVersion', 'this version')}</span>
      </div>
      {lines.map((line, k) => {
        if (line.text.trim() === '' && line.type === 'same') return <div key={k} style={{ height: 6 }} />
        const col = line.type === 'add' ? '#69f0ae' : line.type === 'del' ? '#ff8a80' : 'var(--text-tertiary)'
        const mark = line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '
        const bg = line.type === 'add' ? 'rgba(105,240,174,0.08)' : line.type === 'del' ? 'rgba(255,138,128,0.08)' : 'transparent'
        return (
          <div key={k} style={{ display: 'flex', gap: 8, padding: '1px 2px', background: bg }}>
            <span style={{ color: col, width: 9, flexShrink: 0, userSelect: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{mark}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: line.type === 'same' ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: line.type === 'del' ? 'line-through' : 'none', textDecorationColor: 'rgba(255,138,128,0.5)' }}>
              {line.text || ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}
