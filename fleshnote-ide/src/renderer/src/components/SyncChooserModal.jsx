import { useTranslation } from 'react-i18next'

/**
 * Sync entry-point chooser. Opened from the header "Sync…" item; lets the user
 * pick how to sync — with a phone over the LAN (QR) or with another copy on
 * disk (folder) — then hands off to the matching modal. Keeps the two very
 * different flows in their own components while giving one unified entry point.
 */
export default function SyncChooserModal({ isOpen, onClose, onPickLocal, onPickMobile, onPickCloneSend, onPickCloneReceive }) {
  const { t } = useTranslation()
  if (!isOpen) return null

  const Card = ({ icon, title, desc, onClick }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left',
        padding: '18px 18px', background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer',
        color: 'var(--text-primary)', width: '100%', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent, #ffb300)'; e.currentTarget.style.background = 'var(--bg-elevated, var(--bg-surface))' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
    >
      <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent, #ffb300)' }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </button>
  )

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '92vw', maxWidth: 460, padding: 0, overflow: 'hidden', borderRadius: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            {t('syncChooser.title', 'Sync project')}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            onClick={onPickMobile}
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            )}
            title={t('syncChooser.mobileTitle', 'Companion app (QR code)')}
            desc={t('syncChooser.mobileDesc', 'Pair your phone over the same Wi-Fi. Shows a QR code the app scans, then merges here.')}
          />
          <Card
            onClick={onPickLocal}
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            )}
            title={t('syncChooser.localTitle', 'Local copy (folder)')}
            desc={t('syncChooser.localDesc', 'Merge with another copy of this project on disk — a synced folder or a copy from a USB drive.')}
          />

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            {t('syncChooser.transferGroup', 'First-time transfer (whole project, no merge)')}
          </div>

          <Card
            onClick={onPickCloneSend}
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
              </svg>
            )}
            title={t('syncChooser.cloneSendTitle', 'Send this project to a phone')}
            desc={t('syncChooser.cloneSendDesc', 'Copy the whole project onto a phone that doesn’t have it yet.')}
          />
          <Card
            onClick={onPickCloneReceive}
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 5v14" /><path d="m5 12 7 7 7-7" />
              </svg>
            )}
            title={t('syncChooser.cloneReceiveTitle', 'Receive a project from a phone')}
            desc={t('syncChooser.cloneReceiveDesc', 'Add a project a phone has but this device doesn’t. It lands next to your current one.')}
          />
        </div>
      </div>
    </div>
  )
}
