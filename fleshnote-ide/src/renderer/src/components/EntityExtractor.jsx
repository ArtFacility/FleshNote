import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * EntityExtractor — Dual-pane worldbuilding data importer.
 *
 * Left pane:  Raw text (paste or open file)
 * Right pane: Entity form fields
 * Middle:     "Attempt Conversion" button (regex + spaCy NER)
 *
 * This component is designed to be used standalone or embedded in the
 * ProjectSetup wizard. It handles one entity at a time — user selects
 * the entity type, fills the form, saves, and repeats.
 */

const Icons = {
  User: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  MapPin: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Gem: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M2 9h20" />
    </svg>
  ),
  Zap: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Upload: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

const ENTITY_TYPES = [
  { key: 'character', label: 'Character', icon: Icons.User, color: 'var(--entity-character)' },
  { key: 'location', label: 'Location', icon: Icons.MapPin, color: 'var(--entity-location)' },
  { key: 'item', label: 'Item', icon: Icons.Gem, color: 'var(--entity-item)' }
]

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  marginBottom: '10px'
}

const labelStyle = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '4px'
}

export default function EntityExtractor({ projectPath, onDone }) {
  const { t } = useTranslation()
  const [entityType, setEntityType] = useState(null)
  const [rawText, setRawText] = useState('')
  const [nerHighlights, setNerHighlights] = useState([])
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedEntities, setSavedEntities] = useState([])

  // Form fields (shared across types, used fields vary)
  const [form, setForm] = useState({
    name: '',
    role: '',
    bio: '',
    species: '',
    age: '',
    region: '',
    description: '',
    classification: '',
    origin: ''
  })

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      role: '',
      bio: '',
      species: '',
      age: '',
      region: '',
      description: '',
      classification: '',
      origin: ''
    })
  }

  // ── Load file into left pane ────────────────────────
  const handleOpenFile = async () => {
    const filePath = await window.api.openFile([
      { name: 'Text Files', extensions: ['txt', 'md', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (filePath) {
      try {
        setConverting(true)
        // We can use the split-preview endpoint even if we don't care about splits,
        // because it returns the full text read from Docx/Txt/Md
        const result = await window.api.importSplitPreview({
          project_path: projectPath,
          file_path: filePath
        })

        if (result && result.splits) {
          // Join all split contents to get the full file text
          const fullText = result.splits.map(s => s.content).join('\n\n')
          setRawText(fullText)
        }
      } catch (err) {
        console.error('Failed to load file:', err)
        alert('Failed to read file: ' + err.message)
      } finally {
        setConverting(false)
      }
    }
  }

  // ── Attempt conversion (regex + NER) ────────────────
  const handleConvert = async () => {
    if (!rawText.trim()) return
    setConverting(true)

    try {
      // 1. Run spaCy NER
      const nerResult = await window.api.importNerExtract({ text: rawText })
      setNerHighlights(nerResult.entities || [])

      // 2. Regex-based field extraction
      const lines = rawText.split('\n')
      const extracted = {}

      for (const line of lines) {
        const colonMatch = line.match(/^([A-Za-z\s]+?)[:—\-]\s*(.+)$/)
        if (colonMatch) {
          const key = colonMatch[1].trim().toLowerCase()
          const value = colonMatch[2].trim()

          if (key.includes('name')) extracted.name = value
          else if (key.includes('role') || key.includes('class')) extracted.role = value
          else if (key.includes('age')) extracted.age = value
          else if (key.includes('species') || key.includes('race')) extracted.species = value
          else if (key.includes('bio') || key.includes('description') || key.includes('desc'))
            extracted.description = value
          else if (key.includes('region') || key.includes('location')) extracted.region = value
          else if (key.includes('origin')) extracted.origin = value
          else if (key.includes('classification') || key.includes('type'))
            extracted.classification = value
        }
      }

      // If no name was found via regex, try the first NER entity of the matching type
      if (!extracted.name && nerResult.entities?.length > 0) {
        const typeMatch = nerResult.entities.find((e) => e.type === entityType)
        if (typeMatch) extracted.name = typeMatch.text
      }

      // Apply to form (only fill empty fields)
      setForm((prev) => {
        const updated = { ...prev }
        for (const [key, value] of Object.entries(extracted)) {
          if (!updated[key] && value) updated[key] = value
        }
        // Use description for bio if character
        if (entityType === 'character' && extracted.description && !updated.bio) {
          updated.bio = extracted.description
        }
        return updated
      })
    } catch (err) {
      console.error('Conversion failed:', err)
    } finally {
      setConverting(false)
    }
  }

  // ── Save entity ─────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    try {
      if (entityType === 'character') {
        await window.api.createCharacter({
          project_path: projectPath,
          name: form.name.trim(),
          role: form.role,
          species: form.species,
          bio: form.bio
        })
      } else if (entityType === 'location') {
        await window.api.createLocation({
          project_path: projectPath,
          name: form.name.trim(),
          region: form.region,
          description: form.description
        })
      } else if (entityType === 'item') {
        await window.api.createLoreEntity({
          project_path: projectPath,
          name: form.name.trim(),
          category: 'item',
          classification: form.classification,
          description: form.description,
          origin: form.origin
        })
      }

      setSavedEntities((prev) => [...prev, { type: entityType, name: form.name }])
      resetForm()
      setEntityType(null)
    } catch (err) {
      console.error('Save failed:', err)
      alert(t('extractor.failedSave', 'Failed to save:') + ' ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Entity type selection ───────────────────────────
  if (!entityType) {
    return (
      <div className="extractor-container">
        <div className="extractor-header">
          <h3
            style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--text-primary)' }}
          >
            {t('extractor.title', 'Worldbuilding Extractor')}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {t('extractor.subtitle', 'Select an entity type to create, then paste or load reference text.')}
          </p>
        </div>

        <div className="extractor-type-grid">
          {ENTITY_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.key}
                className="extractor-type-btn"
                style={{ borderColor: type.color }}
                onClick={() => setEntityType(type.key)}
              >
                <Icon />
                <span>{t(`extractor.add_${type.key}`, `Add ${type.label}`)}</span>
              </button>
            )
          })}
        </div>

        {savedEntities.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8
              }}
            >
              {t('extractor.saved', 'Saved')} ({savedEntities.length})
            </div>
            {savedEntities.map((e, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ color: 'var(--accent-amber)', marginInlineEnd: 8 }}>{e.type}</span>
                {e.name}
              </div>
            ))}
          </div>
        )}

        <button className="setup-btn secondary" style={{ marginTop: 24 }} onClick={onDone}>
          {t('extractor.done', 'Done importing')}
        </button>
      </div>
    )
  }

  // ── Dual-pane layout ────────────────────────────────
  const typeInfo = ENTITY_TYPES.find((t) => t.key === entityType)

  return (
    <div className="extractor-container">
      <div className="extractor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="setup-btn secondary"
            style={{ padding: '4px 10px' }}
            onClick={() => setEntityType(null)}
          >
            {t('extractor.back', 'Back')}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: typeInfo.color }}>
            {t(`extractor.new_${typeInfo.key}`, `New ${typeInfo.label}`)}
          </span>
        </div>
      </div>

      <div className="extractor-dual-pane">
        {/* Left pane: raw text */}
        <div className="extractor-pane-left">
          <div className="extractor-pane-toolbar">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-tertiary)'
              }}
            >
              {t('extractor.rawText', 'RAW TEXT')}
            </span>
            <button className="setup-split-btn" onClick={handleOpenFile}>
              <Icons.Upload /> {t('extractor.openFile', 'Open File')}
            </button>
          </div>
          <textarea
            className="extractor-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t('extractor.placeholderPane', 'Paste character/location/item description here...')}
          />
        </div>

        {/* Middle: convert button */}
        <div className="extractor-middle">
          <button
            className="extractor-convert-btn"
            onClick={handleConvert}
            disabled={converting || !rawText.trim()}
          >
            <Icons.Zap />
            {converting ? t('extractor.converting', '...') : t('extractor.convert', 'Convert')}
          </button>
        </div>

        {/* Right pane: form fields */}
        <div className="extractor-pane-right">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              marginBottom: 12
            }}
          >
            {t(`extractor.fields_${typeInfo.key}`, `${typeInfo.label.toUpperCase()} FIELDS`)}
          </div>

          <label style={labelStyle}>{t('extractor.fieldName', 'NAME *')}</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
          />

          {entityType === 'character' && (
            <>
              <label style={labelStyle}>{t('extractor.fieldRole', 'ROLE')}</label>
              <input
                style={inputStyle}
                value={form.role}
                onChange={(e) => updateForm('role', e.target.value)}
                placeholder={t('extractor.rolePlaceholder', 'e.g. Protagonist')}
              />
              <label style={labelStyle}>{t('extractor.fieldAge', 'AGE')}</label>
              <input
                style={inputStyle}
                value={form.age}
                onChange={(e) => updateForm('age', e.target.value)}
              />
              <label style={labelStyle}>{t('extractor.fieldSpecies', 'SPECIES')}</label>
              <input
                style={inputStyle}
                value={form.species}
                onChange={(e) => updateForm('species', e.target.value)}
              />
              <label style={labelStyle}>{t('extractor.fieldBio', 'BIO')}</label>
              <textarea
                style={{ ...inputStyle, height: 80, resize: 'vertical' }}
                value={form.bio}
                onChange={(e) => updateForm('bio', e.target.value)}
              />
            </>
          )}

          {entityType === 'location' && (
            <>
              <label style={labelStyle}>{t('extractor.fieldRegion', 'REGION')}</label>
              <input
                style={inputStyle}
                value={form.region}
                onChange={(e) => updateForm('region', e.target.value)}
              />
              <label style={labelStyle}>{t('extractor.fieldDescription', 'DESCRIPTION')}</label>
              <textarea
                style={{ ...inputStyle, height: 100, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </>
          )}

          {entityType === 'item' && (
            <>
              <label style={labelStyle}>{t('extractor.fieldClass', 'CLASSIFICATION')}</label>
              <input
                style={inputStyle}
                value={form.classification}
                onChange={(e) => updateForm('classification', e.target.value)}
              />
              <label style={labelStyle}>{t('extractor.fieldOrigin', 'ORIGIN')}</label>
              <input
                style={inputStyle}
                value={form.origin}
                onChange={(e) => updateForm('origin', e.target.value)}
              />
              <label style={labelStyle}>{t('extractor.fieldDescription', 'DESCRIPTION')}</label>
              <textarea
                style={{ ...inputStyle, height: 100, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </>
          )}

          <button
            className="setup-btn primary"
            style={{ marginTop: 8 }}
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? t('extractor.saving', 'Saving...') : t(`extractor.save_${typeInfo.key}`, `Save ${typeInfo.label}`)}
          </button>
        </div>
      </div>
    </div>
  )
}
