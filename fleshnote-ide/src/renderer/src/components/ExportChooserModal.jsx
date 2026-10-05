import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import OptionCard, { OptionIcons } from './OptionCard'

/**
 * Export entry-point chooser, opened from the header "Export Project…" item;
 * mirrors SyncChooserModal. The first step picks what to export: the story
 * (the manuscript export window), a review copy for a beta reader, or the
 * full project. Full project opens a second step with its three forms: an
 * Obsidian vault, plain-text folders, or a single .flnote file.
 */
export default function ExportChooserModal({ isOpen, onClose, projectPath, projectName, onPickManuscript, onPickReview }) {
  const { t } = useTranslation()
  const [step, setStep] = useState('main') // main | project
  const [phase, setPhase] = useState('idle') // idle | working | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  if (!isOpen) return null

  const reset = () => { setPhase('idle'); setResult(null); setError('') }
  const close = () => { reset(); setStep('main'); onClose() }

  const run = async (call) => {
    setPhase('working')
    setResult(null)
    setError('')
    try {
      const res = await call()
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

  const runVaultExport = (fmt) => run(() => window.api.exportVault({ project_path: projectPath, fmt, defaultName: projectPath }))
  const runFlnoteExport = () => run(() => window.api.exportFlnote({
    project_path: projectPath,
    defaultName: projectName || projectPath.split(/[\\/]/).pop()
  }))

  const working = phase === 'working'

  return (
    <div className="settings-modal-overlay" onClick={close}>
      <div className="settings-modal option-popup" onClick={(e) => e.stopPropagation()}>
        <div className="option-popup-head">
          {step === 'project' && (
            <button className="option-popup-icon-btn is-back" onClick={() => { reset(); setStep('main') }}
              aria-label={t('exportChooser.back', 'Back')} title={t('exportChooser.back', 'Back')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <h2>{step === 'project' ? t('exportChooser.projectStepTitle', 'Export the full project') : t('exportChooser.title', 'Export project')}</h2>
          <button className="option-popup-icon-btn" onClick={close} aria-label={t('common.close', 'Close')} title={t('common.close', 'Close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="option-popup-body">
          {step === 'main' ? (
            <>
              <OptionCard autoFocus icon={OptionIcons.book} onClick={() => { reset(); onPickManuscript() }}
                title={t('exportChooser.manuscriptTitle', 'Story manuscript')}
                desc={t('exportChooser.manuscriptDesc', 'Export the manuscript itself — DOCX, PDF, EPUB and other book formats, with content and formatting options.')} />
              {onPickReview && (
                <OptionCard icon={OptionIcons.review} onClick={() => { reset(); onPickReview() }}
                  title={t('exportChooser.reviewTitle', 'Review copy for a beta reader')}
                  desc={t('exportChooser.reviewDesc', 'A file a reader opens in FleshNote to leave notes on your chapters, then sends back to you.')} />
              )}
              <OptionCard icon={OptionIcons.project} onClick={() => { reset(); setStep('project') }}
                title={t('exportChooser.projectTitle', 'Full project')}
                desc={t('exportChooser.projectDesc', 'Everything, not just the story: an Obsidian vault, plain-text folders, or one .flnote file to share or back up.')} />
            </>
          ) : (
            <>
              <OptionCard autoFocus icon={OptionIcons.folder} disabled={working} onClick={() => runVaultExport('obsidian')}
                title={t('exportChooser.obsidianShort', 'Obsidian vault')}
                desc={t('exportChooser.obsidianDesc', 'Folders with a Markdown file per chapter and entity (characters, locations, lore…), wiki-linked and with images. Ready to open in Obsidian.')} />
              <OptionCard icon={OptionIcons.text} disabled={working} onClick={() => runVaultExport('txt')}
                title={t('exportChooser.txtShort', 'Plain-text folders')}
                desc={t('exportChooser.txtDesc', 'The same folder structure, but as plain .txt files with no special formatting — maximum portability.')} />
              <OptionCard icon={OptionIcons.download} disabled={working} onClick={runFlnoteExport}
                title={t('exportChooser.flnoteTitle', '.flnote file (share / backup)')}
                desc={t('exportChooser.flnoteDesc', 'The whole project as one file you can reopen in FleshNote or hand to another writer.')} />

              {working && (
                <div className="option-popup-working">
                  <span className="option-popup-spinner" />
                  {t('exportChooser.working', 'Exporting…')}
                </div>
              )}
              {phase === 'done' && result && (
                <div className="option-popup-status is-done" role="status">
                  <strong style={{ color: 'var(--text-primary)' }}>{t('exportChooser.done', 'Export complete')}</strong>
                  <span className="option-popup-path">{result.path}</span>
                  <button className="import-btn" onClick={() => window.api.showItemInFolder(result.path)}>
                    {t('exportModal.showInFolder', 'Show in Folder')}
                  </button>
                </div>
              )}
              {phase === 'error' && <div className="option-popup-status is-error" role="alert">{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
