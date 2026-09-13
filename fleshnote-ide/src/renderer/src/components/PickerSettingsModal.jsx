import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  verificationOn, setVerificationDefault, externalTsaOn, setExternalTsa,
  getTsaUrl, setTsaUrl, applyToProject, DEFAULT_TSA_URL
} from '../utils/pentimentoVerification'

const DYSLEXIA_KEY = 'fn_dyslexia_mode'

function readDyslexia() {
  try { return localStorage.getItem(DYSLEXIA_KEY) === 'true' } catch { return false }
}

function writeDyslexia(on) {
  try { localStorage.setItem(DYSLEXIA_KEY, on ? 'true' : 'false') } catch { /* noop */ }
  if (on) document.body.classList.add('dyslexia-mode')
  else document.body.classList.remove('dyslexia-mode')
  // App.jsx re-reads and re-applies (keeps the legacy per-project fallback honest)
  window.dispatchEvent(new Event('fn:appsettings-changed'))
}

export default function PickerSettingsModal({ projects = [], onClose }) {
  const { t } = useTranslation()
  const [verified, setVerified] = useState(verificationOn())
  const [external, setExternal] = useState(externalTsaOn())
  const [tsaUrl, setTsaUrlState] = useState(getTsaUrl())
  const [dyslexia, setDyslexia] = useState(readDyslexia())
  const [saved, setSaved] = useState(false)

  // Toggle applies immediately to every project found in the workspace
  useEffect(() => {
    if (!saved) return
    let cancelled = false
    ;(async () => {
      for (const p of projects) {
        if (cancelled) return
        await applyToProject(p.path)
      }
    })()
    return () => { cancelled = true }
  }, [verified, external, tsaUrl, saved, projects])

  const toggleVerified = () => {
    const next = !verified
    setVerified(next)
    setVerificationDefault(next)
    setSaved(true)
  }

  const toggleExternal = () => {
    const next = !external
    setExternal(next)
    setExternalTsa(next)
    setSaved(true)
  }

  const commitUrl = (value) => {
    setTsaUrl(value)
    setTsaUrlState(getTsaUrl())
    setSaved(true)
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="popup-header" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--accent-amber)' }}>{t('picker.settingsTitle', 'Settings')}</span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ overflowY: 'auto', paddingInline: '20px', paddingBottom: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ── General / Accessibility (app-level) ── */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              {t('picker.generalSection', 'General')}
            </h3>
            <ToggleRow
              label={t('settings.dyslexiaMode', 'OpenDyslexic Font Mode')}
              desc={t('settings.dyslexiaModeDesc', 'Override all fonts with OpenDyslexic to improve readability for some users.')}
              on={dyslexia}
              onToggle={() => { const next = !dyslexia; setDyslexia(next); writeDyslexia(next) }}
              t={t}
            />
          </section>

          {/* ── Sealed Pentimento ── */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              {t('pentimento.sectionTitle', 'Sealed Pentimento (Proof of Process)')}
            </h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', lineHeight: 1.6, margin: '0 0 12px 0' }}>
              {t('pentimento.settingsDesc', 'Timestamps your writing history so it can be verified as human-made. Only 64-character hashes leave this machine — never your prose.')}
            </p>
            <ToggleRow
              label={t('pentimento.settingsToggle', 'Verification anchoring')}
              desc={t('pentimento.settingsToggleDesc', 'Seals session hashes with a signed timestamp')}
              on={verified}
              onToggle={toggleVerified}
              t={t}
            />
            <ToggleRow
              label={t('pentimento.settingsExternal', 'Independent external timestamp')}
              desc={t('pentimento.settingsExternalDesc', 'Also cross-signs hashes with a public RFC 3161 authority as a second opinion')}
              on={external}
              onToggle={toggleExternal}
              t={t}
            />
            <div style={{ marginTop: 12 }}>
              <label style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                {t('pentimento.settingsTsaUrl', 'Timestamping endpoint (self-hosting)')}
              </label>
              <input
                type="text"
                defaultValue={tsaUrl}
                onBlur={(e) => commitUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                placeholder={DEFAULT_TSA_URL}
                style={{
                  width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', boxSizing: 'border-box',
                }}
              />
            </div>
          </section>

          {/* ── Account (placeholder for the ArtFacility bridge) ── */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              {t('picker.accountSection', 'Account')}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                  {t('picker.accountArtfacility', 'ArtFacility Account')}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: 2 }}>
                  {t('picker.accountComingSoon', 'Cloud sync and verified-project sharing arrive with the ArtFacility bridge.')}
                </div>
              </div>
              <button
                disabled
                style={{
                  padding: '8px 16px', backgroundColor: 'transparent', color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)', cursor: 'not-allowed',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
                }}
              >
                {t('picker.accountLogin', 'Log In')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, on, onToggle, t }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      padding: '10px 12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      cursor: 'pointer', marginBottom: 8,
    }}>
      <div>
        <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{label}</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{
        width: 40, height: 20, flexShrink: 0, padding: 2, boxSizing: 'border-box',
        backgroundColor: on ? 'var(--accent-amber)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
      }}>
        <div style={{ width: 14, height: 14, backgroundColor: on ? 'var(--bg-deep)' : 'var(--text-tertiary)' }} />
      </div>
    </div>
  )
}
