import { useTranslation } from 'react-i18next'
import { reviewProblemText } from '../utils/reviewProblems'

// Asks what to do with a review file FleshNote was opened with, when that is
// not obvious: a returned review of one of the author's own projects (import
// the notes, or read it as a reviewer), or any review file while something
// else is open. Also explains a copy that would not open (expired, offline…).
export default function IncomingReviewModal({ file, onClose, onImport, onReview }) {
  const { t } = useTranslation()
  const peek = file.peek || {}
  const title = peek.title || ''
  const failed = file.error || file.problem

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="popup-panel incoming-review" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--accent-amber)' }}>
            {failed
              ? t('incomingReview.errorTitle', 'This review file could not be opened')
              : file.match
                ? t('incomingReview.returnedTitle', 'A review of {{title}} came back', { title })
                : t('incomingReview.openTitle', 'Open {{title}} for review?', { title })}
          </span>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="incoming-review-body">
          {file.problem ? (
            <p>{reviewProblemText(t, file.problem)}</p>
          ) : file.error ? (
            <p>{t('incomingReview.errorBody', 'It may be damaged, or not a FleshNote review file.')}</p>
          ) : file.match ? (
            <p>
              {peek.sealed
                ? t('incomingReview.returnedLockedBody', 'A reader sent back their notes. Import them into your project "{{project}}" to work through them beside your text.', { project: file.match.name })
                : t('incomingReview.returnedBody', '{{reviewer}} left {{n}} notes. Import them into your project "{{project}}" to work through them beside your text.', {
                  reviewer: peek.reviewer_label || t('reviews.anonymous', 'Unnamed reviewer'), n: peek.notes ?? 0, project: file.match.name,
                })}
            </p>
          ) : (
            <p>{t('incomingReview.openBody', 'What you have open now will be closed. Your work is saved.')}</p>
          )}
          <div className="incoming-review-actions">
            {!failed && (
              <button type="button" className={file.match ? 'import-btn secondary' : 'import-btn primary'} onClick={onReview}>
                {t('incomingReview.readIt', 'Open it as a reviewer')}
              </button>
            )}
            {!failed && file.match && (
              <button type="button" className="import-btn primary" onClick={onImport}>
                {t('incomingReview.import', 'Import the notes')}
              </button>
            )}
            {failed && (
              <button type="button" className="import-btn primary" onClick={onClose}>{t('reviews.ok', 'OK')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
