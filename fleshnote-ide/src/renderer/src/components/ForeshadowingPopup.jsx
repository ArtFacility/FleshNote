import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Popup for twist/foreshadowing tagging.
 * Links selected text to an existing twist or creates a new one.
 * twistMode: 'reveal' = mark as the twist reveal point
 *            'foreshadow' = mark as foreshadowing for a twist
 */
export default function ForeshadowingPopup({
  selectedText,
  position,
  projectPath,
  activeChapter,
  twistMode = 'foreshadow', // 'reveal' or 'foreshadow'
  onClose
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('existing') // 'existing' or 'new'
  const [twists, setTwists] = useState([])
  const [selectedTwistId, setSelectedTwistId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New twist fields
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [twistType, setTwistType] = useState('')
  const titleRef = useRef(null)

  const isReveal = twistMode === 'reveal'

  // Load existing twists
  useEffect(() => {
    if (!projectPath) return
    const load = async () => {
      try {
        const data = await window.api.getTwists(projectPath)
        setTwists(data?.twists || [])
        if ((data?.twists || []).length === 0) {
          setMode('new')
        }
      } catch (err) {
        console.error('Failed to load twists:', err)
      }
      setLoading(false)
    }
    load()
  }, [projectPath])

  // Focus title when switching to new mode
  useEffect(() => {
    if (mode === 'new') {
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [mode])

  const handleSave = async () => {
    if (!projectPath) return

    setSaving(true)
    try {
      let twistId = null

      if (mode === 'existing' && selectedTwistId) {
        twistId = parseInt(selectedTwistId)
      } else if (mode === 'new' && newTitle.trim()) {
        // Create new twist
        const result = await window.api.createTwist({
          project_path: projectPath,
          title: newTitle.trim(),
          description: newDescription.trim(),
          twist_type: twistType || '',
          notes: activeChapter
            ? t('popup.firstTaggedInChapter', 'First tagged in Ch.{{chapter}}', {
              chapter: activeChapter.chapter_number
            })
            : ''
        })
        twistId = result?.twist?.id

        await window.api.updateStat({
          project_path: projectPath,
          stat_key: 'new_twists',
          increment_by: 1
        })
      }

      if (!twistId) {
        setSaving(false)
        return
      }

      // The actual tagging happens by inserting the marker into the editor content.
      // The backend parses these markers on save and populates the foreshadowings table.
      // We just need to signal back what was selected.
      // For now, we store via onClose with the twist data so the Editor can insert the span.
      onClose({
        twistId,
        markerType: isReveal ? 'twist' : 'foreshadow',
        selectedText,
        isNew: mode === 'new'
      })
    } catch (err) {
      console.error('Failed to tag twist/foreshadowing:', err)
    }
    setSaving(false)
  }

  const statusColor = (status) => {
    switch (status) {
      case 'planned':
        return 'var(--text-tertiary)'
      case 'hinted':
        return 'var(--accent-amber)'
      case 'revealed':
        return 'var(--accent-green)'
      default:
        return 'var(--text-tertiary)'
    }
  }

  const truncatedText =
    selectedText.length > 50 ? selectedText.substring(0, 50) + '...' : selectedText

  const popupTitle = isReveal
    ? t('popup.tagTwistRevealTitle', 'Tag as Twist Reveal')
    : t('popup.tagForeshadowingTitle', 'Tag as Foreshadowing')

  const popupSubtitle = isReveal
    ? t('popup.linkTwistRevealSubtitle', 'Mark "{{text}}" as the reveal point for a twist.', {
      text: truncatedText
    })
    : t('popup.linkForeshadowSubtitle', 'Link "{{text}}" to a twist as a foreshadowing marker.', {
      text: truncatedText
    })

  return (
    <div className="popup-overlay" onClick={() => onClose()}>
      <div
        className="popup-panel popup-wide"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 400),
          top: Math.min(position.y, window.innerHeight - 450)
        }}
      >
        <div className="popup-header">
          <span>{popupTitle}</span>
          <button className="popup-close" onClick={() => onClose()}>
            &times;
          </button>
        </div>
        <div className="popup-subtitle">{popupSubtitle}</div>

        {loading ? (
          <div className="popup-loading">{t('popup.loadingTwists', 'Loading twists...')}</div>
        ) : (
          <>
            {/* Mode toggle */}
            {twists.length > 0 && (
              <div className="popup-tab-row">
                <button
                  className={`popup-tab ${mode === 'existing' ? 'active' : ''}`}
                  onClick={() => setMode('existing')}
                >
                  {t('popup.existingTwist', 'Existing Twist')}
                </button>
                <button
                  className={`popup-tab ${mode === 'new' ? 'active' : ''}`}
                  onClick={() => setMode('new')}
                >
                  {t('popup.newTwist', 'New Twist')}
                </button>
              </div>
            )}

            {mode === 'existing' && twists.length > 0 ? (
              <div className="popup-field">
                <label className="popup-label">
                  {isReveal
                    ? t('popup.whichTwistRevealed', 'Which twist is revealed here?')
                    : t('popup.whichTwistForeshadow', 'Which twist does this foreshadow?')}
                </label>
                <div className="popup-secret-list">
                  {twists.map((tw) => (
                    <button
                      key={tw.id}
                      className={`popup-secret-item ${selectedTwistId === String(tw.id) ? 'selected' : ''}`}
                      onClick={() => setSelectedTwistId(String(tw.id))}
                    >
                      <div className="popup-secret-title">{tw.title}</div>
                      <div className="popup-secret-meta">
                        {tw.twist_type && (
                          <span className="popup-secret-type">{tw.twist_type}</span>
                        )}
                        <span style={{ color: statusColor(tw.status) }}>{tw.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="popup-field">
                  <label className="popup-label">
                    {t('popup.twistTitleLabel', 'Twist Title')}
                  </label>
                  <input
                    ref={titleRef}
                    className="popup-search-input"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('popup.whatIsTwistPlaceholder', 'What is the twist?')}
                  />
                </div>

                <div className="popup-field">
                  <label className="popup-label">{t('popup.twistTypeLabel', 'Type')}</label>
                  <select
                    className="popup-select"
                    value={twistType}
                    onChange={(e) => setTwistType(e.target.value)}
                  >
                    <option value="">{t('popup.selectTwistType', 'Select type...')}</option>
                    <option value="identity">{t('popup.twistTypeIdentity', 'Identity')}</option>
                    <option value="motive">{t('popup.twistTypeMotive', 'Motive')}</option>
                    <option value="event">{t('popup.twistTypeEvent', 'Event')}</option>
                    <option value="ability">{t('popup.twistTypeAbility', 'Ability')}</option>
                    <option value="relationship">
                      {t('popup.twistTypeRelationship', 'Relationship')}
                    </option>
                  </select>
                </div>

                <div className="popup-field">
                  <label className="popup-label">
                    {t('popup.descriptionLabel', 'Description')}
                    <span className="popup-optional">{t('popup.optional', '(optional)')}</span>
                  </label>
                  <textarea
                    className="popup-textarea"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={2}
                    placeholder={t(
                      'popup.twistDetailsPlaceholder',
                      'Details about this twist...'
                    )}
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="popup-actions">
              <button className="popup-btn cancel" onClick={() => onClose()}>
                {t('popup.cancel', 'Cancel')}
              </button>
              <button
                className="popup-btn save"
                onClick={handleSave}
                disabled={saving || (mode === 'existing' ? !selectedTwistId : !newTitle.trim())}
              >
                {saving
                  ? t('popup.saving', 'Saving...')
                  : isReveal
                    ? mode === 'existing'
                      ? t('popup.tagTwistRevealBtn', 'Tag Twist Reveal')
                      : t('popup.createTwistAndTagBtn', 'Create Twist & Tag')
                    : mode === 'existing'
                      ? t('popup.tagForeshadowingBtn', 'Tag Foreshadowing')
                      : t('popup.createTwistAndForeshadowBtn', 'Create Twist & Tag')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
