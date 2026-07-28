import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'

const POLL_MS = 2000

/**
 * First-time whole-project transfer over QR/LAN (no merge):
 *  - mode "send"    (desktop -> phone): serve this project; the phone scans and installs it.
 *  - mode "receive" (phone -> desktop): the phone scans and uploads a project; we register it.
 *
 * Distinct from RemoteSyncModal (which merges two copies that already share a project_id).
 */
export default function CloneModal({ isOpen, onClose, mode, projectPath, workspacePath, onCloneReceived }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('starting') // starting | waiting | done | error
  const [session, setSession] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [error, setError] = useState(null)
  const [clonedPath, setClonedPath] = useState(null)
  const pollRef = useRef(null)
  const startedRef = useRef(false)

  const clearTimers = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const reset = () => {
    clearTimers(); startedRef.current = false
    setPhase('starting'); setSession(null); setQrDataUrl(null); setError(null); setClonedPath(null)
  }

  const handleClose = async (skipCancel) => {
    const tok = session?.token
    clearTimers(); reset()
    if (!skipCancel && tok) { try { await window.api.remoteSyncCancel({ token: tok }) } catch { /* best effort */ } }
    onClose()
  }

  // Start the session when opened.
  useEffect(() => {
    if (!isOpen || startedRef.current) return
    startedRef.current = true
    const start = async () => {
      try {
        const data = mode === 'send'
          ? await window.api.cloneSendStart({ project_path: projectPath })
          : await window.api.cloneReceiveStart({ workspace_path: workspacePath })
        setSession(data)
        const payload = JSON.stringify({
          v: 1, token: data.token, hosts: data.hosts, port: data.port,
          project_id: data.project_id, project_name: data.project_name, mode: data.mode,
        })
        setQrDataUrl(await QRCode.toDataURL(payload, { margin: 1, width: 260 }))
        setPhase('waiting')
      } catch (err) {
        setError(err.message || t('cloneModal.startFailed', 'Could not start the transfer.'))
        setPhase('error')
      }
    }
    start()
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Poll until the phone finishes.
  useEffect(() => {
    if (!session?.token || phase !== 'waiting') return
    const poll = async () => {
      try {
        const data = await window.api.remoteSyncStatus({ token: session.token })
        const finished = mode === 'send'
          ? data.status === 'downloaded'
          : (data.status === 'applied' || data.status === 'downloaded')
        if (finished) {
          if (mode === 'receive' && data.cloned_project_path) setClonedPath(data.cloned_project_path)
          setPhase('done')
        } else if (data.status === 'error') {
          setError(data.error || t('cloneModal.genericError', 'The transfer failed.')); setPhase('error')
        } else if (data.status === 'expired') {
          setError(t('cloneModal.expired', 'The transfer session expired.')); setPhase('error')
        }
      } catch (err) {
        setError(err.message || t('cloneModal.statusFailed', 'Lost contact with the session.')); setPhase('error')
      }
    }
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, phase])

  if (!isOpen) return null

  const title = mode === 'send'
    ? t('cloneModal.sendTitle', 'Send project to phone')
    : t('cloneModal.receiveTitle', 'Receive project from phone')
  const scanPrompt = mode === 'send'
    ? t('cloneModal.sendPrompt', 'In the companion app, tap “Receive project” and scan this code.')
    : t('cloneModal.receivePrompt', 'In the companion app, open the project and tap Sync → With the desktop, then scan this.')

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: '92vw', maxWidth: 520, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{title}</h2>
          <button onClick={() => handleClose(phase === 'done')} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 320, justifyContent: 'center' }}>
          {phase === 'starting' && (
            <div style={{ width: 28, height: 28, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          )}

          {phase === 'waiting' && (
            <>
              {qrDataUrl && <img src={qrDataUrl} alt="QR pairing code" width={260} height={260} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', padding: 8 }} />}
              <div style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center' }}>{scanPrompt}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>{t('cloneModal.sameNetwork', 'Both devices need to be on the same Wi-Fi network.')}</div>
              {session?.hosts?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{session.hosts.join(', ')}:{session.port}</div>
              )}
            </>
          )}

          {phase === 'done' && (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00c853" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
              <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>{t('cloneModal.done', 'Transfer complete')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                {mode === 'send'
                  ? t('cloneModal.sentDesc', 'The project is now on your phone.')
                  : t('cloneModal.receivedDesc', 'The project was added to this device.')}
              </div>
            </>
          )}

          {phase === 'error' && (
            <div style={{ display: 'flex', gap: 12, background: 'rgba(255,82,82,0.1)', border: '1px solid #ff5252', borderRadius: 6, padding: 14, color: '#ff8a80', fontSize: 13, alignItems: 'center' }}>{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
          {phase === 'done' && mode === 'receive' && clonedPath && onCloneReceived && (
            <button className="import-btn" onClick={() => { onCloneReceived(clonedPath); handleClose(true) }}>
              {t('cloneModal.openProject', 'Open project')}
            </button>
          )}
          <button className="import-btn secondary" onClick={() => handleClose(phase === 'done')}>
            {phase === 'done' ? t('syncModal.done', 'Done') : t('syncModal.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
