import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { STORY_GENRES } from '../utils/madlibs'

const CHAR_RUNE = '𐲤'
const LOC_RUNE = '𐲛'
const NOTE_RUNE = '𐲀'

const CHAR_RING = 105
const LOC_RING = 163
const NOTE_RING = 221
const RING_STEP = 58

export default function BrainstormHub({
  characters = [],
  locations = [],
  notes = [],
  genre = 'fantasy',
  onGenreChange,
  storyIdea,
  onEditIdea,
  onRerollIdea,
  onOpenCharacter,
  onOpenLocation,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onNext
}) {
  const { t } = useTranslation()
  const totalCount = characters.length + locations.length + notes.length

  const [noteEditor, setNoteEditor] = useState(null) // { id?, text }
  const [noteInput, setNoteInput] = useState('')
  const noteInputRef = useRef(null)
  useEffect(() => {
    if (noteEditor !== null && noteInputRef.current) {
      noteInputRef.current.focus()
    }
  }, [noteEditor])

  const kindIndex = { character: 0, location: 0, note: 0 }
  const ringBase = { character: CHAR_RING, location: LOC_RING, note: NOTE_RING }
  const runes = [
    ...characters.map((c) => ({ ...c, kind: 'character' })),
    ...locations.map((l) => ({ ...l, kind: 'location' })),
    ...notes.map((n) => ({ ...n, kind: 'note' }))
  ].map((r) => {
    const idx = kindIndex[r.kind]++
    return {
      ...r,
      orbitR: ringBase[r.kind] + Math.floor(idx / 7) * RING_STEP,
      orbitA: ((idx % 7) * 51 + Math.floor(idx / 7) * 23) % 360,
      orbitT: 30 + (idx % 4) * 8,
      delay: -(idx * 3.3)
    }
  })
  const ringRadii = [...new Set([CHAR_RING, LOC_RING, NOTE_RING, ...runes.map((r) => r.orbitR)])]

  const openNewNote = () => {
    setNoteEditor({ id: null, text: '' })
    setNoteInput('')
  }

  const openEditNote = (note) => {
    setNoteEditor({ id: note.id, text: note.text })
    setNoteInput(note.text)
  }

  const submitNote = () => {
    if (noteEditor?.id) {
      onUpdateNote({ id: noteEditor.id, type: 'note', text: noteInput })
    } else {
      onAddNote(noteInput)
    }
    setNoteEditor(null)
    setNoteInput('')
  }

  return (
    <div className="hub-layout">
      {/* ── Left column: intent & launchers ── */}
      <div className="hub-left">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '600', margin: '0 0 6px 0', color: 'var(--text-primary, #fff)' }}>
            {t('brainstorm.title', 'The Narrative Spark')}
          </h2>
          <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            {t(
              'brainstorm.subtitle',
              'Whisper a story into being. Forge the people and places it needs — or skip ahead if you already know.'
            )}
          </p>
        </div>

        <div className="story-idea-bar">
          <textarea
            className="story-idea-input"
            rows={2}
            value={storyIdea}
            onChange={(e) => onEditIdea && onEditIdea(e.target.value)}
            title={t('brainstorm.editIdea', 'Click to edit — this becomes your story summary')}
          />
          <button
            type="button"
            className="story-idea-reroll"
            onClick={onRerollIdea}
            title={t('brainstorm.rerollIdea', 'Re-roll the story idea')}
          >
            <span className="rune-inline">𐲐</span>
          </button>
        </div>

        <div className="genre-chip-row">
          {STORY_GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`genre-chip ${genre === g.id ? 'active' : ''}`}
              onClick={() => onGenreChange && onGenreChange(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button type="button" className="spark-square amber" onClick={() => onOpenCharacter(null)}>
            <span className="spark-square-rune">{CHAR_RUNE}</span>
            <span className="spark-square-label">
              {t('brainstorm.createCharacter', 'Create your character')}
            </span>
          </button>
          <button type="button" className="spark-square blue" onClick={() => onOpenLocation(null)}>
            <span className="spark-square-rune">{LOC_RUNE}</span>
            <span className="spark-square-label">{t('brainstorm.createLocation', 'Create a place')}</span>
          </button>
        </div>

        {noteEditor === null ? (
          <button type="button" className="hub-note-trigger" onClick={openNewNote}>
            <span className="rune-inline purple">{NOTE_RUNE}</span>
            {t('brainstorm.addNote', 'Pin a quick note')}
          </button>
        ) : (
          <div className="hub-note-editor">
            <textarea
              ref={noteInputRef}
              rows={2}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitNote()
                }
                if (e.key === 'Escape') {
                  setNoteEditor(null)
                }
              }}
              placeholder={t('brainstorm.notePlaceholder', 'A thought to keep — it becomes a Quick Note in your project')}
            />
            <div className="hub-note-actions">
              {noteEditor.id ? (
                <button
                  type="button"
                  className="hub-note-delete"
                  onClick={() => {
                    onDeleteNote(noteEditor.id)
                    setNoteEditor(null)
                    setNoteInput('')
                  }}
                >
                  {t('brainstorm.deleteNote', 'Delete')}
                </button>
              ) : null}
              <button
                type="button"
                className="hub-note-cancel"
                onClick={() => {
                  setNoteEditor(null)
                  setNoteInput('')
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="button" className="hub-note-save" onClick={submitNote}>
                {t('brainstorm.pinNote', 'Pin to the Sigil')}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={onNext}
            className={totalCount > 0 ? 'forge-cta amber' : 'forge-cta ghost'}
          >
            {totalCount > 0
              ? t('brainstorm.continueWithSparks', 'Continue to World Systems →')
              : t('brainstorm.skipToNext', 'Skip to next step →')}
          </button>
        </div>
      </div>

      {/* ── Right column: the Sigil Stage ── */}
      <div className="hub-stage-wrap">
        <div className="sigil-stage">
          {ringRadii.map((radius) => (
            <div
              key={radius}
              className="sigil-ring"
              style={{ width: `${radius * 2}px`, height: `${radius * 2}px` }}
            />
          ))}
          <div className="sigil-center">𐳌𐳖𐳉𐳤𐳙𐳛𐳦𐳉</div>
          {runes.map((r) => (
            <div
              key={r.id}
              className="sigil-orbiter"
              style={{
                '--orbit-r': `${r.orbitR}px`,
                '--orbit-a': `${r.orbitA}deg`,
                '--orbit-t': `${r.orbitT}s`,
                animationDelay: `${r.delay}s`
              }}
            >
              <div
                className="sigil-counter"
                style={{ '--orbit-a': `${r.orbitA}deg`, '--orbit-t': `${r.orbitT}s`, animationDelay: `${r.delay}s` }}
              >
                <button
                  type="button"
                  className={`sigil-rune ${
                    r.kind === 'character' ? 'amber' : r.kind === 'location' ? 'blue' : 'purple'
                  }`}
                  onClick={() =>
                    r.kind === 'character'
                      ? onOpenCharacter(r)
                      : r.kind === 'location'
                        ? onOpenLocation(r)
                        : openEditNote(r)
                  }
                >
                  {r.kind === 'character' ? CHAR_RUNE : r.kind === 'location' ? LOC_RUNE : NOTE_RUNE}
                  <div className="sigil-tooltip">
                    <div className="sigil-tooltip-name">
                      {r.kind === 'note' ? t('brainstorm.noteTitle', 'Quick Note') : r.name}
                    </div>
                    <div
                      className={`sigil-tooltip-meta ${
                        r.kind === 'character' ? '' : r.kind === 'location' ? 'blue' : 'purple'
                      }`}
                    >
                      {r.kind === 'character'
                        ? `${r.role} · ${t('brainstorm.ageShort', 'Age')} ${r.age}`
                        : r.kind === 'location'
                          ? r.siteType
                          : t('brainstorm.noteMeta', 'Becomes a Quick Note')}
                    </div>
                    <div className="sigil-tooltip-desc">
                      {r.kind === 'note' ? r.text : r.description}
                    </div>
                    <div className="sigil-tooltip-hint">
                      {r.kind === 'note'
                        ? t('brainstorm.clickToEditNote', 'Click to edit')
                        : t('brainstorm.clickToReshape', 'Click to reshape')}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
        {runes.length === 0 ? (
          <div className="sigil-empty-hint">
            <span className="rune-inline">𐲉</span>
            {t('brainstorm.emptyTitle', 'No entities spawned yet')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
