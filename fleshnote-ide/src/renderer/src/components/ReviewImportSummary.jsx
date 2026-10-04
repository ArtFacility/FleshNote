import { useTranslation } from 'react-i18next'

// What an import of returned review files did, one line per file.
export default function ReviewImportSummary({ results, onClose }) {
  const { t } = useTranslation()
  const line = (r) => {
    if (r.status !== 'ok') {
      if (r.error === 'wrong_project') return t('reviews.wrongProject', 'This review belongs to another project: {{title}}', { title: r.title || '' })
      return r.message || t('reviews.unreadable', 'This file could not be read as a FleshNote review.')
    }
    const parts = [t('reviews.importedCount', '{{n}} new notes', { n: r.added })]
    if (r.updated) parts.push(t('reviews.updatedCount', '{{n}} updated', { n: r.updated }))
    if (r.unanchored) parts.push(t('reviews.movedCount', '{{n}} on passages you have since changed', { n: r.unanchored }))
    if (r.skipped) parts.push(t('reviews.skippedCount', '{{n}} on deleted chapters (skipped)', { n: r.skipped }))
    return parts.join(' · ')
  }
  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 460, display: 'flex', flexDirection: 'column' }}>
        <div className="popup-header" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--accent-amber)' }}>{t('reviews.importTitle', 'Reviews imported')}</span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="review-import-list">
          {results.map((r, i) => (
            <div key={i} className={`review-import-row ${r.status !== 'ok' ? 'is-error' : ''}`}>
              <div className="review-import-name">
                {r.status === 'ok'
                  ? (r.reviewer_label || t('reviews.anonymous', 'Unnamed reviewer'))
                  : (r.path || '').split(/[/\\]/).pop()}
              </div>
              <div className="review-import-detail">{line(r)}</div>
            </div>
          ))}
          <button type="button" className="import-btn primary" style={{ alignSelf: 'flex-end' }} onClick={onClose}>
            {t('reviews.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
