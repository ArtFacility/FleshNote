import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const POLL_MS = 1000
// Wait for this much reading before guessing the time left; early chapters
// include the model warming up and would make the guess jumpy.
const ESTIMATE_AFTER_MS = 8000
const ESTIMATE_AFTER_FRACTION = 0.03

/**
 * How far a running name analysis has got: a bar, the chapter it is on and a
 * rough time left. Reads the backend's progress for `jobId` until unmounted.
 */
export default function AnalysisProgress({ jobId }) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState(null)
  const [minutesLeft, setMinutesLeft] = useState(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (!jobId || !window.api?.importNerProgress) return undefined
    let alive = true
    const poll = async () => {
      try {
        const p = await window.api.importNerProgress(jobId)
        if (!alive || !p || p.stage === 'unknown') return
        setProgress(p)
        const fraction = p.total ? p.done / p.total : 0
        if (p.stage !== 'reading' || fraction <= 0) return
        const now = Date.now()
        if (!startRef.current) startRef.current = { time: now, fraction }
        const start = startRef.current
        if (now - start.time >= ESTIMATE_AFTER_MS && fraction - start.fraction >= ESTIMATE_AFTER_FRACTION) {
          const rate = (fraction - start.fraction) / (now - start.time)
          setMinutesLeft(Math.ceil((1 - fraction) / rate / 60000))
        }
      } catch {
        /* the next poll tries again */
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [jobId])

  const stage = progress?.stage || 'loading'
  const fraction = stage === 'grouping' ? 1 : progress?.total ? progress.done / progress.total : 0

  let line
  if (stage === 'loading') line = t('finder.progressLoading', 'Loading the language model…')
  else if (stage === 'grouping') line = t('finder.progressGrouping', 'Putting the names together…')
  else if (progress.chapters > 1)
    line = t('finder.progressChapter', 'Reading chapter {{n}} of {{total}}', {
      n: progress.chapter,
      total: progress.chapters
    })
  else line = t('finder.progressReading', 'Reading…')

  let eta = null
  if (stage === 'reading' && minutesLeft != null)
    eta =
      minutesLeft <= 1
        ? t('finder.etaUnderMinute', 'about a minute left')
        : t('finder.etaMinutes', 'about {{count}} minutes left', { count: minutesLeft })

  return (
    <div className="finder-progress" role="status" aria-live="polite">
      <div
        className={`finder-progress-track${stage === 'loading' ? ' is-waiting' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <div className="finder-progress-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <div className="finder-progress-line">
        <span>{line}</span>
        {eta && <span className="finder-progress-eta">{eta}</span>}
      </div>
    </div>
  )
}
