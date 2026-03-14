import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * RelationshipLinkMark — Custom TipTap mark for inline relationship turning point references.
 *
 * Renders as: <span data-relationship-id="3" data-character-id="7" class="relationship-link">text</span>
 * Stored in markdown as: {{relationship:3:7|text}}
 *
 * Conversion between formats happens in the Python backend (chapters.py)
 * at the load/save boundary.
 */
export const RelationshipLinkMark = Mark.create({
    name: 'relationshipLink',
    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {}
        }
    },

    addAttributes() {
        return {
            relationshipId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-relationship-id'),
                renderHTML: (attributes) => ({
                    'data-relationship-id': attributes.relationshipId
                })
            },
            characterId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-character-id'),
                renderHTML: (attributes) => ({
                    'data-character-id': attributes.characterId
                })
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-relationship-id]'
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: 'relationship-link',
                'data-relationship-id': HTMLAttributes['data-relationship-id'],
                'data-character-id': HTMLAttributes['data-character-id']
            }),
            0 // content hole
        ]
    },

    addCommands() {
        return {
            setRelationshipLink:
                (attributes) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attributes)
                    },
            unsetRelationshipLink:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name)
                    }
        }
    }
})
