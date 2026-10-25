import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STORY_GENRES } from '../utils/madlibs'
import { getPersonalDefaults } from '../utils/personalDefaults'
import { guessLanguage, toChapterTexts, toPayload } from '../utils/manuscriptSplits'
import ManuscriptImporter from './manuscript/ManuscriptImporter'
import EntityExtractor from './EntityExtractor'

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hu', label: 'Magyar' },
  { id: 'pl', label: 'Polski' },
  { id: 'ar', label: 'عربي' }
]

/**
 * Fullscreen new-book flow for writers who already know their story.
 *   mode 'write':  details → straight into Chapter 1.
 *   mode 'import': manuscript → details → done (optional character & place finder).
 * Every other setting keeps its genre default and lives in Project Settings.
 */
export default function ProjectStart({ workspacePath, mode, onCancel, onOpenProject }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(mode === 'import' ? 'import' : 'details')
  const [splits, setSplits] = useState([])
  const [details, setDetails] = useState({ name: '', author: '', language: 'en', genre: null })
  const [taken, setTaken] = useState([])
  const [languageGuessed, setLanguageGuessed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null) // { path, config, chapters, words }
  // Set once the book exists, so a failed import can be retried without creating it twice.
  const [bookPath, setBookPath] = useState(null)

  useEffect(() => {
    getPersonalDefaults()
      .then((d) =>
        setDetails((prev) => ({
          ...prev,
          author: prev.author || d.author_name,
          language: d.story_language || prev.language
        }))
      )
      .catch(() => {})
    if (workspacePath) {
      window.api
        .getProjects(workspacePath)
        .then((data) => setTaken((data.projects || []).map((p) => p.name.toLowerCase())))
        .catch(() => {})
    }
  }, [workspacePath])

  const name = details.name.trim()
  const nameTaken = !bookPath && taken.includes(name.toLowerCase())
  const set = (field) => (value) => setDetails((prev) => ({ ...prev, [field]: value }))

  // A single imported file usually names the book.
  const goToDetails = () => {
    if (!details.name && splits.length) {
      const sources = [...new Set(splits.map((s) => s.source).filter(Boolean))]
      if (sources.length === 1) set('name')(sources[0].replace(/\.[^.]+$/, '').replace(/_+/g, ' '))
    }
    // The finder reads the book with the language chosen here, so start from what the text looks like.
    const guess = guessLanguage(splits)
    if (guess && guess !== details.language) {
      set('language')(guess)
      setLanguageGuessed(true)
    }
    setStep('details')
  }

  const create = async () => {
    if (!name || nameTaken) return
    setBusy(true)
    setError(null)
    try {
      let path = bookPath
      if (!path) {
        const result = await window.api.initProject({
          workspace_path: workspacePath,
          project_name: name,
          questionnaire: {
            project_name: name,
            author_name: details.author.trim(),
            genre: details.genre || 'custom',
            story_language: details.language
          }
        })
        path = result.project_path
        setBookPath(path)
      }
      if (mode !== 'import') {
        onOpenProject(path)
        return
      }
      await window.api.importConfirmSplits({
        project_path: path,
        splits: toPayload(splits),
        replace_placeholder: true
      })
      const data = await window.api.loadProject(path)
      setCreated({
        path,
        config: data.config,
        count: splits.length,
        chapters: splits.length,
        words: splits.reduce((n, s) => n + s.word_count, 0)
      })
      setStep('done')
    } catch (err) {
      setError(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  const steps =
    mode === 'import'
      ? [
          { id: 'import', label: t('start.stepManuscript', 'Manuscript') },
          { id: 'details', label: t('start.stepDetails', 'Book details') },
          { id: 'done', label: t('start.stepCharacters', 'Characters & places') }
        ]
      : [{ id: 'details', label: t('start.stepDetails', 'Book details') }]
  const stepIndex = steps.findIndex((s) => s.id === (step === 'extract' ? 'done' : step))

  return (
    <div className="start-shell">
      <header className="start-header">
        <span className="start-header-title">
          {mode === 'import' ? t('start.importTitle', 'Bring in your manuscript') : t('start.writeTitle', 'A new book')}
        </span>
        {steps.length > 1 ? (
          <ol className="start-steps">
            {steps.map((s, i) => (
              <li key={s.id} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''}>
                {s.label}
              </li>
            ))}
          </ol>
        ) : null}
      </header>

      {step === 'import' ? (
        <ManuscriptImporter
          splits={splits}
          setSplits={setSplits}
          onBack={onCancel}
          backLabel={t('start.cancel', 'Cancel')}
          onConfirm={goToDetails}
          confirmLabel={() => t('start.next', 'Next')}
        />
      ) : null}

      {step === 'details' ? (
        <>
          <div className="start-body">
            <form
              className="start-form"
              onSubmit={(e) => {
                e.preventDefault()
                create()
              }}
            >
              <label className="start-label" htmlFor="start-name">
                {t('start.nameLabel', 'Title')}
              </label>
              <input
                id="start-name"
                className={`start-title-input ${nameTaken ? 'is-invalid' : ''}`}
                value={details.name}
                onChange={(e) => set('name')(e.target.value)}
                disabled={Boolean(bookPath)}
                placeholder={t('start.namePlaceholder', 'The name of your book')}
                autoFocus
              />
              {nameTaken ? (
                <div className="start-error">{t('start.nameTaken', 'You already have a book with this name here.')}</div>
              ) : null}

              <div className="start-row">
                <div>
                  <label className="start-label" htmlFor="start-author">
                    {t('start.authorLabel', 'Author')}
                  </label>
                  <input
                    id="start-author"
                    className="start-input"
                    value={details.author}
                    onChange={(e) => set('author')(e.target.value)}
                    placeholder={t('start.authorPlaceholder', 'Your name or pen name')}
                  />
                </div>
                <div>
                  <label className="start-label" htmlFor="start-language">
                    {t('start.languageLabel', 'Written in')}
                  </label>
                  <select
                    id="start-language"
                    className="start-input"
                    value={details.language}
                    onChange={(e) => {
                      set('language')(e.target.value)
                      setLanguageGuessed(false)
                    }}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {languageGuessed ? (
                <p className="start-hint">{t('start.languageGuessed', 'Language picked from your manuscript. Change it if it’s wrong.')}</p>
              ) : null}

              <span className="start-label">{t('start.genreLabel', 'Genre (optional)')}</span>
              <div className="start-chips">
                {STORY_GENRES.filter((g) => g.id !== 'custom').map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`start-chip ${details.genre === g.id ? 'is-on' : ''}`}
                    aria-pressed={details.genre === g.id}
                    onClick={() => set('genre')(details.genre === g.id ? null : g.id)}
                  >
                    {t(`architect.genres.${g.id}`, g.label)}
                  </button>
                ))}
              </div>
              <p className="start-hint">
                {t(
                  'start.genreHint',
                  'The genre switches on sensible tools (species, factions, magic or technology). Everything can be changed later in Project Settings.'
                )}
              </p>

              {error ? <div className="start-error">{error}</div> : null}
            </form>
          </div>
          <footer className="start-footer">
            <div className="start-footer-info">
              {mode === 'import'
                ? t('manuscript.summary', '{{chapters}} chapters · {{words}} words', {
                    count: splits.length,
                    chapters: splits.length,
                    words: splits.reduce((n, s) => n + s.word_count, 0).toLocaleString()
                  })
                : null}
            </div>
            <div className="start-footer-actions">
              <button type="button" className="start-ghost" onClick={mode === 'import' ? () => setStep('import') : onCancel}>
                {mode === 'import' ? t('start.back', 'Back') : t('start.cancel', 'Cancel')}
              </button>
              <button type="button" className="start-primary" disabled={!name || nameTaken || busy} onClick={create}>
                {busy
                  ? t('start.creating', 'Creating…')
                  : mode === 'import'
                    ? t('start.createAndImport', 'Create the book')
                    : t('start.startWriting', 'Start writing')}
              </button>
            </div>
          </footer>
        </>
      ) : null}

      {step === 'done' && created ? (
        <>
          <div className="start-body">
            <div className="start-done">
              <h2 className="start-done-title">{t('start.doneTitle', 'Your manuscript is in.')}</h2>
              <p className="start-done-sub">
                {t('start.doneSub', '{{chapters}} chapters, {{words}} words.', {
                  chapters: created.chapters,
                  words: created.words.toLocaleString()
                })}
              </p>
              <p className="start-hint">
                {t(
                  'start.extractHint',
                  'FleshNote can read it and suggest the characters and places it finds, ready in your Entity Manager. You can also do this later from the Import menu.'
                )}
              </p>
            </div>
          </div>
          <footer className="start-footer">
            <div className="start-footer-info" />
            <div className="start-footer-actions">
              <button type="button" className="start-ghost" onClick={() => setStep('extract')}>
                {t('start.findEntities', 'Find characters and places')}
              </button>
              <button type="button" className="start-primary" onClick={() => onOpenProject(created.path)}>
                {t('start.startWriting', 'Start writing')}
              </button>
            </div>
          </footer>
        </>
      ) : null}

      {step === 'extract' && created ? (
        <div className="start-stage">
          <EntityExtractor
            projectPath={created.path}
            projectConfig={created.config}
            chapterTexts={toChapterTexts(splits)}
            onDone={() => onOpenProject(created.path)}
            onBack={() => setStep('done')}
          />
        </div>
      ) : null}
    </div>
  )
}
