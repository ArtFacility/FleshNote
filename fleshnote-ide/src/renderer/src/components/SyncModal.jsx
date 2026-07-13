import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { diffLines } from '../utils/proseDiff'

const Icons = {
  FolderOpen: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Alert: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb300" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Back: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
}

// ── Prose helpers ────────────────────────────────────────────────────────────
// cleanProse + diffLines live in utils/proseDiff (shared with the History panel).

// Collapse per-field change rows into one entry per entity, so creating one character
// reads as a single "New — Sophia", not one line per column.
function groupEntityChanges(changes) {
  const byRow = new Map()
  for (const c of changes) {
    const key = `${c.table}:${c.row_id}`
    let g = byRow.get(key)
    if (!g) { g = { key, display_name: c.display_name, action: 'update', fields: [] }; byRow.set(key, g) }
    if (c.column === 'deleted' && String(c.value) === '1') g.action = 'delete'
    else if (c.action === 'create' && g.action !== 'delete') g.action = 'create'
    if (!['deleted', 'deleted_at'].includes(c.column)) g.fields.push(c.column)
  }
  return [...byRow.values()]
}

const humanizeFields = (fields) => [...new Set(fields)]
  .map(f => f.replace(/_/g, ' '))
  .slice(0, 4)
  .join(', ')

export default function SyncModal({ isOpen, onClose, projectPath, onSyncComplete }) {
  const { t } = useTranslation()
  const [remotePath, setRemotePath] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [resolutions, setResolutions] = useState({}) // chapter_id -> 'local' | 'remote' | 'merged'
  const [customTexts, setCustomTexts] = useState({}) // chapter_id -> raw md
  const [openConflict, setOpenConflict] = useState(null) // chapter_id
  const [showRaw, setShowRaw] = useState(false)

  if (!isOpen) return null

  // Reset everything so reopening always starts clean at the picker.
  const resetState = () => {
    setRemotePath(null); setLoading(false); setApplying(false); setError(null)
    setPreview(null); setResolutions({}); setCustomTexts({}); setOpenConflict(null); setShowRaw(false)
  }
  const handleClose = () => { resetState(); onClose() }
  const handleBack = () => {
    setRemotePath(null); setPreview(null); setError(null); setOpenConflict(null)
  }

  const handleSelectFolder = async () => {
    setError(null); setPreview(null)
    const folderPath = await window.api.selectFolder()
    if (!folderPath) return
    if (folderPath === projectPath) {
      setError(t('syncModal.sameFolderError', "That's this project's own folder — pick the copy from your other device."))
      return
    }
    setRemotePath(folderPath)
    setLoading(true)
    try {
      const data = await window.api.syncPreview({ local_path: projectPath, remote_path: folderPath })
      if (data.status === 'error') {
        setError(data.message)
        setRemotePath(null)
      } else {
        setPreview(data)
        const initRes = {}, initTxt = {}
        ;(data.prose_conflicts || []).forEach(c => { initRes[c.chapter_id] = 'local'; initTxt[c.chapter_id] = c.local_text })
        setResolutions(initRes); setCustomTexts(initTxt)
      }
    } catch (err) {
      setError(err.message || t('syncModal.previewFailed', 'Could not read the other copy.'))
      setRemotePath(null)
    } finally {
      setLoading(false)
    }
  }

  const handleApplySync = async () => {
    setApplying(true); setError(null)
    try {
      const finalResolutions = {}
      for (const chapId in resolutions) {
        const type = resolutions[chapId]
        finalResolutions[chapId] = (type === 'merged') ? (customTexts[chapId] ?? '') : type
      }
      const res = await window.api.syncApply({ local_path: projectPath, remote_path: remotePath, resolutions: finalResolutions })
      if (res.status === 'ok') {
        if (onSyncComplete) onSyncComplete()
        handleClose()
      } else {
        setError(res.message || t('syncModal.applyFailed', 'Could not apply the changes.'))
      }
    } catch (err) {
      setError(err.message || t('syncModal.applyError', 'Something went wrong while merging.'))
    } finally {
      setApplying(false)
    }
  }

  const setResolution = (chapId, type) => setResolutions(prev => ({ ...prev, [chapId]: type }))
  const setCustom = (chapId, text) => {
    setCustomTexts(prev => ({ ...prev, [chapId]: text }))
    setResolutions(prev => ({ ...prev, [chapId]: 'merged' }))
  }

  const nConflicts = preview?.prose_conflicts?.length || 0
  const nEntity = (preview?.summary?.entity_creates || 0) + (preview?.summary?.entity_updates || 0) + (preview?.summary?.entity_deletes || 0)
  const nProse = preview?.summary?.prose_takes_remote || 0
  const nothingToDo = preview && nEntity === 0 && nProse === 0 && nConflicts === 0

  // Friendly one-liner for a grouped entity change
  const describeChange = (g) => {
    if (g.action === 'create') return t('syncModal.added', 'New — {{name}}', { name: g.display_name })
    if (g.action === 'delete') return t('syncModal.removed', 'Removed — {{name}}', { name: g.display_name })
    const fields = humanizeFields(g.fields)
    return fields
      ? t('syncModal.changedFields', 'Updated {{name}} ({{fields}})', { name: g.display_name, fields })
      : t('syncModal.changedPlain', 'Updated {{name}}', { name: g.display_name })
  }
  const actionColor = (a) => a === 'create' ? '#00c853' : a === 'delete' ? '#ff5252' : '#ffb300'
  const groupedChanges = preview ? groupEntityChanges(preview.entity_changes) : []

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: '92vw', maxWidth: 1080, height: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 8 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-sans, inherit)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            {t('syncModal.title', 'Sync with another copy')}
          </h2>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Icons.X />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Picker */}
          {!remotePath && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
              <button className="import-landing-card" onClick={handleSelectFolder} style={{ width: '100%', maxWidth: 520, padding: 32 }}>
                <Icons.FolderOpen />
                <div className="import-card-label" style={{ marginTop: 12 }}>{t('syncModal.selectTarget', 'Choose the other copy of this project')}</div>
                <div className="import-card-desc">
                  {t('syncModal.selectTargetDesc', 'Pick the project folder from your other computer, drive or backup. FleshNote will compare it with this one and show you exactly what changed before anything is merged.')}
                </div>
              </button>
              {error && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#ff8a80', fontSize: 13, maxWidth: 520 }}>
                  <Icons.Alert /> <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('syncModal.analyzing', 'Comparing the two copies…')}</div>
            </div>
          )}

          {error && preview && (
            <div style={{ display: 'flex', gap: 12, background: 'rgba(255,82,82,0.1)', border: '1px solid #ff5252', borderRadius: 6, padding: 14, color: '#ff8a80', fontSize: 13 }}>
              <Icons.Alert /><div>{error}</div>
            </div>
          )}

          {preview && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, minHeight: 0 }}>

              {/* Context line + back */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="import-btn secondary" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12 }}>
                  <Icons.Back /> {t('syncModal.chooseDifferent', 'Choose a different folder')}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{remotePath}</span>
              </div>

              {nothingToDo && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{t('syncModal.upToDate', 'Everything is already in sync')}</div>
                  <div style={{ fontSize: 13 }}>{t('syncModal.upToDateDesc', 'These two copies match — there’s nothing to merge.')}</div>
                </div>
              )}

              {!nothingToDo && (
                <>
                  {/* Gentle summary */}
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {t('syncModal.summaryLine', 'From the other copy:')}{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{nEntity}</b> {t('syncModal.worldChanges', 'character & world changes')},{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{nProse}</b> {t('syncModal.chapterUpdates', 'chapter updates')}
                    {nConflicts > 0 && <>, {t('syncModal.and', 'and')} <b style={{ color: '#ffb300' }}>{nConflicts}</b> {t('syncModal.needChoice', 'that need your choice')}</>}.
                  </div>

                  {/* Conflicts first — they need attention */}
                  {nConflicts > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <h3 style={{ fontSize: 13, color: '#ffb300', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icons.Alert /> {t('syncModal.bothEdited', 'Chapters edited on both copies')}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {preview.prose_conflicts.map(conflict => {
                          const res = resolutions[conflict.chapter_id]
                          const isOpen = openConflict === conflict.chapter_id
                          return (
                            <div key={conflict.chapter_id} style={{ border: `1px solid ${isOpen ? '#ffb300' : 'var(--border-subtle)'}`, borderRadius: 6, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{conflict.title}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    {res === 'remote' ? t('syncModal.willUseTheirs', 'Will use the other copy’s version')
                                      : res === 'merged' ? t('syncModal.willUseMerged', 'Will use your edited version')
                                      : t('syncModal.willKeepMine', 'Will keep this copy’s version')}
                                  </div>
                                </div>
                                <button className="import-btn secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                                  onClick={() => { setOpenConflict(isOpen ? null : conflict.chapter_id); setShowRaw(false) }}>
                                  {isOpen ? t('syncModal.hide', 'Hide') : t('syncModal.compare', 'Compare')}
                                </button>
                              </div>

                              {isOpen && (
                                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                  {/* Choice buttons */}
                                  <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <button className={`import-btn ${res === 'local' ? '' : 'secondary'}`} style={{ fontSize: 12, padding: '6px 12px' }}
                                      onClick={() => setResolution(conflict.chapter_id, 'local')}>
                                      {t('syncModal.keepMine', 'Keep mine')}
                                    </button>
                                    <button className={`import-btn ${res === 'remote' ? '' : 'secondary'}`} style={{ fontSize: 12, padding: '6px 12px' }}
                                      onClick={() => setResolution(conflict.chapter_id, 'remote')}>
                                      {t('syncModal.useTheirs', 'Use theirs')}
                                    </button>
                                    <span style={{ flex: 1 }} />
                                    <button className="import-btn secondary" style={{ fontSize: 11, padding: '6px 10px' }}
                                      onClick={() => setShowRaw(v => !v)}>
                                      {showRaw ? t('syncModal.hideEditor', 'Hide manual edit') : t('syncModal.editManually', 'Edit manually')}
                                    </button>
                                  </div>

                                  {/* Readable diff */}
                                  <div style={{ padding: '4px 0', maxHeight: 320, overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', gap: 20, padding: '4px 16px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                      <span><span style={{ color: '#ff8a80' }}>−</span> {t('syncModal.onlyMine', 'only in yours')}</span>
                                      <span><span style={{ color: '#69f0ae' }}>+</span> {t('syncModal.onlyTheirs', 'only in theirs')}</span>
                                    </div>
                                    {diffLines(conflict.local_text, conflict.remote_text).map((line, k) => {
                                      if (line.text.trim() === '' && line.type === 'same') return <div key={k} style={{ height: 8 }} />
                                      const bg = line.type === 'add' ? 'rgba(105,240,174,0.10)' : line.type === 'del' ? 'rgba(255,138,128,0.10)' : 'transparent'
                                      const mark = line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '
                                      const col = line.type === 'add' ? '#69f0ae' : line.type === 'del' ? '#ff8a80' : 'var(--text-tertiary)'
                                      return (
                                        <div key={k} style={{ display: 'flex', gap: 10, padding: '2px 16px', background: bg }}>
                                          <span style={{ color: col, width: 10, flexShrink: 0, userSelect: 'none' }}>{mark}</span>
                                          <span style={{ fontSize: 14, lineHeight: 1.6, color: line.type === 'same' ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: line.type === 'del' ? 'line-through' : 'none', textDecorationColor: 'rgba(255,138,128,0.5)' }}>
                                            {line.text || ' '}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Optional raw manual merge (advanced) */}
                                  {showRaw && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12 }}>
                                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <button className="import-btn secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setCustom(conflict.chapter_id, conflict.local_text)}>{t('syncModal.startMine', 'Start from mine')}</button>
                                        <button className="import-btn secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setCustom(conflict.chapter_id, conflict.remote_text)}>{t('syncModal.startTheirs', 'Start from theirs')}</button>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{t('syncModal.rawWarning', 'Raw markup — entity links use {{…}} tags, keep them intact.')}</span>
                                      </div>
                                      <textarea
                                        value={customTexts[conflict.chapter_id] ?? ''}
                                        onChange={(e) => setCustom(conflict.chapter_id, e.target.value)}
                                        style={{ width: '100%', minHeight: 140, padding: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Chapter updates (clean takes) */}
                  {preview.prose_takes.filter(p => p.direction === 'remote_to_local').length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{t('syncModal.chapterUpdatesHead', 'Chapter updates from the other copy')}</h3>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                        {preview.prose_takes.filter(p => p.direction === 'remote_to_local').map((take, idx, arr) => (
                          <div key={take.chapter_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', fontSize: 14, color: 'var(--text-primary)' }}>
                            {take.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Entity changes */}
                  {groupedChanges.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{t('syncModal.worldChangesHead', 'Character & world changes')}</h3>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, maxHeight: 260, overflowY: 'auto' }}>
                        {groupedChanges.map((g, idx) => (
                          <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: idx < groupedChanges.length - 1 ? '1px solid var(--border-subtle)' : 'none', fontSize: 13.5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: actionColor(g.action), flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-primary)' }}>{describeChange(g)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {preview && !nothingToDo && nConflicts > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 'auto' }}>
              {t('syncModal.defaultHint', 'Unreviewed conflicts keep this copy’s version.')}
            </span>
          )}
          <button className="import-btn secondary" onClick={handleClose} disabled={applying}>
            {t('syncModal.cancel', 'Cancel')}
          </button>
          {preview && !loading && !nothingToDo && (
            <button className="import-btn" onClick={handleApplySync} disabled={applying}>
              {applying ? t('syncModal.syncing', 'Merging…') : t('syncModal.apply', 'Merge into this copy')}
            </button>
          )}
          {preview && nothingToDo && (
            <button className="import-btn" onClick={handleClose}>{t('syncModal.done', 'Done')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
