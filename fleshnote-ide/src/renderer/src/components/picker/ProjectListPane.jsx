import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function formatRelativeTime(tsMs, t) {
  if (!tsMs) return t('picker.neverOpened', 'Never opened')
  const diffMs = Date.now() - tsMs
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 2) return t('picker.justNow', 'Just now')
  if (diffMins < 60) return t('picker.minutesAgo', '{{n}} minutes ago', { n: diffMins })
  if (diffHours < 24) return t('picker.hoursAgo', '{{n}} hours ago', { n: diffHours })
  if (diffDays === 1) return t('picker.yesterday', 'Yesterday')
  if (diffDays < 30) return t('picker.daysAgo', '{{n}} days ago', { n: diffDays })
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return t('picker.monthsAgo', '{{n}} months ago', { n: diffMonths })
  const diffYears = Math.floor(diffDays / 365)
  return t('picker.yearsAgo', '{{n}} years ago', { n: diffYears })
}

export default function ProjectListPane({
  workspacePath,
  onBrowse,
  projects,
  loading,
  downloadProgress,
  updateState,
  onUpdateAction,
  legacyCount,
  modernizing,
  onModernize,
  migratingPath,
  onMigrate,
  busyPath,
  onExport,
  onDelete,
  onSelect,
  onDropFlnote,
}) {
  const { t } = useTranslation()
  const [dropActive, setDropActive] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDropActive(false)
    const file = e.dataTransfer?.files?.[0]
    const path = file?.path
    if (path && path.toLowerCase().endsWith('.flnote')) {
      onDropFlnote(path)
    }
  }

  return (
    <>
      <div className="picker-main-head">
        <span className="picker-kicker">{t('picker.navProjects', 'Projects')}</span>
        <h2 className="picker-title">{t('picker.title', 'FleshNote Projects')}</h2>
        <p className="picker-sub">{t('picker.subtitle', 'Select a project or establish a new workspace.')}</p>
      </div>

      {updateState.status !== 'idle' && updateState.status !== 'error' && (
        <div className="picker-banner">
          <div>
            <div className="picker-banner-title">
              {t('picker.updateFound', 'New Update Available!')}
              <span style={{ color: 'var(--accent-green)', marginInlineStart: 8, fontFamily: 'var(--font-mono)' }}>
                v{updateState.version}
              </span>
            </div>
            <div className="picker-banner-desc">
              {updateState.canAutoUpdate
                ? t('picker.updateAutoDesc', 'Download and install directly from here.')
                : t('picker.updateManualDesc', 'Update available on GitHub Releases.')}
            </div>
          </div>
          <button
            type="button"
            className="picker-banner-action"
            onClick={onUpdateAction}
            disabled={updateState.status === 'downloading'}
          >
            {updateState.status === 'downloading' && (
              <div className="picker-banner-progress" style={{ width: `${updateState.progress || 0}%` }} />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>
              {updateState.status === 'available' && !updateState.canAutoUpdate
                ? t('picker.updateManualBtn', 'View Release')
                : updateState.status === 'available'
                  ? t('picker.updateDownloadBtn', 'Download')
                  : updateState.status === 'downloading'
                    ? t('picker.updateDownloadingBtn', `Downloading (${Math.round(updateState.progress || 0)}%)`)
                    : t('picker.updateInstallBtn', 'Restart & Install')}
            </span>
          </button>
        </div>
      )}

      <div className="picker-workspace">
        <div className={`picker-workspace-path ${workspacePath ? '' : 'is-empty'}`}>
          {workspacePath || t('picker.noWorkspace', 'No workspace selected...')}
        </div>
        <button type="button" className="picker-ghost-btn" onClick={onBrowse}>
          {t('picker.browse', 'Browse')}
        </button>
      </div>

      {workspacePath && legacyCount > 0 && (
        <div className="picker-banner amber">
          <div>
            <div className="picker-banner-title">
              {t('picker.modernizeTitle', '{{n}} project(s) use the old folder format', { n: legacyCount })}
            </div>
            <div className="picker-banner-desc">
              {t('picker.modernizeDesc', 'Upgrading packages each project into a single .flnote file and applies any pending schema migration.')}
            </div>
          </div>
          <button type="button" className="picker-banner-action" onClick={onModernize} disabled={modernizing}>
            {modernizing ? t('picker.modernizing', 'Upgrading...') : t('picker.modernizeBtn', 'Upgrade')}
          </button>
        </div>
      )}

      <div
        className={`picker-list ${dropActive ? 'drop-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
      >
        {!workspacePath ? (
          <div className="picker-empty">{t('picker.scanPrompt', 'Select a workspace folder to scan for projects.')}</div>
        ) : loading ? (
          <div className="picker-empty amber">
            <div>{downloadProgress !== null ? t('picker.downloading', 'Downloading NLP model...') : t('picker.scanning', 'Scanning directory...')}</div>
            {downloadProgress !== null && (
              <div className="picker-progress-track">
                <div className="picker-progress-fill" style={{ width: `${downloadProgress}%` }} />
              </div>
            )}
          </div>
        ) : projects.length === 0 ? (
          <div className="picker-empty">{t('picker.noProjects', 'No projects found in this workspace.')}</div>
        ) : (
          projects.map((proj, i) => (
            <div key={proj.path || i} className="picker-row">
              <div
                className="picker-row-body"
                onClick={() => {
                  if (proj.needs_migration) {
                    alert(t('picker.migrationRequired', 'This project must be migrated before loading. Please click the Migrate button.'))
                    return
                  }
                  onSelect(proj.path)
                }}
              >
                <div className="picker-row-name">
                  {proj.name}
                  {proj.needs_migration && (
                    <span style={{ color: 'var(--accent-amber)', fontSize: 12, fontWeight: 600, marginInlineStart: 8 }}>
                      ({t('picker.needsMigrationLabel', 'Needs Migration')})
                    </span>
                  )}
                </div>
                <div className="picker-row-meta">
                  {t('picker.lastOpened', 'Last opened:')} {formatRelativeTime(proj.lastOpened, t)}
                </div>
              </div>

              {proj.needs_migration && (
                <button
                  type="button"
                  className="picker-migrate-btn"
                  disabled={migratingPath === proj.path}
                  onClick={(e) => { e.stopPropagation(); onMigrate(proj) }}
                  style={{ opacity: migratingPath === proj.path ? 0.6 : 1 }}
                >
                  {migratingPath === proj.path ? t('picker.migrating', 'Migrating...') : t('picker.migrate', 'Migrate')}
                </button>
              )}

              <button
                type="button"
                className="picker-icon-btn"
                onClick={(e) => { e.stopPropagation(); onExport(proj) }}
                title={t('picker.exportTitle', 'Export as .flnote file (share/backup)')}
                disabled={busyPath === proj.path}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>

              <button
                type="button"
                className="picker-icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onDelete(proj) }}
                title={t('picker.deleteTitle', 'Delete Project')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
