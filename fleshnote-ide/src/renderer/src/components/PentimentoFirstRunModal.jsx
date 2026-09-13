import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setVerificationDefault, applyToProject, externalTsaOn, setExternalTsa, getTsaUrl } from '../utils/pentimentoVerification'

export default function PentimentoFirstRunModal({ projects = [], onClose }) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState(null) // null | true | false
  const [busy, setBusy] = useState(false)

  const decide = async (on) => {
    setBusy(true)
    setVerificationDefault(on)
    // Carry the external-TSA default along on first decision
    setExternalTsa(externalTsaOn())
    const targets = projects.map(p => p.path)
    for (const p of targets) {
      await applyToProject(p)
    }
    setBusy(false)
    onClose()
  }

  return (
    <div className="popup-overlay" style={{ zIndex: 10001 }}>
      <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 480, display: 'flex', flexDirection: 'column' }}>
        <div className="popup-header" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--accent-amber)' }}>{t('pentimento.firstRunTitle', 'Sealed Pentimento — Prove Your Process')}</span>
          <button className="popup-close" onClick={() => decide(false)} disabled={busy}>&times;</button>
        </div>
        <div style={{ paddingInline: '20px', paddingBottom: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
            {t('pentimento.firstRunIntro', 'FleshNote records how your chapters were written (typing rhythm, revisions, sessions) locally, so you can prove a manuscript was human-crafted.')}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {t('pentimento.firstRunPrivacy', 'Only cryptographic hashes of your writing history ever leave this machine — never your text.')}
            </strong>
          </p>
          <ul style={{ margin: '0 0 20px 0', paddingInlineStart: '18px', color: 'var(--text-tertiary)', fontSize: '12px', lineHeight: 1.7 }}>
            <li>{t('pentimento.firstRunPoint1', 'Hashes are blind: no one can reconstruct your manuscript from them.')}</li>
            <li>{t('pentimento.firstRunPoint2', 'Free, optional, and can be turned off anytime in Settings.')}</li>
            <li>{t('pentimento.firstRunPoint3', 'Your writing keeps working offline — receipts sync when a connection returns.')}</li>
          </ul>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              disabled={busy}
              onClick={() => decide(true)}
              style={{
                flex: 1, padding: '12px', backgroundColor: 'var(--accent-amber)', color: 'var(--bg-deep)',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px',
                fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {t('pentimento.firstRunEnable', 'Enable (Recommended)')}
            </button>
            <button
              disabled={busy}
              onClick={() => decide(false)}
              style={{
                flex: 1, padding: '12px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {t('pentimento.firstRunDecline', 'Keep Fully Offline')}
            </button>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', margin: '14px 0 0 0', fontFamily: 'var(--font-mono)' }}>
            {t('pentimento.firstRunCustomNote', 'Endpoint in use: {{url}}', { url: getTsaUrl() })}
          </p>
        </div>
      </div>
    </div>
  )
}
