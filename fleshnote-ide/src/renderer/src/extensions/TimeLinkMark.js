import { Mark, mergeAttributes } from '@tiptap/core'

const PALETTE = ['#d49200', '#5b8dd9', '#c75d3a', '#6bb57a', '#b06abf', '#d4d430', '#3abac7', '#d97070']

/**
 * TimeLinkMark — Custom TipTap mark for paragraph-level time overrides.
 *
 * Renders as: <span data-time-id="5" data-color-index="0" class="time-link" style="...">text</span>
 * Stored in markdown as: {{time:5:0|text}}
 *
 * Conversion between formats happens in the Python backend (chapters.py)
 * at the load/save boundary.
 */
export const TimeLinkMark = Mark.create({
  name: 'timeLink',
  inclusive: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      timeId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-time-id'),
        renderHTML: (attrs) => ({ 'data-time-id': attrs.timeId }),
      },
      colorIndex: {
        default: 0,
        parseHTML: (el) => parseInt(el.getAttribute('data-color-index') || '0'),
        renderHTML: (attrs) => ({ 'data-color-index': String(attrs.colorIndex ?? 0) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-time-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'time-link',
        'data-time-id': HTMLAttributes['data-time-id'],
        'data-color-index': HTMLAttributes['data-color-index'],
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setTimeLink:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),

      unsetTimeLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      removeTimeLinkById:
        (timeId) =>
        ({ tr, dispatch, state }) => {
          const markType = state.schema.marks.timeLink
          state.doc.descendants((node, pos) => {
            const mark = node.marks.find(
              (m) => m.type === markType && String(m.attrs.timeId) === String(timeId)
            )
            if (mark) {
              tr.removeMark(pos, pos + node.nodeSize, markType)
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },

      updateTimeLinkColorById:
        (timeId, colorIndex) =>
        ({ tr, dispatch, state }) => {
          const markType = state.schema.marks.timeLink
          state.doc.descendants((node, pos) => {
            const mark = node.marks.find(
              (m) => m.type === markType && String(m.attrs.timeId) === String(timeId)
            )
            if (mark) {
              const newMark = markType.create({ timeId: mark.attrs.timeId, colorIndex })
              tr.removeMark(pos, pos + node.nodeSize, markType)
              tr.addMark(pos, pos + node.nodeSize, newMark)
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})
