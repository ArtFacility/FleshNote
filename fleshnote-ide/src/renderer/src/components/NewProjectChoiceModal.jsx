import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import OptionCard, { OptionIcons } from './OptionCard'

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
      icon: OptionIcons.pen,
      title: t('choiceModal.writeTitle', 'Start writing now'),
      desc: t('choiceModal.writeDesc', 'Name your book and go straight to a blank first chapter. Everything else can wait.')
    },
    {
      id: 'import',
      icon: OptionIcons.importFile,
      title: t('choiceModal.importTitle', 'Bring in my manuscript'),
      desc: t(
        'choiceModal.importDesc',
        'Import what you’ve already written: the whole book in one file, a file per chapter, or a folder.'
      )
    },
    {
      id: 'architect',
      icon: OptionIcons.compass,
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
            <OptionCard key={c.id} icon={c.icon} title={c.title} desc={c.desc}
              onClick={() => onSelect(c.id)} autoFocus={i === 0} />
          ))}
        </div>
      </div>
    </div>
  )
}
