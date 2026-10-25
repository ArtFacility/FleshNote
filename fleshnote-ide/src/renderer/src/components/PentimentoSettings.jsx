import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Writing-process (Pentimento) settings — capture on/off, Sealed Pentimento
 * verification, storage footprint, and the compaction / clear controls. Self-contained:
 * storage + compact + clear + receipts talk straight to the backend; the capture and
 * verification flags are project_config toggles owned by the parent modal.
 */
export default function PentimentoSettings({ projectPath, captureOn, onToggleCapture, historyOn, onToggleHistory, verificationOn, onToggleVerification, externalTsaOn, onToggleExternalTsa }) {
  const { t } = useTranslation()
  const [storage, setStorage] = useState(null)
  const [snapStorage, setSnapStorage] = useState(null)
  const [receipts, setReceipts] = useState(null)
  const [months, setMonths] = useState(6)
  const [keepPer, setKeepPer] = useState(20)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(() => {
    if (!projectPath) return
    window.api.pentimentoStorage({ project_path: projectPath }).then(setStorage).catch(() => setStorage(null))
    window.api.chapterHistoryStorage({ project_path: projectPath }).then(setSnapStorage).catch(() => setSnapStorage(null))
    window.api.pentimentoReceipts({ project_path: projectPath }).then(setReceipts).catch(() => setReceipts(null))
  }, [projectPath])

  useEffect(() => { refresh() }, [refresh])

  const handlePrune = async () => {
    setBusy(true); setMsg(null)
    try {
      const res = await window.api.chapterHistoryPrune({ project_path: projectPath, keep_per_chapter: keepPer })
      setMsg(t('pentimentoSettings.pruned', 'Removed {{n}} old version(s).', { n: res?.removed ?? 0 }))
      refresh()
    } catch { setMsg(t('pentimentoSettings.failed', 'Something went wrong.')) }
    finally { setBusy(false) }
  }

  const handleCompact = async () => {
    setBusy(true); setMsg(null)
    try {
      const res = await window.api.pentimentoCompact({ project_path: projectPath, older_than_days: months * 30 })
      setMsg(t('pentimentoSettings.compacted', 'Compacted {{n}} old session(s).', { n: res?.sessions_compacted ?? 0 }))
      refresh()
    } catch { setMsg(t('pentimentoSettings.failed', 'Something went wrong.')) }
    finally { setBusy(false) }
  }

  const handleClear = async () => {
    setBusy(true); setMsg(null); setConfirmClear(false)
    try {
      await window.api.pentimentoClear({ project_path: projectPath })
      setMsg(t('pentimentoSettings.cleared', 'Writing history cleared.'))
      refresh()
    } catch { setMsg(t('pentimentoSettings.failed', 'Something went wrong.')) }
    finally { setBusy(false) }
  }

  const mb = storage ? storage.estimated_mb : 0
  const ops = storage ? storage.op_count : 0

  return (
    <div className="settings-section">
      <h3>{t('pentimentoSettings.title', 'Writing Process (Pentimento)')}</h3>

      <div className="settings-card">
        <label className="checkbox-label">
          <input type="checkbox" checked={captureOn} onChange={onToggleCapture} />
          <div>
            <strong>{t('pentimentoSettings.capture', 'Capture writing process')}</strong>
            <p className="settings-desc">
              {t('pentimentoSettings.captureDesc', 'Record the effort behind each chapter — pauses, rewrites and pace — to power the Process heatmap and showcase. Coalesced, not keystroke-by-keystroke; a full novel stays in the low tens of MB.')}
            </p>
          </div>
        </label>
      </div>

      <div className="settings-card">
        <label className="checkbox-label">
          <input type="checkbox" checked={verificationOn} onChange={onToggleVerification} />
          <div>
            <strong>{t('pentimentoSettings.verification', 'Sealed Pentimento (proof of process)')}</strong>
            <p className="settings-desc">
              {t('pentimentoSettings.verificationDesc', 'Timestamps your writing history so it can be independently verified as human-made. Only 64-character hashes of the history leave this machine — never your text. Works offline; receipts anchor once a connection returns.')}
            </p>
          </div>
        </label>
        {verificationOn && (
          <>
            <label className="checkbox-label" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={externalTsaOn} onChange={onToggleExternalTsa} />
              <div>
                <strong>{t('pentimentoSettings.externalTsa', 'Independent external timestamp')}</strong>
                <p className="settings-desc">
                  {t('pentimentoSettings.externalTsaDesc', 'Also cross-signs each sealed hash with a public RFC 3161 timestamp authority as a second opinion.')}
                </p>
              </div>
            </label>
            <p className="settings-desc" style={{ marginTop: 8 }}>
              {t('pentimentoSettings.receiptStatus', 'Receipts: {{anchored}} anchored, {{pending}} pending, {{failed}} failed.', {
                anchored: receipts?.by_status?.anchored ?? 0,
                pending: receipts?.by_status?.pending ?? 0,
                failed: receipts?.by_status?.failed ?? 0,
              })}
            </p>
          </>
        )}
      </div>

      <div className="settings-card">
        <label className="checkbox-label">
          <input type="checkbox" checked={historyOn !== false} onChange={onToggleHistory} />
          <div>
            <strong>{t('pentimentoSettings.proseHistory', 'Keep version history (rollback)')}</strong>
            <p className="settings-desc">
              {t('pentimentoSettings.proseHistoryDesc', 'Save a restorable snapshot of each chapter at the end of every writing session, so you can rewind prose from the History panel. Stored compressed — a whole novel stays in the low tens of MB.')}
            </p>
          </div>
        </label>

        <div className="settings-card-header" style={{ marginTop: 10 }}>
          <strong>{t('pentimentoSettings.snapshotStorage', 'Version history storage')}</strong>
        </div>
        <p className="settings-desc">
          {t('pentimentoSettings.snapshotUsage', 'Currently using ~{{mb}} MB across {{n}} saved version(s).', {
            mb: snapStorage ? snapStorage.estimated_mb : 0,
            n: (snapStorage ? snapStorage.snapshot_count : 0).toLocaleString(),
          })}
        </p>
        <div className="settings-subfield" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}>{t('pentimentoSettings.keepPerChapter', 'Keep newest per chapter')}</label>
          <select value={keepPer} onChange={e => setKeepPer(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="import-btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={handlePrune}>
            {t('pentimentoSettings.prune', 'Prune')}
          </button>
        </div>
        <p className="settings-desc" style={{ marginTop: 6, opacity: 0.8 }}>
          {t('pentimentoSettings.pruneNote', 'Pruning keeps your newest auto-snapshots per chapter and never removes versions you pinned.')}
        </p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <strong>{t('pentimentoSettings.storage', 'History storage')}</strong>
        </div>
        <p className="settings-desc">
          {t('pentimentoSettings.usage', 'Currently using ~{{mb}} MB across {{ops}} recorded edits.', { mb, ops: ops.toLocaleString() })}
        </p>

        <div className="settings-subfield" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}>{t('pentimentoSettings.compactLabel', 'Compact history older than')}</label>
          <select value={months} onChange={e => setMonths(Number(e.target.value))}>
            <option value={3}>{t('pentimentoSettings.months3', '3 months')}</option>
            <option value={6}>{t('pentimentoSettings.months6', '6 months')}</option>
            <option value={12}>{t('pentimentoSettings.months12', '12 months')}</option>
            <option value={24}>{t('pentimentoSettings.months24', '24 months')}</option>
          </select>
          <button className="import-btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={handleCompact}>
            {t('pentimentoSettings.compact', 'Compact')}
          </button>
        </div>
        <p className="settings-desc" style={{ marginTop: 6, opacity: 0.8 }}>
          {t('pentimentoSettings.compactNote', 'Compacting keeps each chapter’s heatmap and its sealed receipt, but discards the detailed ops — so time-travel/rollback into that period is no longer possible.')}
        </p>

        <div className="settings-subfield" style={{ marginTop: 10 }}>
          {!confirmClear ? (
            <button className="import-btn secondary" style={{ padding: '5px 12px', fontSize: 12, color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }} disabled={busy} onClick={() => setConfirmClear(true)}>
              {t('pentimentoSettings.clear', 'Clear all writing history')}
            </button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('pentimentoSettings.clearConfirm', 'Delete all recorded process data? This can’t be undone.')}</span>
              <button className="import-btn" style={{ padding: '5px 12px', fontSize: 12, background: 'var(--accent-red)' }} disabled={busy} onClick={handleClear}>
                {t('pentimentoSettings.clearYes', 'Delete')}
              </button>
              <button className="import-btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={() => setConfirmClear(false)}>
                {t('pentimentoSettings.cancel', 'Cancel')}
              </button>
            </span>
          )}
        </div>

        {msg && <p className="settings-desc" style={{ marginTop: 8, color: 'var(--text-primary)' }}>{msg}</p>}
      </div>
    </div>
  )
}
