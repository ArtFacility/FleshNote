import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * EntityLinkMark — Custom TipTap mark for inline entity references.
 *
 * Renders as: <span data-entity-type="character" data-entity-id="5" class="entity-link character">Sophia</span>
 * Stored in markdown as: {{char:5|Sophia}}
 *
 * Conversion between formats happens in the Python backend (chapters.py)
 * at the load/save boundary.
 */
export const EntityLinkMark = Mark.create({
  name: 'entityLink',

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  addAttributes() {
    return {
      entityType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-type'),
        renderHTML: (attributes) => ({
          'data-entity-type': attributes.entityType
        })
      },
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-id'),
        renderHTML: (attributes) => ({
          'data-entity-id': attributes.entityId
        })
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-entity-type]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-entity-type'] || 'character'
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `entity-link ${type}`,
        'data-entity-type': type,
        'data-entity-id': HTMLAttributes['data-entity-id']
      }),
      0 // content hole
    ]
  },

  addCommands() {
    return {
      setEntityLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetEntityLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        }
    }
  }
})
