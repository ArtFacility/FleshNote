// node --test src/renderer/src/utils/doubleEnter.test.mjs
// The same cases as the phone editor's test/editor_enter_test.dart.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { doubleEnterCommand } from './doubleEnter.js'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*' },
    bulletList: { group: 'block', content: 'listItem+' },
    listItem: { content: 'paragraph+' },
    hardBreak: { group: 'inline', inline: true, selectable: false }
  },
  marks: { bold: {} }
})
const { paragraph: p, heading: h, hardBreak, bulletList, listItem } = schema.nodes
const t = (s, marks) => schema.text(s, marks)
const br = () => hardBreak.create()
const docOf = (...blocks) => schema.nodes.doc.create(null, blocks)

const stateAt = (doc, from, to = from) =>
  EditorState.create({ doc, selection: TextSelection.create(doc, from, to) })

// A doc as text: paragraphs in <>, line breaks as |.
const show = (doc) => {
  const out = []
  doc.forEach((b) => {
    let s = ''
    b.forEach((n) => { s += n.type === hardBreak ? '|' : n.text })
    out.push(`<${s}>`)
  })
  return out.join('')
}

const press = (state) => {
  let next = state
  const handled = doubleEnterCommand(state, (tr) => { next = state.apply(tr) })
  return { handled, state: next }
}
const typed = (state, text) => state.apply(state.tr.insertText(text))

test('one Enter is a line break, and the caret stays after it', () => {
  const { state } = press(stateAt(docOf(p.create(null, t('one two'))), 5))
  assert.equal(show(state.doc), '<one |two>')
  assert.equal(state.selection.from, 6)
})

test('Enter after a line break makes a new paragraph', () => {
  const { state } = press(stateAt(docOf(p.create(null, [t('one '), br(), t('two')])), 6))
  assert.equal(show(state.doc), '<one ><two>')
  assert.equal(state.selection.$from.parentOffset, 0)
  assert.equal(state.selection.$from.parent.textContent, 'two')
})

test('Enter just before a line break makes a new paragraph', () => {
  const { state } = press(stateAt(docOf(p.create(null, [t('soft'), br(), t('break')])), 5))
  assert.equal(show(state.doc), '<soft><break>')
  assert.equal(state.selection.$from.parent.textContent, 'break')
})

test('Enter twice at the end opens an empty paragraph to type in', () => {
  const first = press(stateAt(docOf(p.create(null, t('end'))), 4)).state
  assert.equal(show(first.doc), '<end|>')
  const second = press(first).state
  assert.equal(show(second.doc), '<end><>')
  assert.equal(show(typed(second, 'next').doc), '<end><next>')
})

test('Enter in an empty paragraph is a line break first, like any other', () => {
  const { state } = press(stateAt(docOf(p.create()), 1))
  assert.equal(show(state.doc), '<|>')
})

test('a selection in one paragraph is replaced by a line break', () => {
  const { state } = press(stateAt(docOf(p.create(null, t('one two three'))), 5, 8))
  assert.equal(show(state.doc), '<one | three>')
})

test('a selection touching a line break still writes one, as the first Enter', () => {
  const doc = docOf(p.create(null, [t('a'), br(), t('bc')]))
  const { state } = press(stateAt(doc, 3, 4))
  assert.equal(show(state.doc), '<a||c>')
})

test('bold carries over into the new paragraph', () => {
  const bold = [schema.marks.bold.create()]
  const doc = docOf(p.create(null, [t('one', bold), br().mark(bold)]))
  const { state } = press(stateAt(doc, 5))
  assert.equal(show(state.doc), '<one><>')
  assert.equal(state.storedMarks?.[0]?.type.name, 'bold')
})

test('headings, lists and selections across paragraphs are left to the editor', () => {
  assert.equal(press(stateAt(docOf(h.create(null, t('Title'))), 3)).handled, false)
  const list = docOf(bulletList.create(null, listItem.create(null, p.create(null, t('item')))))
  assert.equal(press(stateAt(list, 4)).handled, false)
  const two = docOf(p.create(null, t('one')), p.create(null, t('two')))
  assert.equal(press(stateAt(two, 2, 7)).handled, false)
})

test('a selected node is left to the editor', () => {
  const doc = docOf(p.create(null, t('a')), h.create(null, t('b')))
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 0) })
  assert.equal(press(state).handled, false)
})
