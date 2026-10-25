import { useTranslation } from 'react-i18next'
import OptionCard, { OptionIcons } from './OptionCard'

/**
 * Sync entry-point chooser. Opened from the header "Sync…" item; lets the user
 * pick how to sync — with a phone over the LAN (QR) or with another copy on
 * disk (folder) — then hands off to the matching modal. Keeps the two very
 * different flows in their own components while giving one unified entry point.
 */
export default function SyncChooserModal({ isOpen, onClose, onPickLocal, onPickMobile, onPickCloneSend, onPickCloneReceive }) {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal option-popup" onClick={(e) => e.stopPropagation()}>
        <div className="option-popup-head">
          <h2>{t('syncChooser.title', 'Sync project')}</h2>
          <button className="option-popup-icon-btn" onClick={onClose} aria-label={t('common.close', 'Close')} title={t('common.close', 'Close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="option-popup-body">
          <OptionCard autoFocus icon={OptionIcons.phone} onClick={onPickMobile}
            title={t('syncChooser.mobileTitle', 'Companion app (QR code)')}
            desc={t('syncChooser.mobileDesc', 'Pair your phone over the same Wi-Fi. Shows a QR code the app scans, then merges here.')} />
          <OptionCard icon={OptionIcons.folder} onClick={onPickLocal}
            title={t('syncChooser.localTitle', 'Local copy (folder)')}
            desc={t('syncChooser.localDesc', 'Merge with another copy of this project on disk — a synced folder or a copy from a USB drive.')} />

          <div className="option-popup-group">
            {t('syncChooser.transferGroup', 'First-time transfer (whole project, no merge)')}
          </div>

          <OptionCard icon={OptionIcons.up} onClick={onPickCloneSend}
            title={t('syncChooser.cloneSendTitle', 'Send this project to a phone')}
            desc={t('syncChooser.cloneSendDesc', 'Copy the whole project onto a phone that doesn’t have it yet.')} />
          <OptionCard icon={OptionIcons.down} onClick={onPickCloneReceive}
            title={t('syncChooser.cloneReceiveTitle', 'Receive a project from a phone')}
            desc={t('syncChooser.cloneReceiveDesc', 'Add a project a phone has but this device doesn’t. It lands next to your current one.')} />
        </div>
      </div>
    </div>
  )
}
