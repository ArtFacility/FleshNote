import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtExpiry } from '../utils/reviewProblems'

/**
 * Right-rail panel for reviews handed back by beta readers. Lists the open
 * notes on the chapter being written (in reading order), jumps to a note's
 * passage on click, and lets the author resolve, dismiss or apply a
 * suggested rewrite. The editor itself is never marked up: a passage is only
 * highlighted for a moment when its note is opened.
 */

const SCORE_KEYS = ['pacing', 'prose', 'dialogue', 'characters', 'plot', 'engagement', 'overall']

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

function NoteCard({ t, note, onOpen, onStatus, onApply, canApplyNote }) {
  const quote = note.quote_text || ''
  const canApply = note.anchored === 1 && note.status === 'open' &&
    ((note.category === 'remove') || (note.suggestion && (note.category === 'typo' || note.category === 'rewrite'))) &&
    (!canApplyNote || canApplyNote(note))
  return (
    <div className={`note-card cat-${note.category} reviews-card ${note.status !== 'open' ? 'is-closed' : ''}`}>
      <button type="button" className="reviews-card-open" onClick={() => onOpen(note)}>
        <span className="reviews-card-head">
          <span className={`review-chip cat-${note.category} on`}>{t(`review.cat.${note.category}`, note.category)}</span>
          {note.reviewer_label && <span className="note-card-label">{note.reviewer_label}</span>}
        </span>
        {quote && (
          <span className="reviews-card-quote">“{quote.length > 140 ? quote.slice(0, 140) + '…' : quote}”</span>
        )}
        {note.anchored === 0 && (
          <span className="reviews-card-moved">{t('reviews.passageChanged', 'This passage has changed since the review')}</span>
        )}
        {note.body && <span className="note-card-body">{note.body}</span>}
        {note.suggestion && (
          <span className="reviews-card-suggestion">
            <span className="reviews-card-suggestion-label">{t('reviews.suggested', 'Suggested')}</span>
            {note.suggestion}
          </span>
        )}
      </button>
      <div className="reviews-card-actions">
        {note.status === 'open' ? (
          <>
            {canApply && (
              <button type="button" className="reviews-text-btn accent" onClick={() => onApply(note)}>
                {note.category === 'remove' ? t('reviews.cut', 'Cut it') : t('reviews.apply', 'Use suggestion')}
              </button>
            )}
            <button type="button" className="reviews-text-btn" onClick={() => onStatus(note, 'resolved')}>
              {t('reviews.resolve', 'Resolve')}
            </button>
            <button type="button" className="reviews-text-btn" onClick={() => onStatus(note, 'dismissed')}>
              {t('reviews.dismiss', 'Dismiss')}
            </button>
          </>
        ) : (
          <>
            <span className="reviews-card-state">
              {note.status === 'resolved' ? t('reviews.resolved', 'Resolved') : t('reviews.dismissed', 'Dismissed')}
            </span>
            <button type="button" className="reviews-text-btn" onClick={() => onStatus(note, 'open')}>
              {t('reviews.reopen', 'Reopen')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ReviewsPanel({
  data, chapters, activeChapterId, isCollapsed, onToggle,
  onOpenNote, onStatus, onApply, canApplyNote, onOpenChapter, onImport, onDeleteReview, onRevokeCopy,
}) {
  const { t } = useTranslation()
  const [showClosed, setShowClosed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [revokeFailed, setRevokeFailed] = useState(null)
  const reviews = data?.reviews || []
  const copies = data?.copies || []
  const notes = data?.notes || []

  const here = useMemo(() => notes
    .filter((n) => String(n.chapter_id) === String(activeChapterId) && (showClosed || n.status === 'open'))
    .sort((a, b) => (a.anchor_hint || 0) - (b.anchor_hint || 0)), [notes, activeChapterId, showClosed])

  const elsewhere = useMemo(() => {
    const counts = new Map()
    for (const n of notes) {
      if (n.status !== 'open' || String(n.chapter_id) === String(activeChapterId)) continue
      counts.set(String(n.chapter_id), (counts.get(String(n.chapter_id)) || 0) + 1)
    }
    return (chapters || []).filter((ch) => counts.has(String(ch.id))).map((ch) => ({ ch, count: counts.get(String(ch.id)) }))
  }, [notes, chapters, activeChapterId])

  const closedHere = notes.filter((n) => String(n.chapter_id) === String(activeChapterId) && n.status !== 'open').length

  return (
    <div className={`panel-right ${isCollapsed ? 'collapsed' : ''}`} style={{ outline: 'none' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <span className="reviews-title">{t('reviews.title', 'Reviews')}</span>
        <button className="ide-titlebar-btn" onClick={onToggle} title={t('reviews.toggleTitle', 'Toggle Reviews Panel')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={isCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="panel-content reviews-panel" style={{ overflowY: 'auto', padding: '10px' }}>
          <div className="reviews-toolbar">
            <button type="button" className="reviews-text-btn" onClick={onImport}>
              {t('reviews.import', 'Import a review…')}
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="reviews-empty">
              {copies.length > 0
                ? t('reviews.waiting', 'No reviews back yet. When a reader sends their file back, import it here or double-click it.')
                : t('reviews.emptyAll', 'No reviews yet. Send a review copy to a beta reader (Options → Send for review), then import the file they send back.')}
            </div>
          ) : (
            <>
              <div className="reviews-section-head">
                <span>{t('reviews.thisChapter', 'This chapter')}</span>
                {closedHere > 0 && (
                  <button type="button" className="reviews-text-btn" onClick={() => setShowClosed((v) => !v)}>
                    {showClosed ? t('reviews.hideClosed', 'Hide done') : t('reviews.showClosed', 'Show done ({{n}})', { n: closedHere })}
                  </button>
                )}
              </div>
              {here.length === 0 ? (
                <div className="reviews-empty">{t('reviews.emptyChapter', 'No open notes on this chapter.')}</div>
              ) : here.map((n) => (
                <NoteCard key={n.id} t={t} note={n} onOpen={onOpenNote} onStatus={onStatus} onApply={onApply} canApplyNote={canApplyNote} />
              ))}

              {elsewhere.length > 0 && (
                <>
                  <div className="reviews-section-head"><span>{t('reviews.otherChapters', 'Other chapters')}</span></div>
                  {elsewhere.map(({ ch, count }) => (
                    <button key={ch.id} type="button" className="reviews-chapter-row" onClick={() => onOpenChapter(ch)}>
                      <span className="reviews-chapter-name">{ch.chapter_number}. {ch.title}</span>
                      <span className="reviews-chapter-count">{t('reviews.openCount', '{{n}} open', { n: count })}</span>
                    </button>
                  ))}
                </>
              )}

              <div className="reviews-section-head"><span>{t('reviews.reviewers', 'Reviewers')}</span></div>
              {reviews.map((r) => {
                const sc = r.scores.find((s) => String(s.chapter_id) === String(activeChapterId))
                return (
                  <div key={r.id} className="reviews-reviewer">
                    <div className="reviews-reviewer-head">
                      <span className="reviews-reviewer-name">{r.reviewer_label || t('reviews.anonymous', 'Unnamed reviewer')}</span>
                      <span className="reviews-reviewer-date">{fmtDate(r.finished_at || r.imported_at)}</span>
                    </div>
                    {sc && (
                      <div className="reviews-scores">
                        {SCORE_KEYS.filter((k) => sc[k]).map((k) => (
                          <div key={k} className="score-row">
                            <span>{t(`review.score.${k}`, k)}</span>
                            <div className="score-pips" aria-label={`${sc[k]} / 5`}>
                              {[1, 2, 3, 4, 5].map((v) => <span key={v} className={`score-pip ${sc[k] >= v ? 'on' : ''}`} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {confirmDelete === r.id ? (
                      <div className="reviews-card-actions">
                        <span className="reviews-card-state">{t('reviews.removeConfirm', 'Remove this review and its notes?')}</span>
                        <button type="button" className="reviews-text-btn danger" onClick={() => { setConfirmDelete(null); onDeleteReview(r) }}>
                          {t('reviews.remove', 'Remove')}
                        </button>
                        <button type="button" className="reviews-text-btn" onClick={() => setConfirmDelete(null)}>
                          {t('reviews.cancel', 'Cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="reviews-card-actions">
                        <button type="button" className="reviews-text-btn" onClick={() => setConfirmDelete(r.id)}>
                          {t('reviews.removeReview', 'Remove review')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {copies.length > 0 && (
            <>
              <div className="reviews-section-head"><span>{t('reviews.sentCopies', 'Copies you sent')}</span></div>
              {copies.map((c) => {
                const gone = c.revoked_at || (c.expires_at && new Date(c.expires_at) <= new Date())
                return (
                  <div key={c.id} className="reviews-copy">
                    <div className="reviews-reviewer-head">
                      <span className="reviews-reviewer-name">{c.reviewer_label || t('reviews.anonymous', 'Unnamed reviewer')}</span>
                      <span className="reviews-reviewer-date">{fmtDate(c.created_at)}</span>
                    </div>
                    <div className="reviews-copy-state">
                      {!c.locked && t('reviews.copyOpen', 'Never expires')}
                      {c.locked && c.revoked_at && t('reviews.copyRevoked', 'Withdrawn {{date}}', { date: fmtExpiry(c.revoked_at) })}
                      {c.locked && !c.revoked_at && gone && t('reviews.copyExpired', 'Expired {{date}}', { date: fmtExpiry(c.expires_at) })}
                      {c.locked && !gone && t('reviews.copyUntil', 'Opens until {{date}}', { date: fmtExpiry(c.expires_at) })}
                    </div>
                    {c.locked && !gone && (
                      confirmRevoke === c.id ? (
                        <div className="reviews-card-actions">
                          <span className="reviews-card-state">{t('reviews.revokeConfirm', 'Stop this copy opening for anyone who has it?')}</span>
                          <button type="button" className="reviews-text-btn danger" onClick={async () => {
                            setConfirmRevoke(null)
                            setRevokeFailed((await onRevokeCopy(c)) ? null : c.id)
                          }}>
                            {t('reviews.revoke', 'Withdraw')}
                          </button>
                          <button type="button" className="reviews-text-btn" onClick={() => setConfirmRevoke(null)}>
                            {t('reviews.cancel', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="reviews-card-actions">
                          {revokeFailed === c.id && (
                            <span className="reviews-card-state is-error">{t('reviews.revokeFailed', 'Could not reach the key server. Try again when online.')}</span>
                          )}
                          <button type="button" className="reviews-text-btn" onClick={() => setConfirmRevoke(c.id)}>
                            {t('reviews.revokeCopy', 'Withdraw copy')}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
