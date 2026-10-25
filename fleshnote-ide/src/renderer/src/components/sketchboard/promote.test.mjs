// Run with: node --test src/renderer/src/components/sketchboard/promote.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { promoteFields } from './promote.js'

const node = {
  name: ' Ember Rite ',
  description: 'Fire answers a spoken debt.',
  props: [
    ['Cost', 'a memory'],
    ['Rules', 'only at dusk'],
    ['Rule', 'never twice'],
    ['Range', 'one room'],
    ['', ''],
    ['', 'a loose note']
  ]
}

test('lore: matching properties fill rules and limitations, the rest go to notes', () => {
  const { create, update } = promoteFields(node, 'lore')
  assert.deepEqual(create, { name: 'Ember Rite', description: 'Fire answers a spoken debt.' })
  assert.deepEqual(update, {
    limitations: 'a memory',
    rules: 'only at dusk\nnever twice',
    notes: 'Range: one room\na loose note'
  })
})

test('a character takes the description as bio and every property as notes', () => {
  const { create, update } = promoteFields(node, 'character')
  assert.equal(create.bio, 'Fire answers a spoken debt.')
  assert.equal(
    create.notes,
    'Cost: a memory\nRules: only at dusk\nRule: never twice\nRange: one room\na loose note'
  )
  assert.equal(update, null)
})

test('places and groups keep description and notes; a bare node needs no update', () => {
  assert.deepEqual(promoteFields({ name: 'Keep', description: '', props: [] }, 'location'), {
    create: { name: 'Keep', description: '', notes: '' },
    update: null
  })
  assert.equal(promoteFields({ name: 'Keep', props: [] }, 'lore').update, null)
})
