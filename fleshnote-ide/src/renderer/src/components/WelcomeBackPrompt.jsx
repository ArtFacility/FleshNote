import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight || 1
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Prefixes written into character bio for texture snippets.
// Used both for saving and for detecting if a prompt was already answered.
const BIO_TEXTURE_PREFIXES = {
  char_laugh:            'Laughs like: ',
  char_fear:             'Fears losing: ',
  char_appearance:       'Distinct feature: ',
  char_dialogue_texture: 'Would quietly say: '
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WelcomeBackPrompt({
  projectPath,
  chapters,
  characters,
  twistIds,
  onClose,
  onEntitiesChanged,
  onChapterModified
}) {
  const { t } = useTranslation()
  const [scenario, setScenario] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    buildScenario()
  }, [])

  const buildScenario = async () => {
    // Use the chapter in 'writing' status, or fall back to the last chapter in the list
    const writingChapter = chapters.find(c => c.status === 'writing') || chapters[chapters.length - 1] || null
    const hasTwists = twistIds && twistIds.length > 0

    // Fetch the writing chapter's text content for context
    let lastWords = null
    let chapterHtml = null
    if (writingChapter && (writingChapter.word_count ?? 0) > 20) {
      try {
        const data = await window.api.loadChapterContent(projectPath, writingChapter.id)
        if (data.content) {
          chapterHtml = data.content
          const plain = stripHtml(data.content)
          const words = plain.split(/\s+/).filter(Boolean)
          if (words.length > 10) {
            lastWords = words.slice(-40).join(' ')
          }
        }
      } catch (_) { /* non-critical */ }
    }

    // Pick POV character or any character
    let povChar = null
    if (writingChapter?.pov_character_id) {
      povChar = characters.find(c => c.id === writingChapter.pov_character_id)
    }
    const anyChar = characters.length > 0 ? pickRandom(characters) : null
    const featuredChar = povChar || anyChar

    // Find characters with clearly missing core fields
    const charNeedsBio = characters.find(c => !c.bio || c.bio.trim().length < 10)
    const charNeedsGoal = characters.find(
      c => (!c.true_goal || c.true_goal.trim().length < 5) &&
           (!c.surface_goal || c.surface_goal.trim().length < 5)
    )

    // Helper: has this texture prefix already been written into the character's bio?
    const hasTexturePrefix = (char, key) => {
      const prefix = BIO_TEXTURE_PREFIXES[key]
      return char?.bio ? char.bio.includes(prefix) : false
    }

    // ── CONTINUE-WRITING BUCKET (40% flat probability) ──────────────────────
    // These prompts don't save anything — they just get the writer typing.

    const continueVariants = []

    if (writingChapter) {
      if (lastWords) {
        continueVariants.push({
          header: t('welcomeBack.continueHeader', 'Welcome back!'),
          prompt: t('welcomeBack.continuePrompt', 'What are the next 10 words?'),
          context: lastWords,
          contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
          hint: t('welcomeBack.continueHint', "Write whatever comes first. No editing."),
          minWords: 5,
          saveMode: 'navigate',
          saveLabel: t('welcomeBack.startWriting', 'Start writing!')
        })
      }
      continueVariants.push({
        header: t('welcomeBack.continueHeader', 'Welcome back!'),
        prompt: t('welcomeBack.weatherPrompt', 'Describe the weather or atmosphere in this scene — one sentence.'),
        hint: t('welcomeBack.weatherHint', "Set the mood before you dive back in."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 4,
        saveMode: 'navigate',
        saveLabel: t('welcomeBack.startWriting', 'Start writing!')
      })
      continueVariants.push({
        header: t('welcomeBack.continueHeader', 'Welcome back!'),
        prompt: t('welcomeBack.dialogueLinePrompt', 'Write one line of dialogue for the next scene moment.'),
        hint: t('welcomeBack.dialogueLineHint', "Don't plan it. Just hear a voice and write what they say."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'navigate',
        saveLabel: t('welcomeBack.startWriting', 'Start writing!')
      })
      continueVariants.push({
        header: t('welcomeBack.continueHeader', 'Welcome back!'),
        prompt: t('welcomeBack.openingSentencePrompt', 'Write the opening sentence of the next paragraph.'),
        hint: t('welcomeBack.openingSentenceHint', "Just one sentence. The rest will follow."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 4,
        saveMode: 'navigate',
        saveLabel: t('welcomeBack.startWriting', 'Start writing!')
      })
    }

    // ── OTHER POOL (weighted) ────────────────────────────────────────────────

    const pool = []

    // "What will you work on today?" — always available
    pool.push({
      weight: 2,
      header: t('welcomeBack.todayPlanHeader', "Today's plan."),
      prompt: t('welcomeBack.todayPlanPrompt', 'What will you work on today?'),
      hint: t('welcomeBack.todayPlanHint', "One sentence or a list. Just make it concrete."),
      minWords: 3,
      saveMode: 'quicknote',
      saveLabel: t('welcomeBack.saveIt', 'Save it')
    })

    // ── SENSORY DETAILS (save as quicknote + append link to chapter) ─────────

    if (writingChapter) {
      pool.push({
        weight: 2,
        header: t('welcomeBack.sensoryHeader', 'A sensory detail.'),
        prompt: t('welcomeBack.smellPrompt', 'What does the air smell like in this scene?'),
        hint: t('welcomeBack.smellHint', 'One vivid phrase. Smoke, rain, old paper — whatever fits.'),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'sensory_quicknote',
        saveLabel: t('welcomeBack.saveIt', 'Save it'),
        chapter: writingChapter
      })
      pool.push({
        weight: 2,
        header: t('welcomeBack.sensoryHeader', 'A sensory detail.'),
        prompt: t('welcomeBack.tempPrompt', 'Warm or cold? Describe the temperature in this scene.'),
        hint: t('welcomeBack.tempHint', 'Be specific. Stifling heat? A chill that creeps in?'),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'sensory_quicknote',
        saveLabel: t('welcomeBack.saveIt', 'Save it'),
        chapter: writingChapter
      })
      pool.push({
        weight: 2,
        header: t('welcomeBack.sensoryHeader', 'A sensory detail.'),
        prompt: t('welcomeBack.soundPrompt', 'What sound does your character hear right now?'),
        hint: t('welcomeBack.soundHint', 'Footsteps? Wind? Their own breathing?'),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'sensory_quicknote',
        saveLabel: t('welcomeBack.saveIt', 'Save it'),
        chapter: writingChapter
      })
      pool.push({
        weight: 1,
        header: t('welcomeBack.sensoryHeader', 'A sensory detail.'),
        prompt: t('welcomeBack.lightPrompt', 'What color is the light in this scene?'),
        hint: t('welcomeBack.lightHint', 'Harsh white? The grey of a rainy morning? Golden late sun?'),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'sensory_quicknote',
        saveLabel: t('welcomeBack.saveIt', 'Save it'),
        chapter: writingChapter
      })
      pool.push({
        weight: 1,
        header: t('welcomeBack.sensoryHeader', 'A sensory detail.'),
        prompt: t('welcomeBack.texturePrompt', "Describe something your character could touch right now."),
        hint: t('welcomeBack.textureHint', 'Rough stone, cold metal, worn fabric — what do their hands feel?'),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 3,
        saveMode: 'sensory_quicknote',
        saveLabel: t('welcomeBack.saveIt', 'Save it'),
        chapter: writingChapter
      })
    }

    // ── UNSPOKEN THOUGHT ─────────────────────────────────────────────────────

    if (writingChapter && featuredChar) {
      pool.push({
        weight: 2,
        header: t('welcomeBack.thoughtHeader', 'An unspoken thought.'),
        prompt: t('welcomeBack.unspokenPrompt', "What is {{name}} thinking but won't say out loud?", { name: featuredChar.name }),
        hint: t('welcomeBack.unspokenHint', "Something they're keeping to themselves."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 5,
        saveMode: 'character_notes',
        character: featuredChar,
        saveLabel: t('welcomeBack.saveToChar', 'Save to character')
      })
    }

    // ── CHARACTER DEPTH ───────────────────────────────────────────────────────

    if (charNeedsBio) {
      pool.push({
        weight: 3,
        header: t('welcomeBack.charHeader', 'A character needs a voice.'),
        prompt: t('welcomeBack.charBioPrompt', "Who is {{name}}, really? Write 2 sentences.", { name: charNeedsBio.name }),
        hint: t('welcomeBack.charBioHint', "Don't aim for perfect. Just put something down."),
        minWords: 8,
        saveMode: 'character_bio',
        character: charNeedsBio,
        saveLabel: t('welcomeBack.saveToChar', 'Save to character')
      })
    }

    if (charNeedsGoal) {
      pool.push({
        weight: 3,
        header: t('welcomeBack.goalHeader', 'What does your character want?'),
        prompt: t('welcomeBack.charGoalPrompt', "What does {{name}} want more than anything?", { name: charNeedsGoal.name }),
        hint: t('welcomeBack.charGoalHint', "The deeper truth, not what they'd admit to."),
        minWords: 5,
        saveMode: 'character_goal',
        character: charNeedsGoal,
        saveLabel: t('welcomeBack.saveToChar', 'Save to character')
      })
    }

    if (featuredChar) {
      if (writingChapter) {
        pool.push({
          weight: 2,
          header: t('welcomeBack.feelingHeader', 'A moment of truth.'),
          prompt: t('welcomeBack.charFeelingPrompt', "How does {{name}} feel right now, in this chapter?", { name: featuredChar.name }),
          hint: t('welcomeBack.charFeelingHint', "Not what they show. What they actually feel."),
          context: lastWords,
          contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
          minWords: 5,
          saveMode: 'character_notes',
          character: featuredChar,
          saveLabel: t('welcomeBack.saveToChar', 'Save to character')
        })
      }

      pool.push({
        weight: 2,
        header: t('welcomeBack.secretHeader', 'A secret.'),
        prompt: t('welcomeBack.charSecretPrompt', "What is {{name}} hiding from everyone else?", { name: featuredChar.name }),
        hint: t('welcomeBack.charSecretHint', "Even a small thing. Authors know things readers don't — yet."),
        minWords: 5,
        saveMode: 'character_notes',
        character: featuredChar,
        saveLabel: t('welcomeBack.noteItDown', 'Note it down')
      })

      // ── CHARACTER TEXTURE (saved to bio with detectable prefix) ─────────────

      if (!hasTexturePrefix(featuredChar, 'char_laugh')) {
        pool.push({
          weight: 1,
          header: t('welcomeBack.voiceHeader', "Their voice."),
          prompt: t('welcomeBack.charLaughPrompt', "Describe {{name}}'s laugh.", { name: featuredChar.name }),
          hint: t('welcomeBack.charLaughHint', "Is it rare? Loud? Do they cover their mouth?"),
          minWords: 3,
          saveMode: 'character_texture',
          textureKey: 'char_laugh',
          character: featuredChar,
          saveLabel: t('welcomeBack.noteIt', 'Note it')
        })
      }

      if (!hasTexturePrefix(featuredChar, 'char_fear')) {
        pool.push({
          weight: 1,
          header: t('welcomeBack.fearHeader', 'A fear.'),
          prompt: t('welcomeBack.charFearPrompt', "What is {{name}} most afraid of losing?", { name: featuredChar.name }),
          hint: t('welcomeBack.charFearHint', "Not monsters or heights. Something real to them."),
          minWords: 5,
          saveMode: 'character_texture',
          textureKey: 'char_fear',
          character: featuredChar,
          saveLabel: t('welcomeBack.noteIt', 'Note it')
        })
      }

      if (!hasTexturePrefix(featuredChar, 'char_appearance')) {
        pool.push({
          weight: 1,
          header: t('welcomeBack.detailHeader', 'A detail.'),
          prompt: t('welcomeBack.charAppearancePrompt', "Describe something about {{name}}'s appearance you haven't put into words yet.", { name: featuredChar.name }),
          hint: t('welcomeBack.charAppearanceHint', "A habit, a scar, how they hold their hands."),
          minWords: 5,
          saveMode: 'character_texture',
          textureKey: 'char_appearance',
          character: featuredChar,
          saveLabel: t('welcomeBack.noteIt', 'Note it')
        })
      }

      if (!hasTexturePrefix(featuredChar, 'char_dialogue_texture')) {
        pool.push({
          weight: 1,
          header: t('welcomeBack.dialogueHeader', 'Give them a voice.'),
          prompt: t('welcomeBack.charDialoguePrompt', "Write a line of dialogue {{name}} hasn't said yet but might be thinking.", { name: featuredChar.name }),
          hint: t('welcomeBack.charDialogueHint', "One sentence. Make it feel like them."),
          minWords: 3,
          saveMode: 'character_texture',
          textureKey: 'char_dialogue_texture',
          character: featuredChar,
          saveLabel: t('welcomeBack.saveTheLine', 'Save the line')
        })
      }
    }

    // ── TWIST / FORESHADOWING ─────────────────────────────────────────────────

    if (hasTwists && writingChapter) {
      pool.push({
        weight: 2,
        header: t('welcomeBack.twistHeader', 'Plant a seed.'),
        prompt: t('welcomeBack.twistPrompt', "Write one subtle sentence that could foreshadow your next twist."),
        hint: t('welcomeBack.twistHint', "Readers shouldn't notice it on a first read."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 5,
        saveMode: 'quicknote',
        chapter: writingChapter,
        saveLabel: t('welcomeBack.saveAsNote', 'Save as note')
      })
      pool.push({
        weight: 1,
        header: t('welcomeBack.twistHeader', 'Plant a seed.'),
        prompt: t('welcomeBack.cluePrompt', "What clue have you not laid yet? Describe it in 10 words."),
        hint: t('welcomeBack.clueHint', "Just the idea is enough. You can write it properly later."),
        context: lastWords,
        contextLabel: t('welcomeBack.whereYouLeftOff', 'Where you left off:'),
        minWords: 5,
        saveMode: 'quicknote',
        chapter: writingChapter,
        saveLabel: t('welcomeBack.saveAsNote', 'Save as note')
      })
    }

    // ── WORLD-BUILDING (always available as fallback) ─────────────────────────

    pool.push({
      weight: 1,
      header: t('welcomeBack.worldHeader', 'The world is alive.'),
      prompt: t('welcomeBack.worldDetailPrompt', "Describe something in your world that hasn't appeared in any chapter yet."),
      hint: t('welcomeBack.worldDetailHint', 'A place, a custom, a food — anything.'),
      minWords: 5,
      saveMode: 'quicknote',
      chapter: chapters.find(c => c.status === 'writing') || chapters[0],
      saveLabel: t('welcomeBack.saveIt', 'Save it')
    })
    pool.push({
      weight: 1,
      header: t('welcomeBack.worldHeader', 'The world is alive.'),
      prompt: t('welcomeBack.worldFoodPrompt', "What does the most common food in your world taste like?"),
      hint: t('welcomeBack.worldFoodHint', "Even fantasy worlds have bread. What's yours?"),
      minWords: 5,
      saveMode: 'quicknote',
      chapter: chapters.find(c => c.status === 'writing') || chapters[0],
      saveLabel: t('welcomeBack.saveIt', 'Save it')
    })
    pool.push({
      weight: 1,
      header: t('welcomeBack.worldHeader', 'The world is alive.'),
      prompt: t('welcomeBack.worldSoundPrompt', "What's a sound that belongs in your world but hasn't appeared yet?"),
      hint: t('welcomeBack.worldSoundHint', 'A market, a festival, a machine, a creature.'),
      minWords: 3,
      saveMode: 'quicknote',
      chapter: chapters.find(c => c.status === 'writing') || chapters[0],
      saveLabel: t('welcomeBack.saveIt', 'Save it')
    })

    // ── PICK ──────────────────────────────────────────────────────────────────

    if (continueVariants.length === 0 && pool.length === 0) {
      onClose()
      return
    }

    let picked
    if (continueVariants.length > 0 && Math.random() < 0.4) {
      picked = pickRandom(continueVariants)
    } else if (pool.length > 0) {
      picked = weightedPick(pool)
    } else {
      picked = pickRandom(continueVariants)
    }

    setScenario(picked)
  }

  const handleSubmit = async () => {
    if (!scenario || !canSubmit) return
    setIsSubmitting(true)
    try {
      const text = inputValue.trim()

      if (scenario.saveMode === 'navigate') {
        // Just close into the editor — nothing to save
      } else if (scenario.saveMode === 'quicknote') {
        await window.api.createQuickNote({ project_path: projectPath, content: text })
        onEntitiesChanged?.()
      } else if (scenario.saveMode === 'sensory_quicknote') {
        // Create the quicknote
        const result = await window.api.createQuickNote({ project_path: projectPath, content: text })
        onEntitiesChanged?.()
        // Append an inline quicknote link to the last paragraph of the writing chapter
        const noteId = result?.quick_note?.id
        if (noteId && scenario.chapter?.id) {
          try {
            const data = await window.api.loadChapterContent(projectPath, scenario.chapter.id)
            if (data?.content) {
              const lastPIdx = data.content.lastIndexOf('</p>')
              if (lastPIdx !== -1) {
                const span = `<span data-entity-type="quicknote" data-entity-id="${noteId}" class="entity-link quicknote">▸</span>`
                const newContent = data.content.slice(0, lastPIdx) + ' ' + span + data.content.slice(lastPIdx)
                const wc = stripHtml(newContent).split(/\s+/).filter(Boolean).length
                await window.api.saveChapterContent({
                  project_path: projectPath,
                  chapter_id: scenario.chapter.id,
                  content: newContent,
                  word_count: wc
                })
                onChapterModified?.(scenario.chapter.id)
              }
            }
          } catch (_) { /* non-critical — note was already saved */ }
        }
      } else if (scenario.saveMode === 'character_bio' && scenario.character) {
        await window.api.updateCharacter({ project_path: projectPath, character_id: scenario.character.id, bio: text })
        onEntitiesChanged?.()
      } else if (scenario.saveMode === 'character_goal' && scenario.character) {
        await window.api.updateCharacter({ project_path: projectPath, character_id: scenario.character.id, true_goal: text })
        onEntitiesChanged?.()
      } else if (scenario.saveMode === 'character_notes' && scenario.character) {
        const existing = scenario.character.notes || ''
        const appended = existing ? `${existing}\n\n${text}` : text
        await window.api.updateCharacter({ project_path: projectPath, character_id: scenario.character.id, notes: appended })
        onEntitiesChanged?.()
      } else if (scenario.saveMode === 'character_texture' && scenario.character && scenario.textureKey) {
        const prefix = BIO_TEXTURE_PREFIXES[scenario.textureKey]
        const existingBio = scenario.character.bio || ''
        const appended = existingBio ? `${existingBio}\n\n${prefix}${text}` : `${prefix}${text}`
        await window.api.updateCharacter({ project_path: projectPath, character_id: scenario.character.id, bio: appended })
        onEntitiesChanged?.()
      }

      setSaved(true)
      setTimeout(onClose, 1100)
    } catch (err) {
      console.error('WelcomeBackPrompt save failed:', err)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const wordCount = countWords(inputValue)
  const minWords = scenario?.minWords || 3
  const canSubmit = wordCount >= minWords && !isSubmitting && !saved

  if (!scenario) {
    return (
      <div style={{
        position: 'fixed', inset: 0, backdropFilter: 'blur(12px)',
        background: 'rgba(8, 8, 12, 0.85)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }} />
    )
  }

  const saveHint = scenario.saveMode === 'quicknote' || scenario.saveMode === 'sensory_quicknote'
    ? t('welcomeBack.savesAsQuicknote', '→ Saves as a quick note')
    : scenario.saveMode === 'character_bio' || scenario.saveMode === 'character_goal' ||
      scenario.saveMode === 'character_notes' || scenario.saveMode === 'character_texture'
      ? t('welcomeBack.savesToChar', "→ Saves to {{name}}'s profile", { name: scenario.character?.name })
      : null

  const sensoryChapterNote = scenario.saveMode === 'sensory_quicknote' && scenario.chapter
    ? t('welcomeBack.sensoryChapterNote', '+ links it into your chapter')
    : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backdropFilter: 'blur(12px)',
        background: 'rgba(8, 8, 12, 0.85)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '48px 56px',
        maxWidth: 600,
        width: '100%'
      }}>
        {/* Category label */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--accent-amber)', textTransform: 'uppercase',
          letterSpacing: '1.5px', marginBottom: 16
        }}>
          {scenario.header}
        </div>

        {/* Main question */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 22,
          color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8
        }}>
          {scenario.prompt}
        </div>

        {/* Hint */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-tertiary)', marginBottom: 24
        }}>
          {scenario.hint}
        </div>

        {/* Context (last ~20 words) */}
        {scenario.context && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8
            }}>
              {scenario.contextLabel}
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--text-secondary)',
              fontStyle: 'italic', background: 'var(--bg-surface)',
              borderLeft: '2px solid var(--border-subtle)',
              padding: '10px 16px', lineHeight: 1.7
            }}>
              …{scenario.context}
            </div>
          </div>
        )}

        {/* Input area or saved confirmation */}
        {saved ? (
          <div style={{
            textAlign: 'center', padding: '24px 0',
            color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 13
          }}>
            {t('welcomeBack.savedMessage', '✓ Saved. Happy writing.')}
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={t('welcomeBack.typeHere', 'Type here…')}
              style={{
                width: '100%', minHeight: 90,
                background: 'var(--bg-deep)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-serif)',
                fontSize: 15, padding: '12px 14px', resize: 'vertical',
                outline: 'none', borderRadius: 4, lineHeight: 1.6,
                boxSizing: 'border-box'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) handleSubmit()
              }}
            />

            {/* Word count + save destination */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginTop: 8, marginBottom: 24
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: wordCount >= minWords ? 'var(--accent-green)' : 'var(--text-tertiary)'
              }}>
                {wordCount} {t('welcomeBack.words', 'words')}
                {wordCount < minWords && (
                  <span style={{ opacity: 0.7 }}> — {t('welcomeBack.minimumNote', 'need {{n}} to save', { n: minWords })}</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                {saveHint && <div>{saveHint}</div>}
                {sensoryChapterNote && <div style={{ opacity: 0.7 }}>{sensoryChapterNote}</div>}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                  fontSize: 11, padding: '8px 20px', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}
              >
                {t('welcomeBack.skipForNow', 'Skip for now')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  background: canSubmit ? 'var(--accent-amber)' : 'var(--bg-surface)',
                  border: 'none',
                  color: canSubmit ? 'var(--bg-deep)' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  padding: '8px 20px',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600,
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                {isSubmitting ? t('welcomeBack.saving', 'Saving…') : scenario.saveLabel}
              </button>
            </div>

            <div style={{
              marginTop: 20, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.5
            }}>
              Ctrl+Enter {t('welcomeBack.ctrlEnterHint', 'to submit')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
