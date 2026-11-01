import { TextSelection } from '@tiptap/pm/state'

/*
 * "Double Enter for new paragraph": the first Enter is a line break, and Enter beside
 * a line break turns it into a paragraph break. The same rules as the phone app's
 * editor. Lists and headings keep splitting on every Enter, and selections across
 * paragraphs keep the normal behaviour: returning false leaves those to the editor.
 */
export function doubleEnterCommand(state, dispatch) {
  const { selection, schema, tr } = state
  const { $from, $to, empty } = selection
  const hardBreak = schema.nodes.hardBreak
  if (!(selection instanceof TextSelection)) return false
  if ($from.parent.type !== schema.nodes.paragraph || $from.depth !== 1) return false
  if ($from.parent !== $to.parent) return false

  const breakPos = !empty
    ? null
    : $from.nodeBefore?.type === hardBreak
      ? $from.pos - 1
      : $from.nodeAfter?.type === hardBreak
        ? $from.pos
        : null

  if (dispatch) {
    if (breakPos === null) {
      tr.replaceSelectionWith(hardBreak.create(), true)
    } else {
      tr.delete(breakPos, breakPos + 1)
      tr.split(breakPos)
      tr.setSelection(TextSelection.create(tr.doc, breakPos + 2))
      const marks = state.storedMarks || $from.marks()
      if (marks.length) tr.ensureMarks(marks)
    }
    dispatch(tr.scrollIntoView())
  }
  return true
}
