import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * MilestoneLinkMark — Custom TipTap mark for inline faction milestone anchors.
 *
 * Renders as: <span data-milestone-id="uuid" data-group-id="uuid" class="milestone-link">text</span>
 * Stored in markdown as: {{milestone:milestoneId:groupId|text}}
 *
 * Converted at the chapter load/save boundary in Python backend (chapters.py).
 */
export const MilestoneLinkMark = Mark.create({
  name: 'milestoneLink',
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  addAttributes() {
    return {
      milestoneId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-milestone-id'),
        renderHTML: (attributes) => ({
          'data-milestone-id': attributes.milestoneId
        })
      },
      groupId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-group-id'),
        renderHTML: (attributes) => ({
          'data-group-id': attributes.groupId
        })
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-milestone-id]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'milestone-link',
        'data-milestone-id': HTMLAttributes['data-milestone-id'],
        'data-group-id': HTMLAttributes['data-group-id']
      }),
      0
    ]
  },

  addCommands() {
    return {
      setMilestoneLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetMilestoneLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        }
    }
  }
})
