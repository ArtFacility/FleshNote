import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPersonalDefaults } from '../utils/personalDefaults'
import { fmtExpiry } from '../utils/reviewProblems'

const EXPIRY_DAYS = [7, 14, 30, 90, 0] // 0: no expiry, works offline

/**
 * Makes a review copy (.flreview) for a beta reader: the chosen chapters,
 * optionally the public details of characters and places, and a short note
 * from the author. By default the copy is locked and stops opening after a
 * number of days (the key server holds half its key until then). Plot twists and author-only fields stay out unless the
 * author opts in. The reviewer opens the file in FleshNote, leaves notes and
 * sends back a copy, which the author imports into the Reviews panel.
 */
export default function SendForReviewModal({ isOpen, onClose, projectPath, projectConfig, chapters }) {
  const { t } = useTranslation()
  const [reviewer, setReviewer] = useState('')
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState('')
  const [pick, setPick] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [scope, setScope] = useState({ entities: true, with_secrets: false, plot: false })
  const [phase, setPhase] = useState('idle') // idle | working | done
  const [error, setError] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [expiryDays, setExpiryDays] = useState(30)
  const [expiresAt, setExpiresAt] = useState('')
  const [serverDown, setServerDown] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPhase('idle')
    setError('')
    setSavedPath('')
    setServerDown(false)
    setSelected(new Set((chapters || []).map((c) => c.id)))
    getPersonalDefaults().then((d) => setAuthor(projectConfig?.author_name || d.author_name || '')).catch(() => { })
  }, [isOpen])

  if (!isOpen) return null
  const title = projectConfig?.project_name || t('review.untitled', 'Untitled')
  const chosen = pick ? (chapters || []).filter((c) => selected.has(c.id)) : (chapters || [])
  const words = chosen.reduce((sum, c) => sum + (c.word_count || 0), 0)

  const create = async (days = expiryDays) => {
    setPhase('working')
    setError('')
    setServerDown(false)
    try {
      const name = reviewer.trim()
      const res = await window.api.exportReviewPackage({
        project_path: projectPath,
        defaultName: name ? `${title} - for ${name}` : `${title} - review copy`,
        reviewer_label: name,
        author_label: author.trim(),
        message: message.trim(),
        expires_days: days,
        scope: {
          entities: scope.entities,
          with_secrets: scope.entities && scope.with_secrets,
          plot: scope.plot,
          chapter_ids: pick ? chosen.map((c) => c.id) : null,
        },
      })
      if (res?.status === 'ok') {
        setSavedPath(res.path)
        setExpiresAt(res.expires_at || '')
        setPhase('done')
      } else if (res?.error === 'key_server_unreachable' || res?.error === 'untrusted_server') {
        setServerDown(true)
        setPhase('idle')
      } else {
        if (res?.status !== 'cancelled') setError(res?.message || t('sendReview.failed', 'The review copy could not be saved.'))
        setPhase('idle')
      }
    } catch (err) {
      setError(err?.message || t('sendReview.failed', 'The review copy could not be saved.'))
      setPhase('idle')
    }
  }

  const toggleChapter = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal send-review" onClick={(e) => e.stopPropagation()}>
        <div className="send-review-head">
          <h2>{t('sendReview.title', 'Send for review')}</h2>
          <button type="button" className="send-review-close" onClick={onClose} aria-label={t('sendReview.close', 'Close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {phase === 'done' ? (
          <div className="send-review-body">
            <div className="send-review-done">{t('sendReview.doneTitle', 'Review copy saved')}</div>
            <div className="send-review-path">{savedPath}</div>
            {expiresAt && (
              <div className="send-review-expiry">
                {t('sendReview.doneExpiry', 'This copy stops opening on {{date}}. You can withdraw it sooner from the Reviews panel.', { date: fmtExpiry(expiresAt) })}
              </div>
            )}
            <ol className="send-review-steps">
              <li>{t('sendReview.step1', 'Send this file to your reviewer however you like: email, chat, a USB stick.')}</li>
              <li>{t('sendReview.step2', 'They open it with FleshNote (free). Double-clicking the file is enough once FleshNote is installed.')}</li>
              <li>{t('sendReview.step3', 'When they are done, FleshNote saves a copy for them to send back to you.')}</li>
              <li>{t('sendReview.step4', 'Bring it in with Options → Import reviews, or by double-clicking it. Their notes appear in the Reviews panel beside your text.')}</li>
            </ol>
            <div className="send-review-actions">
              <button type="button" className="import-btn secondary" onClick={() => window.api.showItemInFolder(savedPath)}>
                {t('sendReview.showInFolder', 'Show in folder')}
              </button>
              <button type="button" className="import-btn primary" onClick={onClose}>
                {t('sendReview.done', 'Done')}
              </button>
            </div>
          </div>
        ) : (
          <div className="send-review-body">
            <label className="send-review-field">
              <span>{t('sendReview.reviewer', 'Who is it for? (optional)')}</span>
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={120}
                placeholder={t('sendReview.reviewerPlaceholder', 'e.g. Anna')} />
            </label>
            <label className="send-review-field">
              <span>{t('sendReview.message', 'A note for them (optional)')}</span>
              <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000}
                placeholder={t('sendReview.messagePlaceholder', 'What would you like feedback on?')} />
            </label>
            <label className="send-review-field">
              <span>{t('sendReview.author', 'Your name, as they will see it')}</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
            </label>

            <div className="send-review-field">
              <span>{t('sendReview.chapters', 'Chapters')}</span>
              <div className="send-review-seg">
                <button type="button" className={!pick ? 'on' : ''} onClick={() => setPick(false)}>
                  {t('sendReview.allChapters', 'All ({{n}})', { n: (chapters || []).length })}
                </button>
                <button type="button" className={pick ? 'on' : ''} onClick={() => setPick(true)}>
                  {t('sendReview.someChapters', 'Choose')}
                </button>
              </div>
              {pick && (
                <div className="send-review-chapters">
                  {(chapters || []).map((c) => (
                    <label key={c.id}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleChapter(c.id)} />
                      <span>{c.chapter_number}. {c.title}</span>
                    </label>
                  ))}
                </div>
              )}
              <span className="send-review-hint">
                {t('sendReview.summary', '{{chapters}} chapters · {{words}} words', { chapters: chosen.length, words: words.toLocaleString() })}
              </span>
            </div>

            <div className="send-review-field">
              <span>{t('sendReview.canSee', 'They can also see')}</span>
              <label className="send-review-check">
                <input type="checkbox" checked={scope.entities}
                  onChange={(e) => setScope((s) => ({ ...s, entities: e.target.checked, with_secrets: e.target.checked && s.with_secrets }))} />
                <span>{t('sendReview.entities', 'Characters, places and lore: names and public details')}</span>
              </label>
              <label className={`send-review-check ${scope.entities ? '' : 'is-off'}`}>
                <input type="checkbox" disabled={!scope.entities} checked={scope.with_secrets}
                  onChange={(e) => setScope((s) => ({ ...s, with_secrets: e.target.checked }))} />
                <span>{t('sendReview.secrets', 'Author-only details too (bios, true goals)')}</span>
              </label>
              <label className="send-review-check">
                <input type="checkbox" checked={scope.plot} onChange={(e) => setScope((s) => ({ ...s, plot: e.target.checked }))} />
                <span>{t('sendReview.plot', 'Plot twists and foreshadowing (spoilers)')}</span>
              </label>
            </div>

            <div className="send-review-field">
              <span>{t('sendReview.expiry', 'Stops opening after')}</span>
              <div className="send-review-seg">
                {EXPIRY_DAYS.map((d) => (
                  <button key={d} type="button" className={expiryDays === d ? 'on' : ''} onClick={() => setExpiryDays(d)}>
                    {d ? t('sendReview.days', '{{n}} days', { n: d }) : t('sendReview.noExpiry', 'Never')}
                  </button>
                ))}
              </div>
              <span className="send-review-hint">
                {expiryDays
                  ? t('sendReview.expiryHint', 'After that the file is dead weight, wherever it ended up. Needs an internet connection to make, and for them to open it the first time.')
                  : t('sendReview.noExpiryHint', 'The file stays readable forever and works fully offline.')}
              </span>
            </div>

            {serverDown && (
              <div className="send-review-error">
                {t('sendReview.serverDown', 'The FleshNote key server could not be reached, so the copy could not be locked.')}
                {' '}
                <button type="button" className="reviews-text-btn accent" onClick={() => { setExpiryDays(0); create(0) }}>
                  {t('sendReview.saveUnlocked', 'Save without expiry instead')}
                </button>
              </div>
            )}
            {error && <div className="send-review-error">{error}</div>}
            <div className="send-review-actions">
              <button type="button" className="import-btn secondary" onClick={onClose}>
                {t('sendReview.cancel', 'Cancel')}
              </button>
              <button type="button" className="import-btn primary" disabled={phase === 'working' || chosen.length === 0} onClick={() => create()}>
                {phase === 'working'
                  ? (expiryDays ? t('sendReview.locking', 'Locking the copy…') : t('sendReview.working', 'Saving…'))
                  : t('sendReview.create', 'Save review copy')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
