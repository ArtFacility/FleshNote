import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Author's start-screen entry for reviews that came back: pick the files, see
// which project each belongs to, and import them into it (the project opens
// with the Reviews panel showing the notes).
export default function CollectHome({ projects, workspacePath, onImport }) {
  const { t } = useTranslation()
  const [files, setFiles] = useState([]) // { path, title, reviewer, notes, projectId }
  const [projectPath, setProjectPath] = useState('')
  const [error, setError] = useState(null)
  const [dropActive, setDropActive] = useState(false)

  const add = async (paths) => {
    setError(null)
    const next = [...files]
    for (const path of paths) {
      if (next.some((f) => f.path === path)) continue
      const res = await window.api.openReviewPackage({ path })
      if (res?.status !== 'ok') {
        setError(res?.message || t('picker.reviewOpenError', 'Could not open review file.'))
        continue
      }
      const peek = res.peek || {}
      next.push({
        path,
        title: peek.title || '',
        reviewer: peek.reviewer_label || '',
        notes: peek.notes,
        locked: !!peek.sealed,
        projectId: peek.desktop_id || '',
      })
    }
    setFiles(next)
    if (!projectPath) {
      const match = projects.find((p) => next.some((f) => f.projectId && f.projectId === p.project_id))
      if (match) setProjectPath(match.path)
    }
  }

  const browse = async () => {
    const res = await window.api.pickReviewFiles()
    if (res?.status === 'ok') add(res.paths)
  }

  const target = projects.find((p) => p.path === projectPath)
  const mismatched = target ? files.filter((f) => f.projectId && f.projectId !== target.project_id) : []

  return (
    <>
      <div className="picker-main-head">
        <span className="picker-kicker">{t('picker.navCollect', 'Returned reviews')}</span>
        <h2 className="picker-title">{t('picker.collectTitle', 'Bring in a review')}</h2>
        <p className="picker-sub">{t('picker.collectSub', 'Add the .flreview files your readers sent back. Their notes go into the project, beside your text.')}</p>
      </div>

      <div className="picker-collect-stack">
        <div
          className={`picker-drop collect-drop ${dropActive ? 'is-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDropActive(false)
            const paths = [...(e.dataTransfer?.files || [])].map((f) => window.api.getPathForFile(f)).filter((p) => p && p.toLowerCase().endsWith('.flreview'))
            if (paths.length) add(paths)
          }}
        >
          <div className="picker-drop-title">{t('picker.collectDrop', 'Drop returned review files here')}</div>
          <button type="button" className="picker-ghost-btn" onClick={browse}>
            {t('picker.collectAdd', 'Choose files')}
          </button>
        </div>

        {files.length > 0 && (
          <div className="collect-files">
            {files.map((f) => (
              <div key={f.path} className="picker-file-chip">
                <span>
                  {f.locked ? (
                    <><strong>{f.title}</strong>{' · '}{t('picker.collectLocked', 'locked review (opens with this project)')}</>
                  ) : (
                    <>
                      <strong>{f.reviewer || t('reviews.anonymous', 'Unnamed reviewer')}</strong>
                      {' · '}{f.title}{' · '}{t('review.noteCount', '{{n}} notes', { n: f.notes ?? 0 })}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="picker-icon-btn danger"
                  aria-label={t('picker.collectRemoveFile', 'Remove')}
                  onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div>
            <div className="picker-kicker" style={{ marginBottom: 8 }}>{t('picker.collectProject', 'Into project')}</div>
            {!workspacePath || projects.length === 0 ? (
              <div className="picker-empty" style={{ marginTop: 0 }}>{t('picker.collectNeedProject', 'Select a workspace with at least one project.')}</div>
            ) : (
              <select
                className="picker-workspace-path"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                style={{ width: '100%', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="" disabled>{t('picker.collectChoose', 'Choose a project…')}</option>
                {projects.map((p) => (
                  <option key={p.path} value={p.path}>{p.name}</option>
                ))}
              </select>
            )}
            {mismatched.length > 0 && (
              <div className="picker-drop-hint" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
                {t('picker.collectMismatch', 'Some files were made from a different project and will be skipped.')}
              </div>
            )}
          </div>
        )}

        {error && <div className="picker-drop-hint" style={{ color: 'var(--accent-red)' }}>{error}</div>}

        {files.length > 0 && (
          <button
            type="button"
            className="picker-primary"
            disabled={!projectPath}
            onClick={() => onImport({ projectPath, paths: files.map((f) => f.path) })}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('picker.collectOpen', 'Import and open the project')}
          </button>
        )}
      </div>
    </>
  )
}
