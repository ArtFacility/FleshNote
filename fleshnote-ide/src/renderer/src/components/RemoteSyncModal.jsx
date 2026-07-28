import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import SyncDiffView from './SyncDiffView'

const Icons = {
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
  Check: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00c853" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
}

const POLL_MS = 2000

export default function RemoteSyncModal({ isOpen, onClose, projectPath, onSyncComplete }) {
  const { t } = useTranslation()

  // phase: starting | waiting | ready | applying | applied | done | error | expired
  const [phase, setPhase] = useState('starting')
  const [session, setSession] = useState(null) // { token, port, hosts, project_id, project_name, expires_at }
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [resolutions, setResolutions] = useState({})
  const [customTexts, setCustomTexts] = useState({})
  const [openConflict, setOpenConflict] = useState(null)
  const [showRaw, setShowRaw] = useState(false)
  const [remaining, setRemaining] = useState(null) // seconds left, for the countdown

  const pollRef = useRef(null)
  const tickRef = useRef(null)
  const startedRef = useRef(false)

  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }

  const resetState = () => {
    clearTimers()
    startedRef.current = false
    setPhase('starting'); setSession(null); setQrDataUrl(null); setError(null)
    setPreview(null); setResolutions({}); setCustomTexts({}); setOpenConflict(null); setShowRaw(false)
    setRemaining(null)
  }

  const handleClose = async (skipCancel) => {
    const tok = session?.token
    clearTimers()
    resetState()
    if (!skipCancel && tok) {
      try { await window.api.remoteSyncCancel({ token: tok }) } catch { /* best effort */ }
    }
    onClose()
  }

  // Start a session as soon as the modal opens.
  useEffect(() => {
    if (!isOpen || startedRef.current) return
    startedRef.current = true

    const start = async () => {
      try {
        const data = await window.api.remoteSyncStart({ project_path: projectPath })
        setSession(data)
        const payload = JSON.stringify({
          v: 1,
          token: data.token,
          hosts: data.hosts,
          port: data.port,
          project_id: data.project_id,
          project_name: data.project_name,
        })
        const url = await QRCode.toDataURL(payload, { margin: 1, width: 260 })
        setQrDataUrl(url)
        setPhase('waiting')
      } catch (err) {
        setError(err.message || t('remoteSyncModal.startFailed', 'Could not start a sync session.'))
        setPhase('error')
      }
    }
    start()

    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Countdown ticker
  useEffect(() => {
    if (!session?.expires_at) return
    tickRef.current = setInterval(() => {
      setRemaining(Math.max(0, Math.round(session.expires_at - Date.now() / 1000)))
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [session?.expires_at])

  // Poll status while waiting for the phone or waiting for it to finish downloading.
  useEffect(() => {
    if (!session?.token) return
    if (phase !== 'waiting' && phase !== 'applied') return

    const poll = async () => {
      try {
        const data = await window.api.remoteSyncStatus({ token: session.token })
        if (data.status === 'ready' && phase === 'waiting') {
          const p = await window.api.remoteSyncPreview({ token: session.token })
          setPreview(p)
          const initRes = {}, initTxt = {}
          ;(p.prose_conflicts || []).forEach(c => { initRes[c.chapter_id] = 'local'; initTxt[c.chapter_id] = c.local_text })
          setResolutions(initRes); setCustomTexts(initTxt)
          setPhase('ready')
        } else if (data.status === 'downloaded' && phase === 'applied') {
          setPhase('done')
          if (onSyncComplete) onSyncComplete()
        } else if (data.status === 'error') {
          setError(data.error || t('remoteSyncModal.genericError', 'Something went wrong during sync.'))
          setPhase('error')
        } else if (data.status === 'expired') {
          setPhase('expired')
        }
      } catch (err) {
        setError(err.message || t('remoteSyncModal.statusFailed', 'Lost contact with the sync session.'))
        setPhase('error')
      }
    }
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, phase])

  if (!isOpen) return null

  const setResolution = (chapId, type) => setResolutions(prev => ({ ...prev, [chapId]: type }))
  const setCustom = (chapId, text) => {
    setCustomTexts(prev => ({ ...prev, [chapId]: text }))
    setResolutions(prev => ({ ...prev, [chapId]: 'merged' }))
  }

  const nConflicts = preview?.prose_conflicts?.length || 0
  const nEntity = (preview?.summary?.entity_creates || 0) + (preview?.summary?.entity_updates || 0) + (preview?.summary?.entity_deletes || 0)
  const nProse = preview?.summary?.prose_takes_remote || 0
  const nothingToDo = preview && nEntity === 0 && nProse === 0 && nConflicts === 0

  const handleApply = async () => {
    setPhase('applying'); setError(null)
    try {
      const finalResolutions = {}
      for (const chapId in resolutions) {
        const type = resolutions[chapId]
        finalResolutions[chapId] = (type === 'merged') ? (customTexts[chapId] ?? '') : type
      }
      await window.api.remoteSyncApply({ token: session.token, resolutions: finalResolutions })
      setPhase('applied')
    } catch (err) {
      setError(err.message || t('remoteSyncModal.applyFailed', 'Could not apply the changes.'))
      setPhase('error')
    }
  }

  const mmss = (s) => {
    if (s == null) return '--:--'
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: '92vw', maxWidth: 1080, height: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 8 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-sans, inherit)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            {t('remoteSyncModal.title', 'Sync with companion app')}
          </h2>
          <button onClick={() => handleClose(phase === 'done')} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Icons.X />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {(phase === 'starting') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('remoteSyncModal.starting', 'Opening a sync session…')}</div>
            </div>
          )}

          {phase === 'waiting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR pairing code" width={260} height={260}
                  style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', padding: 8 }} />
              )}
              <div style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center' }}>
                {t('remoteSyncModal.scanPrompt', 'Scan this with the FleshNote companion app on your phone.')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 420 }}>
                {t('remoteSyncModal.sameNetwork', 'Both devices need to be on the same Wi-Fi network.')}
              </div>
              {session?.hosts?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {session.hosts.join(', ')}:{session.port}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('remoteSyncModal.expiresIn', 'Expires in {{time}}', { time: mmss(remaining) })}
              </div>
            </div>
          )}

          {(phase === 'ready' || phase === 'applying') && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, minHeight: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('remoteSyncModal.connectedFrom', 'Connected — reviewing changes from {{name}}', { name: session?.project_name || t('remoteSyncModal.yourPhone', 'your phone') })}
              </div>
              <SyncDiffView
                preview={preview}
                resolutions={resolutions}
                setResolution={setResolution}
                customTexts={customTexts}
                setCustom={setCustom}
                openConflict={openConflict}
                setOpenConflict={setOpenConflict}
                showRaw={showRaw}
                setShowRaw={setShowRaw}
              />
            </div>
          )}

          {phase === 'applied' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('remoteSyncModal.waitingForPhone', 'Merged on this copy — waiting for the phone to finish downloading…')}</div>
            </div>
          )}

          {phase === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10 }}>
              <Icons.Check />
              <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{t('remoteSyncModal.done', 'Sync complete')}</div>
              {nothingToDo
                ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('syncModal.upToDateDesc', 'These two copies match — there’s nothing to merge.')}</div>
                : <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('remoteSyncModal.doneDesc', 'Both copies are now in sync.')}</div>}
            </div>
          )}

          {phase === 'expired' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10 }}>
              <Icons.Alert />
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('remoteSyncModal.expired', 'This sync session expired before it finished.')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('remoteSyncModal.expiredDesc', 'Open this again to get a fresh code.')}</div>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ display: 'flex', gap: 12, background: 'rgba(255,82,82,0.1)', border: '1px solid #ff5252', borderRadius: 6, padding: 14, color: '#ff8a80', fontSize: 13, alignItems: 'center' }}>
              <Icons.Alert /><div>{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {phase === 'ready' && !nothingToDo && nConflicts > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 'auto' }}>
              {t('syncModal.defaultHint', 'Unreviewed conflicts keep this copy’s version.')}
            </span>
          )}
          <button className="import-btn secondary" onClick={() => handleClose(phase === 'done')}>
            {phase === 'done' ? t('syncModal.done', 'Done') : t('syncModal.cancel', 'Cancel')}
          </button>
          {phase === 'ready' && (
            <button className="import-btn" onClick={handleApply} disabled={nothingToDo}>
              {t('syncModal.apply', 'Merge into this copy')}
            </button>
          )}
          {phase === 'applying' && (
            <button className="import-btn" disabled>{t('syncModal.syncing', 'Merging…')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
