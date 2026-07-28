import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SyncDiffView from './SyncDiffView'

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
