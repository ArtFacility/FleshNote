import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * KnowledgeLinkMark — Custom TipTap mark for inline knowledge state references.
 *
 * Renders as: <span data-knowledge-id="5" data-character-id="2" class="knowledge-link">text</span>
 * Stored in markdown as: {{knowledge:5:2|text}}
 *
 * Conversion between formats happens in the Python backend (chapters.py)
 * at the load/save boundary.
 */
export const KnowledgeLinkMark = Mark.create({
    name: 'knowledgeLink',
    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {}
        }
    },

    addAttributes() {
        return {
            knowledgeId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-knowledge-id'),
                renderHTML: (attributes) => ({
                    'data-knowledge-id': attributes.knowledgeId
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
                tag: 'span[data-knowledge-id]'
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: 'knowledge-link',
                'data-knowledge-id': HTMLAttributes['data-knowledge-id'],
                'data-character-id': HTMLAttributes['data-character-id']
            }),
            0 // content hole
        ]
    },

    addCommands() {
        return {
            setKnowledgeLink:
                (attributes) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attributes)
                    },
            unsetKnowledgeLink:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name)
                    }
        }
    }
})
