import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Popup for "Tag as Foreshadowing" action.
 * Links selected text to an existing secret or creates a new one.
 * Adds the selected text to the secret's danger_phrases array.
 */
export default function ForeshadowingPopup({
  selectedText,
  position,
  projectPath,
  activeChapter,
  onClose
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('existing') // 'existing' or 'new'
  const [secrets, setSecrets] = useState([])
  const [selectedSecretId, setSelectedSecretId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New secret fields
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [secretType, setSecretType] = useState('')
  const titleRef = useRef(null)

  // Load existing secrets
  useEffect(() => {
    if (!projectPath) return
    const load = async () => {
      try {
        const data = await window.api.getSecrets(projectPath)
        setSecrets(data?.secrets || [])
        if ((data?.secrets || []).length === 0) {
          setMode('new')
        }
      } catch (err) {
        console.error('Failed to load secrets:', err)
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
      if (mode === 'existing' && selectedSecretId) {
        // Append to existing secret's danger_phrases
        const secret = secrets.find((s) => s.id === parseInt(selectedSecretId))
        const existingPhrases = secret?.danger_phrases || []
        const updatedPhrases = [...existingPhrases, selectedText]

        await window.api.updateSecret({
          project_path: projectPath,
          secret_id: parseInt(selectedSecretId),
          danger_phrases: updatedPhrases
        })
      } else if (mode === 'new' && newTitle.trim()) {
        // Create new secret with selected text as first danger phrase
        await window.api.createSecret({
          project_path: projectPath,
          title: newTitle.trim(),
          description: newDescription.trim(),
          secret_type: secretType || '',
          danger_phrases: [selectedText],
          notes: activeChapter ? t('popup.firstTaggedInChapter', 'First tagged in Ch.{{chapter}}', { chapter: activeChapter.chapter_number }) : ''
        })
      } else {
        setSaving(false)
        return
      }

      onClose()
    } catch (err) {
      console.error('Failed to tag foreshadowing:', err)
    }
    setSaving(false)
  }

  const statusColor = (status) => {
    switch (status) {
      case 'hidden':
        return 'var(--accent-red)'
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

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-wide"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: Math.min(position.x, window.innerWidth - 400),
          top: Math.min(position.y, window.innerHeight - 450)
        }}
      >
        <div className="popup-header">
          <span>{t('popup.tagForeshadowingTitle', 'Tag as Foreshadowing')}</span>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="popup-subtitle">
          {t('popup.linkSecretSubtitle', 'Link "{{text}}" to a secret as a foreshadowing marker.', { text: truncatedText })}
        </div>

        {loading ? (
          <div className="popup-loading">{t('popup.loadingSecrets', 'Loading secrets...')}</div>
        ) : (
          <>
            {/* Mode toggle */}
            {secrets.length > 0 && (
              <div className="popup-tab-row">
                <button
                  className={`popup-tab ${mode === 'existing' ? 'active' : ''}`}
                  onClick={() => setMode('existing')}
                >
                  {t('popup.existingSecret', 'Existing Secret')}
                </button>
                <button
                  className={`popup-tab ${mode === 'new' ? 'active' : ''}`}
                  onClick={() => setMode('new')}
                >
                  {t('popup.newSecret', 'New Secret')}
                </button>
              </div>
            )}

            {mode === 'existing' && secrets.length > 0 ? (
              <div className="popup-field">
                <label className="popup-label">{t('popup.whichSecretForeshadow', 'Which secret does this foreshadow?')}</label>
                <div className="popup-secret-list">
                  {secrets.map((s) => (
                    <button
                      key={s.id}
                      className={`popup-secret-item ${selectedSecretId === String(s.id) ? 'selected' : ''}`}
                      onClick={() => setSelectedSecretId(String(s.id))}
                    >
                      <div className="popup-secret-title">{s.title}</div>
                      <div className="popup-secret-meta">
                        {s.secret_type && (
                          <span className="popup-secret-type">{s.secret_type}</span>
                        )}
                        <span style={{ color: statusColor(s.status) }}>{s.status}</span>
                        {s.danger_phrases?.length > 0 && (
                          <span>
                            {s.danger_phrases.length} {s.danger_phrases.length === 1 ? t('popup.phrase', 'phrase') : t('popup.phrases', 'phrases')}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="popup-field">
                  <label className="popup-label">{t('popup.secretTitleLabel', 'Secret Title')}</label>
                  <input
                    ref={titleRef}
                    className="popup-search-input"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('popup.whatIsSecretPlaceholder', 'What is the secret?')}
                  />
                </div>

                <div className="popup-field">
                  <label className="popup-label">{t('popup.secretTypeLabel', 'Type')}</label>
                  <select
                    className="popup-select"
                    value={secretType}
                    onChange={(e) => setSecretType(e.target.value)}
                  >
                    <option value="">{t('popup.selectSecretType', 'Select type...')}</option>
                    <option value="identity">{t('popup.secretTypeIdentity', 'Identity')}</option>
                    <option value="motive">{t('popup.secretTypeMotive', 'Motive')}</option>
                    <option value="event">{t('popup.secretTypeEvent', 'Event')}</option>
                    <option value="ability">{t('popup.secretTypeAbility', 'Ability')}</option>
                    <option value="relationship">{t('popup.secretTypeRelationship', 'Relationship')}</option>
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
                    placeholder={t('popup.secretDetailsPlaceholder', 'Details about this secret...')}
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="popup-actions">
              <button className="popup-btn cancel" onClick={onClose}>
                {t('popup.cancel', 'Cancel')}
              </button>
              <button
                className="popup-btn save"
                onClick={handleSave}
                disabled={saving || (mode === 'existing' ? !selectedSecretId : !newTitle.trim())}
              >
                {saving
                  ? t('popup.saving', 'Saving...')
                  : mode === 'existing'
                    ? t('popup.tagForeshadowingBtn', 'Tag Foreshadowing')
                    : t('popup.createSecretAndTagBtn', 'Create Secret & Tag')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
