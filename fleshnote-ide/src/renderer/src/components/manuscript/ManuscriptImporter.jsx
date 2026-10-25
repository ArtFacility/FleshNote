import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SplitReview from './SplitReview'
import { withIds } from '../../utils/manuscriptSplits'

const FILTERS = [
  { name: 'Manuscripts', extensions: ['docx', 'md', 'markdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

/**
 * Pick or drop manuscript files (one file, a file per chapter, or a folder),
 * then review the proposed chapters. The parent owns `splits` so going back
 * and forth between steps keeps the review.
 */
export default function ManuscriptImporter({
  splits,
  setSplits,
  onBack,
  backLabel,
  onConfirm,
  confirmLabel,
  busy = false,
  footerExtra = null
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [problems, setProblems] = useState([])
  const [dropActive, setDropActive] = useState(false)

  const load = async (paths) => {
    const list = (paths || []).filter(Boolean)
    if (!list.length) return
    setLoading(true)
    try {
      const result = await window.api.importSplitPreview({ project_path: '', file_paths: list })
      const fresh = withIds(result.splits || [])
      setProblems((result.files || []).filter((f) => f.error))
      if (splits.length === 0) setSelected(0)
      setSplits((prev) => [...prev, ...fresh])
    } catch (err) {
      setProblems([{ name: '', error: err.message || String(err) }])
    } finally {
      setLoading(false)
    }
  }

  const chooseFiles = async () => load(await window.api.openFiles(FILTERS))
  const chooseFolder = async () => {
    const folder = await window.api.selectFolder()
    if (folder) load([folder])
  }

  const isFileDrag = (e) => e.dataTransfer?.types?.includes('Files')
  const dropProps = {
    onDragOver: (e) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      setDropActive(true)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false)
    },
    onDrop: (e) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      setDropActive(false)
      load([...e.dataTransfer.files].map((f) => window.api.getPathForFile(f)))
    }
  }

  const words = splits.reduce((n, s) => n + s.word_count, 0)

  return (
    <div className={`ms-importer ${dropActive ? 'is-dropping' : ''}`} {...dropProps}>
      <div className="ms-body">
        {splits.length === 0 ? (
          <div className="ms-drop">
            <h2 className="ms-drop-title">
              {loading
                ? t('manuscript.reading', 'Reading your manuscript…')
                : t('manuscript.dropTitle', 'Drop your manuscript here')}
            </h2>
            <p className="ms-drop-sub">
              {t(
                'manuscript.dropSub',
                'One file with the whole book, one file per chapter, or a folder of them. Word (.docx), Markdown and plain text work.'
              )}
            </p>
            <div className="ms-drop-actions">
              <button type="button" className="start-primary" onClick={chooseFiles} disabled={loading}>
                {t('manuscript.chooseFiles', 'Choose files')}
              </button>
              <button type="button" className="start-ghost" onClick={chooseFolder} disabled={loading}>
                {t('manuscript.chooseFolder', 'Choose a folder')}
              </button>
            </div>
            {problems.length ? <Problems problems={problems} /> : null}
          </div>
        ) : (
          <>
            {problems.length ? <Problems problems={problems} /> : null}
            <SplitReview splits={splits} selected={selected} onSelect={setSelected} onChange={setSplits} />
          </>
        )}
        {dropActive ? <div className="ms-drop-veil">{t('manuscript.dropToAdd', 'Drop to add these files')}</div> : null}
      </div>

      <footer className="start-footer">
        <div className="start-footer-info">
          {splits.length > 0 ? (
            <>
              <span>
                {t('manuscript.summary', '{{chapters}} chapters · {{words}} words', {
                  count: splits.length,
                  chapters: splits.length,
                  words: words.toLocaleString()
                })}
              </span>
              <button type="button" className="ms-text-btn" onClick={chooseFiles} disabled={loading}>
                {loading ? t('manuscript.reading', 'Reading your manuscript…') : t('manuscript.addFiles', 'Add more files')}
              </button>
              <button type="button" className="ms-text-btn" onClick={() => setSplits([])} disabled={loading}>
                {t('manuscript.startOver', 'Start over')}
              </button>
            </>
          ) : null}
        </div>
        <div className="start-footer-actions">
          {footerExtra}
          <button type="button" className="start-ghost" onClick={onBack}>
            {backLabel || t('start.back', 'Back')}
          </button>
          <button
            type="button"
            className="start-primary"
            disabled={busy || loading || splits.length === 0}
            onClick={() => onConfirm(splits)}
          >
            {confirmLabel(splits.length)}
          </button>
        </div>
      </footer>
    </div>
  )
}

function Problems({ problems }) {
  const { t } = useTranslation()
  return (
    <div className="ms-problems" role="alert">
      {problems.map((p, i) => (
        <div key={i}>
          {p.name
            ? t('manuscript.fileProblem', 'Couldn’t read {{name}}: {{error}}', { name: p.name, error: p.error })
            : p.error}
        </div>
      ))}
    </div>
  )
}
