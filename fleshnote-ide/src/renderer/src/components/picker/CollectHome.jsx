import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function CollectHome({ projects, workspacePath, onCollect }) {
  const { t } = useTranslation()
  const [projectPath, setProjectPath] = useState(projects[0]?.path || '')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectPath && projects[0]?.path) setProjectPath(projects[0].path)
  }, [projects, projectPath])

  const addFiles = async () => {
    setError(null)
    try {
      const res = await window.api.openReviewPackage({ multiple: true })
      if (res?.status === 'ok' && res.packages?.length) {
        setFiles((prev) => {
          const next = [...prev]
          for (const item of res.packages) {
            if (!next.some((f) => f.path === item.path)) next.push(item)
          }
          return next
        })
      } else if (res?.status === 'ok' && res.path) {
        setFiles((prev) => prev.some((f) => f.path === res.path) ? prev : [...prev, { path: res.path, pkg: res.package }])
      } else if (res?.status && res.status !== 'cancelled') {
        setError(res.message || t('picker.reviewOpenError', 'Could not open review file.'))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCollect = async () => {
    if (!projectPath || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.collectReviews({
        project_path: projectPath,
        package_paths: files.map((f) => f.path),
      })
      if (res?.status === 'ok') {
        onCollect({ projectPath, data: res })
      } else {
        setError(res?.message || t('picker.collectError', 'Could not combine review files.'))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="picker-main-head">
        <span className="picker-kicker">{t('picker.navCollect', 'Collect reviews')}</span>
        <h2 className="picker-title">{t('picker.collectTitle', 'Combine reviewer notes')}</h2>
        <p className="picker-sub">{t('picker.collectSub', 'Load every .flreview handed back and overlay the notes on your project.')}</p>
      </div>

      <div className="picker-collect-stack">
        <div>
          <div className="picker-kicker" style={{ marginBottom: 8 }}>{t('picker.collectProject', 'Target project')}</div>
          {!workspacePath || projects.length === 0 ? (
            <div className="picker-empty" style={{ marginTop: 0 }}>{t('picker.collectNeedProject', 'Select a workspace with at least one project.')}</div>
          ) : (
            <select
              className="picker-workspace-path"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              style={{ width: '100%', appearance: 'none', cursor: 'pointer' }}
            >
              {projects.map((p) => (
                <option key={p.path} value={p.path}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="picker-kicker" style={{ marginBottom: 8 }}>{t('picker.collectFiles', 'Review files')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map((f) => (
              <div key={f.path} className="picker-file-chip">
                <span>{f.pkg?.reviewer_label || f.pkg?.snapshot?.project?.title || f.path.split(/[/\\]/).pop()}</span>
                <button
                  type="button"
                  className="picker-icon-btn danger"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button type="button" className="picker-ghost-btn" onClick={addFiles} style={{ alignSelf: 'flex-start' }}>
              {t('picker.collectAdd', '+ Add .flreview')}
            </button>
          </div>
        </div>

        {error && <div className="picker-drop-hint" style={{ color: 'var(--accent-red)' }}>{error}</div>}

        <button
          type="button"
          className="picker-primary"
          disabled={!projectPath || files.length === 0 || busy}
          onClick={handleCollect}
          style={{ alignSelf: 'flex-start' }}
        >
          {busy ? t('picker.collecting', 'Combining…') : t('picker.collectOpen', 'Open combined notes')}
        </button>
      </div>
    </>
  )
}
