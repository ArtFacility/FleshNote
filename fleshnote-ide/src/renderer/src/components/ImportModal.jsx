import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ImportManuscript from './ImportManuscript'
import EntityExtractor from './EntityExtractor'
import EntityExtractorLoading from './EntityExtractorLoading'

// ── Icons ────────────────────────────────────────────────────────────

const Icons = {
  Upload: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Target: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  FolderOpen: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
}

// ── External Project Import Sub-View ─────────────────────────────────

function ExternalProjectImport({ projectPath, onDone, onBack }) {
  const { t } = useTranslation()
  const [sourcePath, setSourcePath] = useState(null)
  const [sourceEntities, setSourceEntities] = useState([])
  const [existingNames, setExistingNames] = useState(new Set())
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleSelectFolder = async () => {
    const folderPath = await window.api.selectFolder()
    if (!folderPath) return

    setSourcePath(folderPath)
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.importExternalEntities({
        source_project_path: folderPath,
        target_project_path: projectPath,
      })
      setSourceEntities(data.source_entities || [])
      setExistingNames(new Set((data.existing_names || []).map(n => n.toLowerCase())))
      // Pre-select all non-duplicate entities
      const preSelected = new Set()
      ;(data.source_entities || []).forEach((e, i) => {
        if (!data.existing_names.includes(e.name.toLowerCase())) {
          preSelected.add(i)
        }
      })
      setSelected(preSelected)
    } catch (err) {
      setError(err.message || 'Failed to read project')
    } finally {
      setLoading(false)
    }
  }

  const toggleEntity = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === sourceEntities.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sourceEntities.map((_, i) => i)))
    }
  }

  const handleImport = async () => {
    const toImport = sourceEntities.filter((_, i) => selected.has(i))
    if (toImport.length === 0) return

    setImporting(true)
    try {
      const data = await window.api.importExternalEntitiesConfirm({
        target_project_path: projectPath,
        entities: toImport,
      })
      setResult(data.created || [])
      onDone()
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const typeLabels = {
    character: t('importModal.typeCharacter', 'Character'),
    location: t('importModal.typeLocation', 'Location'),
    lore: t('importModal.typeLore', 'Lore'),
    group: t('importModal.typeGroup', 'Group'),
  }

  const typeColors = {
    character: 'var(--accent-amber)',
    location: 'var(--accent-green, #6b8f6b)',
    lore: 'var(--accent-purple, #9b7db8)',
    group: 'var(--accent-blue, #6b8fb0)',
  }

  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <Icons.Check />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>
          {t('importModal.importSuccess', 'Successfully imported {{count}} entities', { count: result.length })}
        </div>
        <button className="import-btn primary" onClick={onBack}>
          {t('importModal.done', 'Done')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
        {t('importModal.externalDesc', 'Select another FleshNote project folder to import characters, locations, lore, and groups from.')}
      </p>

      <button className="import-btn secondary" onClick={handleSelectFolder} disabled={loading} style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
        <Icons.FolderOpen /> {t('importModal.selectProject', 'Select Project Folder...')}
      </button>

      {sourcePath && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          {sourcePath}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 32, textAlign: 'center' }}>
          {t('importModal.loadingEntities', 'Reading entities from project...')}
        </div>
      )}

      {sourceEntities.length > 0 && !loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {t('importModal.foundEntities', '{{count}} entities found · {{selected}} selected', { count: sourceEntities.length, selected: selected.size })}
            </span>
            <button
              onClick={toggleAll}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {selected.size === sourceEntities.length ? t('importModal.deselectAll', 'Deselect All') : t('importModal.selectAll', 'Select All')}
            </button>
          </div>

          <div className="import-entity-checklist">
            {sourceEntities.map((entity, i) => {
              const isDuplicate = existingNames.has(entity.name.toLowerCase())
              return (
                <div
                  key={i}
                  className={`import-entity-row ${selected.has(i) ? 'selected' : ''}`}
                  onClick={() => toggleEntity(i)}
                >
                  <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div className={`import-checkbox ${selected.has(i) ? 'checked' : ''}`}>
                      {selected.has(i) && <Icons.Check />}
                    </div>
                  </div>
                  <span className="import-entity-type-badge" style={{ color: typeColors[entity.type] || 'var(--text-tertiary)' }}>
                    {typeLabels[entity.type] || entity.type}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                    {entity.name}
                  </span>
                  {entity.aliases?.length > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {entity.aliases.join(', ')}
                    </span>
                  )}
                  {isDuplicate && (
                    <span className="import-duplicate-badge">
                      {t('importModal.alreadyExists', 'Already exists')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="import-btn primary" onClick={handleImport} disabled={importing || selected.size === 0}>
              {importing
                ? t('importModal.importing', 'Importing...')
                : t('importModal.importSelected', 'Import {{count}} Selected', { count: selected.size })
              }
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Import Modal ────────────────────────────────────────────────

export default function ImportModal({ isOpen, onClose, projectPath, projectConfig, chapters, entities, onDataChanged }) {
  const { t } = useTranslation()
  const [view, setView] = useState('landing')
  const [splits, setSplits] = useState([])
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [chapterTexts, setChapterTexts] = useState(null)
  const [loadingChapters, setLoadingChapters] = useState(false)

  const handleClose = useCallback(() => {
    setView('landing')
    setSplits([])
    setChapterTexts(null)
    onClose()
  }, [onClose])

  const handleBack = useCallback(() => {
    setView('landing')
    setSplits([])
    setChapterTexts(null)
  }, [])

  // ── Import Chapters: confirm splits ──
  const handleConfirmSplits = async () => {
    if (splits.length === 0) return
    setConfirmLoading(true)
    try {
      await window.api.importConfirmSplits({
        project_path: projectPath,
        splits: splits.map(s => ({ title: s.title, content: s.content })),
      })
      onDataChanged()
      handleBack()
    } catch (err) {
      console.error('Import chapters failed:', err)
      alert('Failed to import chapters: ' + err.message)
    } finally {
      setConfirmLoading(false)
    }
  }

  // ── Extract from existing chapters ──
  const handleExtractFromExisting = async () => {
    if (!chapters || chapters.length === 0) return
    setLoadingChapters(true)
    setView('extract-existing')
    try {
      const texts = await Promise.all(
        chapters.map(async (ch) => {
          const data = await window.api.loadChapterContent(projectPath, ch.id)
          // Strip HTML tags to get plain text for NER
          const plainText = (data.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          return { index: ch.chapter_number - 1, title: ch.title, content: plainText }
        })
      )
      setChapterTexts(texts.filter(t => t.content.length > 0))
    } catch (err) {
      console.error('Failed to load chapters:', err)
    } finally {
      setLoadingChapters(false)
    }
  }

  const handleEntityExtractDone = useCallback(() => {
    onDataChanged()
    handleBack()
  }, [onDataChanged, handleBack])

  if (!isOpen) return null

  const headerTitle = {
    landing: t('importModal.title', 'Import'),
    chapters: t('importModal.importChapters', 'Import Chapters'),
    'extract-existing': t('importModal.extractEntities', 'Extract Entities'),
    'extract-manual': t('importModal.extractEntities', 'Extract Entities'),
    external: t('importModal.importFromProject', 'Import from Project'),
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal" style={{ width: '95vw', maxWidth: '1280px', height: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', position: 'relative', borderRadius: 8 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {view !== 'landing' && (
            <button
              onClick={handleBack}
              className="import-back-btn"
              title={t('importModal.back', 'Back')}
            >
              <Icons.ArrowLeft />
            </button>
          )}
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            {headerTitle[view] || headerTitle.landing}
          </h2>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <Icons.X />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

          {/* Landing */}
          {view === 'landing' && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 24, lineHeight: 1.5 }}>
                {t('importModal.landingDesc', 'Add content to your project from external sources.')}
              </p>
              <div className="import-landing-cards">
                {/* Card 1: Import Chapters */}
                <button className="import-landing-card" onClick={() => setView('chapters')}>
                  <Icons.Upload />
                  <div className="import-card-label">{t('importModal.importChapters', 'Import Chapters')}</div>
                  <div className="import-card-desc">
                    {t('importModal.importChaptersDesc', 'Add chapters from a manuscript file (.txt, .md, .docx)')}
                  </div>
                </button>

                {/* Card 2: Extract Entities */}
                <div className="import-landing-card" style={{ cursor: 'default' }}>
                  <Icons.Target />
                  <div className="import-card-label">{t('importModal.extractEntities', 'Extract Entities')}</div>
                  <div className="import-card-desc">
                    {t('importModal.extractEntitiesDesc', 'Detect characters and locations using NLP analysis')}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%' }}>
                    <button
                      className="import-btn secondary"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={handleExtractFromExisting}
                      disabled={!chapters || chapters.length === 0}
                    >
                      {t('importModal.fromExistingChapters', 'From Existing Chapters')}
                    </button>
                    <button
                      className="import-btn secondary"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={() => setView('extract-manual')}
                    >
                      {t('importModal.fromPastedText', 'From Pasted Text')}
                    </button>
                  </div>
                </div>

                {/* Card 3: Import from Project */}
                <button className="import-landing-card" onClick={() => setView('external')}>
                  <Icons.FolderOpen />
                  <div className="import-card-label">{t('importModal.importFromProject', 'Import from Project')}</div>
                  <div className="import-card-desc">
                    {t('importModal.importFromProjectDesc', 'Import entities from another FleshNote project')}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Import Chapters */}
          {view === 'chapters' && (
            <ImportManuscript
              projectPath={projectPath}
              splits={splits}
              setSplits={setSplits}
              onCancel={handleBack}
              onConfirm={handleConfirmSplits}
              loading={confirmLoading}
            />
          )}

          {/* Extract from Existing Chapters */}
          {view === 'extract-existing' && (
            loadingChapters ? (
              <EntityExtractorLoading subtitle={t('importModal.loadingChapterContent', 'Loading chapter content for analysis...')} />
            ) : chapterTexts ? (
              <EntityExtractor
                projectPath={projectPath}
                projectConfig={projectConfig}
                chapterTexts={chapterTexts}
                onDone={handleEntityExtractDone}
                onBack={handleBack}
              />
            ) : null
          )}

          {/* Extract from Pasted Text */}
          {view === 'extract-manual' && (
            <EntityExtractor
              projectPath={projectPath}
              projectConfig={projectConfig}
              onDone={handleEntityExtractDone}
              onBack={handleBack}
            />
          )}

          {/* Import from External Project */}
          {view === 'external' && (
            <ExternalProjectImport
              projectPath={projectPath}
              onDone={() => onDataChanged()}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  )
}
