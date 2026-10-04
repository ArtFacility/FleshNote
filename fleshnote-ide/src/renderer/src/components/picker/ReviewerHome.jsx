import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtExpiry, reviewProblemText } from '../../utils/reviewProblems'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

// Start screen for reviewers: open a review file someone sent, or carry on
// with one already started (notes are kept in the app between sessions).
export default function ReviewerHome({ onOpenReview }) {
  const { t } = useTranslation()
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState(null)
  const [reviews, setReviews] = useState([])
  const [confirmRemove, setConfirmRemove] = useState(null)

  const refresh = async () => {
    try {
      const res = await window.api.listReviews()
      setReviews(res?.reviews || [])
    } catch { setReviews([]) }
  }
  useEffect(() => { refresh() }, [])

  const open = async (path) => {
    setError(null)
    try {
      const res = await window.api.startReview(path ? { path } : {})
      if (res?.status === 'ok') onOpenReview(res)
      else if (res?.status !== 'cancelled') {
        setError(reviewProblemText(t, res))
        refresh()
      }
    } catch (err) {
      setError(err.message || t('picker.reviewOpenError', 'Could not open review file.'))
    }
  }

  const remove = async (r) => {
    setConfirmRemove(null)
    await window.api.discardReview({ path: r.path })
    refresh()
  }

  return (
    <>
      <div className="picker-main-head">
        <span className="picker-kicker">{t('picker.navReviewer', 'Reviewer mode')}</span>
        <h2 className="picker-title">{t('picker.reviewerTitle', 'Review a manuscript')}</h2>
        <p className="picker-sub">{t('picker.reviewerSub', 'Open the review file an author sent you, read, and leave notes. Nothing you do changes their book.')}</p>
      </div>

      <div
        className={`picker-drop reviewer-home-drop ${dropActive ? 'is-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          const file = e.dataTransfer?.files?.[0]
          const path = file ? window.api.getPathForFile(file) : ''
          if (path && path.toLowerCase().endsWith('.flreview')) open(path)
        }}
      >
        <div className="picker-drop-title">{t('picker.reviewerDrop', 'Drop a .flreview file here')}</div>
        <div className="picker-drop-hint">{t('picker.reviewerDropHint', 'or open the file the author sent you. Double-clicking it works too.')}</div>
        <button type="button" className="picker-primary" onClick={() => open()}>
          {t('picker.reviewerBrowse', 'Open review file')}
        </button>
        {error && <div className="picker-drop-hint" style={{ color: 'var(--accent-red)' }}>{error}</div>}
      </div>

      {reviews.length > 0 && (
        <div className="reviewer-home-list">
          <span className="picker-kicker">{t('picker.reviewsInProgress', 'Your reviews')}</span>
          {reviews.map((r) => (
            <div key={r.path} className="reviewer-home-row">
              <button type="button" className="reviewer-home-open" onClick={() => open(r.path)}>
                <span className="reviewer-home-title">{r.title || t('review.untitled', 'Untitled')}</span>
                <span className="reviewer-home-meta">
                  {r.author_label && <>{t('picker.reviewFor', 'for {{author}}', { author: r.author_label })} · </>}
                  {r.locked
                    ? t('picker.reviewLocked', 'no longer opens (expired or withdrawn)')
                    : t('review.noteCount', '{{n}} notes', { n: r.notes })}
                  {' · '}
                  {r.finished_at
                    ? t('picker.reviewSentBack', 'sent back {{date}}', { date: fmtDate(r.finished_at) })
                    : t('picker.reviewEdited', 'last opened {{date}}', { date: fmtDate(r.updated_at) })}
                  {r.expires_at && !r.locked && <> · {t('picker.reviewUntil', 'readable until {{date}}', { date: fmtExpiry(r.expires_at) })}</>}
                </span>
              </button>
              {confirmRemove === r.path ? (
                <span className="reviewer-home-confirm">
                  <span>{t('picker.reviewRemoveConfirm', 'Delete your notes?')}</span>
                  <button type="button" className="picker-ghost-btn danger" onClick={() => remove(r)}>{t('picker.reviewRemove', 'Delete')}</button>
                  <button type="button" className="picker-ghost-btn" onClick={() => setConfirmRemove(null)}>{t('picker.cancel', 'Cancel')}</button>
                </span>
              ) : (
                <button type="button" className="picker-ghost-btn" onClick={() => setConfirmRemove(r.path)}>
                  {t('picker.reviewRemove', 'Delete')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
