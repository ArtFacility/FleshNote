import React, { useState, useEffect, useCallback, useRef } from 'react'
import { rollStoryIdea } from '../utils/madlibs'
import BrainstormHub from './BrainstormHub'
import CharacterForge from './CharacterForge'
import LocationForge from './LocationForge'

export default function BrainstormStep({
  entities,
  onUpdateEntities,
  language = 'en',
  genre = 'fantasy',
  onGenreChange,
  storySummary = '',
  onStorySummary
}) {
  const [activeForge, setActiveForge] = useState(null)
  const [editEntity, setEditEntity] = useState(null)

  const [storyIdea, setStoryIdea] = useState(
    () =>
      storySummary ||
      rollStoryIdea({
        lang: language,
        genre,
        characters: entities.characters || [],
        locations: entities.locations || []
      })
  )

  // Once the writer has typed into the summary it is theirs: saving or deleting
  // a character or place, or switching genre, no longer re-rolls it. Only the
  // re-roll button replaces it. A summary carried over from an earlier visit
  // to this step counts as theirs too.
  const ideaOwnedByWriter = useRef(Boolean(storySummary))

  const pushSummary = useCallback(
    (idea) => {
      setStoryIdea(idea)
      onStorySummary && onStorySummary(idea)
    },
    [onStorySummary]
  )

  const editIdea = useCallback(
    (idea) => {
      ideaOwnedByWriter.current = true
      pushSummary(idea)
    },
    [pushSummary]
  )

  const regenerateIdea = useCallback(
    (list = entities) => {
      ideaOwnedByWriter.current = false
      pushSummary(
        rollStoryIdea({
          lang: language,
          genre,
          characters: list.characters || [],
          locations: list.locations || []
        })
      )
    },
    [language, genre, entities, pushSummary]
  )

  /** Re-rolls only while the summary is still a generated one. */
  const refreshIdea = (list) => {
    if (!ideaOwnedByWriter.current) regenerateIdea(list)
  }

  // Language or genre changed: re-flavor the idea. Skipped on mount, where the
  // initial state already holds either the carried-over or a fresh idea.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    refreshIdea(entities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, genre])

  const openCharacter = (entity = null) => {
    setEditEntity(entity)
    setActiveForge('character')
  }

  const openLocation = (entity = null) => {
    setEditEntity(entity)
    setActiveForge('location')
  }

  const closeForge = () => {
    setActiveForge(null)
    setEditEntity(null)
  }

  const handleSaveCharacter = (entity) => {
    const exists = entities.characters.some((c) => c.id === entity.id)
    const updated = {
      ...entities,
      characters: exists
        ? entities.characters.map((c) => (c.id === entity.id ? entity : c))
        : [...entities.characters, entity]
    }
    onUpdateEntities(updated)
    closeForge()
    refreshIdea(updated)
  }

  const handleSaveLocation = (entity) => {
    const exists = entities.locations.some((l) => l.id === entity.id)
    const updated = {
      ...entities,
      locations: exists
        ? entities.locations.map((l) => (l.id === entity.id ? entity : l))
        : [...entities.locations, entity]
    }
    onUpdateEntities(updated)
    closeForge()
    refreshIdea(updated)
  }

  const handleDeleteCharacter = () => {
    const updated = {
      ...entities,
      characters: entities.characters.filter((c) => c.id !== editEntity.id)
    }
    onUpdateEntities(updated)
    closeForge()
    refreshIdea(updated)
  }

  const handleDeleteLocation = () => {
    const updated = {
      ...entities,
      locations: entities.locations.filter((l) => l.id !== editEntity.id)
    }
    onUpdateEntities(updated)
    closeForge()
    refreshIdea(updated)
  }

  const handleAddNote = (text) => {
    const note = {
      id: 'note_' + Math.random().toString(36).substr(2, 9),
      type: 'note',
      text: text.trim()
    }
    if (!note.text) return
    onUpdateEntities({
      ...entities,
      notes: [...(entities.notes || []), note]
    })
  }

  const handleUpdateNote = (note) => {
    if (!note.text.trim()) {
      handleDeleteNote(note.id)
      return
    }
    onUpdateEntities({
      ...entities,
      notes: (entities.notes || []).map((n) => (n.id === note.id ? note : n))
    })
  }

  const handleDeleteNote = (id) => {
    onUpdateEntities({
      ...entities,
      notes: (entities.notes || []).filter((n) => n.id !== id)
    })
  }

  if (activeForge === 'character') {
    return (
      <CharacterForge
        key={editEntity ? editEntity.id : 'char_new'}
        entity={editEntity}
        language={language}
        onSave={handleSaveCharacter}
        onBack={closeForge}
        onDelete={handleDeleteCharacter}
      />
    )
  }

  if (activeForge === 'location') {
    return (
      <LocationForge
        key={editEntity ? editEntity.id : 'loc_new'}
        entity={editEntity}
        language={language}
        onSave={handleSaveLocation}
        onBack={closeForge}
        onDelete={handleDeleteLocation}
      />
    )
  }

  return (
    <BrainstormHub
      characters={entities.characters || []}
      locations={entities.locations || []}
      notes={entities.notes || []}
      genre={genre}
      onGenreChange={onGenreChange}
      storyIdea={storyIdea}
      onEditIdea={editIdea}
      onRerollIdea={() => regenerateIdea()}
      onOpenCharacter={openCharacter}
      onOpenLocation={openLocation}
      onAddNote={handleAddNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      language={language}
    />
  )
}
