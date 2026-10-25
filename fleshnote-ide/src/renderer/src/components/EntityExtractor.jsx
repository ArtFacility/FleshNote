import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EntityExtractorLoading from './EntityExtractorLoading'
import AnalysisProgress from './finder/AnalysisProgress'
import EntityBoard from './finder/EntityBoard'
import QuickSort from './finder/QuickSort'
import { counts, itemsFromAnalysis, toCreatePayload } from '../utils/entityBoard'

const HISTORY_LIMIT = 50

/**
 * The character & place finder. Reads chapters (or pasted text), proposes the
 * names it finds on a board the writer tidies up, then creates the entities.
 *
 * Phases: 'input' (paste text) → 'analyzing' → 'review' (board) ⇄ 'sorting'
 * (one by one) → 'creating'; 'error' from any of them.
 */
export default function EntityExtractor({ projectPath, projectConfig, onDone, onBack, chapterTexts }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState(chapterTexts?.length ? 'analyzing' : 'input')
  const [rawText, setRawText] = useState('')
  const [items, setItems] = useState([])
  const [history, setHistory] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [sortRare, setSortRare] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [alreadyKnown, setAlreadyKnown] = useState(0)
  const [jobId, setJobId] = useState(null)
  // Names found in chapters can be linked there as they're added; on by
  // default unless the writer switched off the Janitor's link suggestions.
  const [linkInChapters, setLinkInChapters] = useState(projectConfig?.janitor_show_link_existing !== false)

  const initialCategories = useMemo(() => {
    try {
      const raw = projectConfig?.lore_categories
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch {
      /* fall through */
    }
    return ['item']
  }, [projectConfig])
  const [loreCategories, setLoreCategories] = useState(initialCategories)
  useEffect(() => setLoreCategories(initialCategories), [initialCategories])

  // Every board change is undoable.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const historyRef = useRef(history)
  historyRef.current = history
  const change = useCallback((next) => {
    setHistory([...historyRef.current.slice(-HISTORY_LIMIT + 1), itemsRef.current])
    setItems(next)
  }, [])
  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.length) return
    setItems(h[h.length - 1])
    setHistory(h.slice(0, -1))
  }, [])

  useEffect(() => {
    if (phase !== 'review') return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, undo])

  const runAnalysis = async (texts) => {
    const job = `ner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setJobId(job)
    setPhase('analyzing')
    setErrorMsg('')
    try {
      const payload = { project_path: projectPath, language: projectConfig?.story_language || 'en', job_id: job }
      if (texts) {
        payload.texts = texts.map((c, i) => ({
          index: c.index ?? i,
          title: c.title || `Section ${i + 1}`,
          content: c.content || ''
        }))
      } else {
        payload.text = rawText
      }
      const result = await window.api.importNerAnalyze(payload)
      setItems(itemsFromAnalysis(result, initialCategories[0] || 'item'))
      setAlreadyKnown(result.already_known || 0)
      setHistory([])
      setSelectedId(null)
      setPhase('review')
    } catch (err) {
      console.error('Name finding failed:', err)
      setErrorMsg(err.message || t('extractor.errorAnalysis', 'Analysis failed'))
      setPhase('error')
    }
  }

  useEffect(() => {
    if (chapterTexts?.length) runAnalysis(chapterTexts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addLoreCategory = async (name) => {
    if (!name || loreCategories.includes(name)) return
    const updated = [...loreCategories, name]
    setLoreCategories(updated)
    try {
      await window.api.updateProjectConfig(projectPath, 'lore_categories', updated, 'json')
    } catch (err) {
      console.error('Failed to save lore category:', err)
    }
  }

  const confirm = async () => {
    const entities = toCreatePayload(items)
    if (!entities.length) {
      onDone()
      return
    }
    setPhase('creating')
    try {
      await window.api.importBulkCreateEntities({
        project_path: projectPath,
        entities,
        link_in_chapters: Boolean(chapterTexts) && linkInChapters
      })
      onDone()
    } catch (err) {
      console.error('Creating entities failed:', err)
      setErrorMsg(err.message || t('extractor.errorCreate', 'Failed to create entities'))
      setPhase('error')
    }
  }

  const openFile = async () => {
    const filePath = await window.api.openFile([
      { name: 'Text Files', extensions: ['txt', 'md', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (!filePath) return
    try {
      const result = await window.api.importSplitPreview({ project_path: projectPath, file_path: filePath })
      setRawText((result.splits || []).map((s) => s.content).join('\n\n'))
    } catch (err) {
      setErrorMsg(err.message || String(err))
    }
  }

  const back = () => {
    if (!chapterTexts && phase !== 'input') setPhase('input')
    else if (onBack) onBack()
    else onDone()
  }

  // ── Phases ──────────────────────────────────────────────

  if (phase === 'analyzing' || phase === 'creating') {
    return (
      <div className="finder">
        <div className="finder-body">
          <EntityExtractorLoading
            subtitle={
              phase === 'creating'
                ? chapterTexts && linkInChapters
                  ? t('finder.creatingLinking', 'Adding them and linking your chapters…')
                  : t('finder.creating', 'Adding them to your project…')
                : null
            }
          />
          {phase === 'analyzing' && <AnalysisProgress key={jobId} jobId={jobId} />}
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="finder">
        <div className="finder-body finder-centered">
          <h2 className="finder-title">{t('finder.errorTitle', 'Something went wrong')}</h2>
          <p className="finder-sub">{errorMsg}</p>
        </div>
        <footer className="start-footer">
          <div className="start-footer-info" />
          <div className="start-footer-actions">
            <button type="button" className="start-ghost" onClick={onDone}>
              {t('extractor.skipForNow', 'Skip for now')}
            </button>
            <button
              type="button"
              className="start-primary"
              onClick={() => (chapterTexts ? runAnalysis(chapterTexts) : setPhase('input'))}
            >
              {t('finder.tryAgain', 'Try again')}
            </button>
          </div>
        </footer>
      </div>
    )
  }

  if (phase === 'input') {
    return (
      <div className="finder">
        <div className="finder-body finder-paste">
          <h2 className="finder-title">{t('finder.pasteTitle', 'Find the names in some text')}</h2>
          <p className="finder-sub">
            {t('finder.pasteSub', 'Paste a chapter, your notes or a character list, or open a file.')}
          </p>
          <textarea
            className="finder-paste-input"
            dir="auto"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t('finder.pastePlaceholder', 'Paste text here…')}
          />
          {errorMsg ? <p className="start-error">{errorMsg}</p> : null}
        </div>
        <footer className="start-footer">
          <div className="start-footer-info">
            <button type="button" className="ms-text-btn" onClick={openFile}>
              {t('finder.openFile', 'Open a file')}
            </button>
          </div>
          <div className="start-footer-actions">
            <button type="button" className="start-ghost" onClick={onBack || onDone}>
              {t('start.back', 'Back')}
            </button>
            <button type="button" className="start-primary" disabled={!rawText.trim()} onClick={() => runAnalysis(null)}>
              {t('finder.findNames', 'Find names')}
            </button>
          </div>
        </footer>
      </div>
    )
  }

  const c = counts(items)
  const total = c.character + c.location + c.lore

  if (phase === 'sorting') {
    return (
      <div className="finder">
        <div className="finder-body">
          <QuickSort
            items={items}
            onChange={change}
            onDone={() => setPhase('review')}
            includeRare={sortRare}
            loreCategories={loreCategories}
            onAddLoreCategory={addLoreCategory}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="finder">
      <div className="finder-intro">
        <h2 className="finder-title">{t('finder.title', 'The people and places in your book')}</h2>
        <p className="finder-sub">
          {t(
            'finder.sub',
            'Already sorted for you. Fix anything that’s off: drag a name to another shelf, onto another name to merge them, or to “Not names”. Click a name for quotes and spellings.'
          )}
          {alreadyKnown
            ? ` ${t('finder.alreadyKnown', '{{count}} names you already have were left out.', { count: alreadyKnown })}`
            : ''}
        </p>
      </div>
      <div className="finder-body">
        <EntityBoard
          items={items}
          onChange={change}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStartQuickSort={(includeRare) => {
            setSelectedId(null)
            setSortRare(Boolean(includeRare))
            setPhase('sorting')
          }}
          loreCategories={loreCategories}
          onAddLoreCategory={addLoreCategory}
        />
      </div>
      <footer className="start-footer">
        <div className="start-footer-info">
          {history.length ? (
            <button type="button" className="ms-text-btn" onClick={undo}>
              {t('finder.undo', 'Undo')}
            </button>
          ) : null}
          {chapterTexts ? (
            <label className="finder-link-toggle" title={t('finder.linkHint', 'Every mention of these names in your chapters becomes a link. Each chapter’s History keeps a copy from before.')}>
              <input type="checkbox" checked={linkInChapters} onChange={(e) => setLinkInChapters(e.target.checked)} />
              {t('finder.linkInChapters', 'Link them in my chapters')}
            </label>
          ) : null}
        </div>
        <div className="start-footer-actions">
          <button type="button" className="start-ghost" onClick={back}>
            {t('start.back', 'Back')}
          </button>
          <button type="button" className="start-ghost" onClick={onDone}>
            {t('extractor.skipForNow', 'Skip for now')}
          </button>
          <button type="button" className="start-primary" onClick={confirm}>
            {total
              ? t('finder.add', 'Add {{list}}', {
                  list: [
                    c.character ? t('finder.nPeople', { count: c.character }) : null,
                    c.location ? t('finder.nPlaces', { count: c.location }) : null,
                    c.lore ? t('finder.nThings', { count: c.lore }) : null
                  ]
                    .filter(Boolean)
                    .join(', ')
                })
              : t('finder.finishEmpty', 'Finish without adding')}
          </button>
        </div>
      </footer>
    </div>
  )
}
