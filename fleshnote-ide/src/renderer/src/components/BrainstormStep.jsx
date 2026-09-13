import React, { useState, useEffect, useCallback } from 'react'
import { rollStoryIdea } from '../utils/madlibs'
import BrainstormHub from './BrainstormHub'
import CharacterForge from './CharacterForge'
import LocationForge from './LocationForge'

export default function BrainstormStep({
  entities,
  onUpdateEntities,
  onNext,
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

  const pushSummary = useCallback(
    (idea) => {
      setStoryIdea(idea)
      onStorySummary && onStorySummary(idea)
    },
    [onStorySummary]
  )

  const regenerateIdea = useCallback(
    (list) => {
      const source = list || entities
      pushSummary(
        rollStoryIdea({
          lang: language,
          genre,
          characters: source.characters || [],
          locations: source.locations || []
        })
      )
    },
    [language, genre, entities, pushSummary]
  )

  useEffect(() => {
    pushSummary(
      rollStoryIdea({
        lang: language,
        genre,
        characters: entities.characters || [],
        locations: entities.locations || []
      })
    )
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
    regenerateIdea(updated)
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
    regenerateIdea(updated)
  }

  const handleDeleteCharacter = () => {
    const updated = {
      ...entities,
      characters: entities.characters.filter((c) => c.id !== editEntity.id)
    }
    onUpdateEntities(updated)
    closeForge()
    regenerateIdea(updated)
  }

  const handleDeleteLocation = () => {
    const updated = {
      ...entities,
      locations: entities.locations.filter((l) => l.id !== editEntity.id)
    }
    onUpdateEntities(updated)
    closeForge()
    regenerateIdea(updated)
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
      onEditIdea={pushSummary}
      onRerollIdea={regenerateIdea}
      onOpenCharacter={openCharacter}
      onOpenLocation={openLocation}
      onAddNote={handleAddNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      onNext={onNext}
    />
  )
}
