import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Export entry-point chooser, opened from the header "Export Project…" item;
 * mirrors SyncChooserModal. Lets the user pick what kind of export to run and
 * hands off to the matching flow — the manuscript ExportModal, the Obsidian
 * vault / plain-text folder exporters, or the .flnote single-file share.
 */
export default function ExportChooserModal({ isOpen, onClose, projectPath, projectName, onPickManuscript, onPickReview }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('idle') // idle | working | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  if (!isOpen) return null

  const close = () => { setPhase('idle'); setResult(null); setError(''); onClose() }

  const runVaultExport = async (fmt) => {
    setPhase('working')
    try {
      const res = await window.api.exportVault({
        project_path: projectPath,
        fmt,
        defaultName: projectPath
      })
      if (res?.status === 'cancelled') { setPhase('idle'); return }
      if (res?.status === 'ok') {
        setResult(res)
        setPhase('done')
      } else {
        setError(res?.message || t('exportChooser.failed', 'The export failed.'))
        setPhase('error')
      }
    } catch (err) {
      setError(err?.message || t('exportChooser.failed', 'The export failed.'))
      setPhase('error')
    }
  }

  const runFlnoteExport = async () => {
    setPhase('working')
    try {
      const res = await window.api.exportFlnote({
        project_path: projectPath,
        defaultName: projectName || projectPath.split(/[\\/]/).pop()
      })
      if (res?.status === 'cancelled') { setPhase('idle'); return }
      if (res?.status === 'ok') {
        setResult(res)
        setPhase('done')
      } else {
        setError(res?.message || t('exportChooser.failed', 'The export failed.'))
        setPhase('error')
      }
    } catch (err) {
      setError(err?.message || t('exportChooser.failed', 'The export failed.'))
      setPhase('error')
    }
  }

  const Card = ({ icon, title, desc, onClick }) => (
    <button
      onClick={phase === 'working' ? undefined : onClick}
      disabled={phase === 'working'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left',
        padding: '18px 18px', background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: phase === 'working' ? 'wait' : 'pointer',
        color: 'var(--text-primary)', width: '100%', transition: 'border-color 0.15s, background 0.15s', opacity: phase === 'working' ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (phase !== 'working') { e.currentTarget.style.borderColor = 'var(--accent, #ffb300)'; e.currentTarget.style.background = 'var(--bg-elevated, var(--bg-surface))' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
    >
      <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent, #ffb300)' }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </button>
  )

  const icons = {
    book: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    obsidian: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
    txt: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
    review: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" />
      </svg>
    ),
    flnote: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    )
  }

  return (
    <div className="settings-modal-overlay" onClick={close}>
      <div
        className="settings-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '92vw', maxWidth: 460, padding: 0, overflow: 'hidden', borderRadius: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            {t('exportChooser.title', 'Export project')}
          </h2>
          <button onClick={close} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            onClick={() => { setPhase('idle'); setResult(null); setError(''); onPickManuscript() }}
            icon={icons.book}
            title={t('exportChooser.manuscriptTitle', 'Story manuscript')}
            desc={t('exportChooser.manuscriptDesc', 'Export the manuscript itself — DOCX, PDF, EPUB and other book formats, with content and formatting options.')}
          />
          {onPickReview && (
            <Card
              onClick={() => { setPhase('idle'); setResult(null); setError(''); onPickReview() }}
              icon={icons.review}
              title={t('exportChooser.reviewTitle', 'Review copy for a beta reader')}
              desc={t('exportChooser.reviewDesc', 'A file a reader opens in FleshNote to leave notes on your chapters, then sends back to you.')}
            />
          )}
          <Card
            onClick={() => runVaultExport('obsidian')}
            icon={icons.obsidian}
            title={t('exportChooser.obsidianTitle', 'Full project — Obsidian vault')}
            desc={t('exportChooser.obsidianDesc', 'Folders with a Markdown file per chapter and entity (characters, locations, lore…), wiki-linked and with images. Ready to open in Obsidian.')}
          />
          <Card
            onClick={() => runVaultExport('txt')}
            icon={icons.txt}
            title={t('exportChooser.txtTitle', 'Full project — plain text')}
            desc={t('exportChooser.txtDesc', 'The same folder structure, but as plain .txt files with no special formatting — maximum portability.')}
          />
          <Card
            onClick={runFlnoteExport}
            icon={icons.flnote}
            title={t('exportChooser.flnoteTitle', '.flnote file (share / backup)')}
            desc={t('exportChooser.flnoteDesc', 'The whole project as one file you can reopen in FleshNote or hand to another writer.')}
          />

          {phase === 'working' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '8px 0 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('exportChooser.working', 'Exporting…')}</span>
            </div>
          )}

          {phase === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'rgba(0,200,83,0.08)', border: '1px solid #00c853', borderRadius: 6 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                {t('exportChooser.done', 'Export complete')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{result.path}</div>
              <button
                className="import-btn"
                onClick={() => window.api.showItemInFolder(result.path)}
              >
                {t('exportModal.showInFolder', 'Show in Folder')}
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ display: 'flex', gap: 12, background: 'rgba(255,82,82,0.1)', border: '1px solid #ff5252', borderRadius: 6, padding: 14, color: '#ff8a80', fontSize: 13, alignItems: 'center' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
