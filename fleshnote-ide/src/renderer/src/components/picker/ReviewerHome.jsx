import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ReviewerHome({ onOpenPackage }) {
  const { t } = useTranslation()
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState(null)

  const openPath = async (path) => {
    setError(null)
    try {
      const res = await window.api.openReviewPackage({ path })
      if (res?.status === 'ok') {
        onOpenPackage({ path: res.path, pkg: res.package })
      } else if (res?.status !== 'cancelled') {
        setError(res?.message || t('picker.reviewOpenError', 'Could not open review file.'))
      }
    } catch (err) {
      setError(err.message || t('picker.reviewOpenError', 'Could not open review file.'))
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const res = await window.api.openReviewPackage({})
      if (res?.status === 'ok') {
        onOpenPackage({ path: res.path, pkg: res.package })
      } else if (res?.status !== 'cancelled') {
        setError(res?.message || t('picker.reviewOpenError', 'Could not open review file.'))
      }
    } catch (err) {
      setError(err.message || t('picker.reviewOpenError', 'Could not open review file.'))
    }
  }

  return (
    <>
      <div className="picker-main-head">
        <span className="picker-kicker">{t('picker.navReviewer', 'Reviewer mode')}</span>
        <h2 className="picker-title">{t('picker.reviewerTitle', 'Open a review package')}</h2>
        <p className="picker-sub">{t('picker.reviewerSub', 'Read a pruned manuscript and leave non-destructive notes. Hand the file back to the author.')}</p>
      </div>

      <div
        className={`picker-drop ${dropActive ? 'is-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          const file = e.dataTransfer?.files?.[0]
          const path = file?.path
          if (path && path.toLowerCase().endsWith('.flreview')) openPath(path)
        }}
      >
        <div className="picker-drop-title">{t('picker.reviewerDrop', 'Drop a .flreview file here')}</div>
        <div className="picker-drop-hint">{t('picker.reviewerDropHint', 'Or browse for a package the author exported for review.')}</div>
        <button type="button" className="picker-primary" onClick={handleBrowse}>
          {t('picker.reviewerBrowse', 'Open .flreview')}
        </button>
        {error && <div className="picker-drop-hint" style={{ color: 'var(--accent-red)' }}>{error}</div>}
      </div>
    </>
  )
}
