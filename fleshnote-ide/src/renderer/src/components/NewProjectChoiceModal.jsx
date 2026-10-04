import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** The three ways to start a book: write now, bring in a manuscript, or plan it with the Architect. */
export default function NewProjectChoiceModal({ onSelect, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choices = [
    {
      id: 'write',
      accent: 'amber',
      title: t('choiceModal.writeTitle', 'Start writing now'),
      desc: t('choiceModal.writeDesc', 'Name your book and go straight to a blank first chapter. Everything else can wait.')
    },
    {
      id: 'import',
      accent: 'blue',
      title: t('choiceModal.importTitle', 'Bring in my manuscript'),
      desc: t(
        'choiceModal.importDesc',
        'Import what you’ve already written: the whole book in one file, a file per chapter, or a folder.'
      )
    },
    {
      id: 'architect',
      accent: 'purple',
      title: t('choiceModal.planTitle', 'Brainstorm a new idea'),
      desc: t(
        'choiceModal.planDesc',
        'The Story Architect: brainstorm characters and places, pick a structure, and get a chapter outline.'
      )
    }
  ]

  return (
    <div className="popup-overlay choice-overlay" onClick={onClose}>
      <div
        className="choice-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="choice-head">
          <h2 id="choice-title" className="choice-title">
            {t('choiceModal.title', 'Start a new book')}
          </h2>
          <button type="button" className="choice-close" onClick={onClose} aria-label={t('common.close', 'Close')}>
            ×
          </button>
        </div>

        <div className="choice-cards">
          {choices.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`choice-card ${c.accent}`}
              onClick={() => onSelect(c.id)}
              autoFocus={i === 0}
            >
              <span className="choice-card-title">{c.title}</span>
              <span className="choice-card-desc">{c.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
