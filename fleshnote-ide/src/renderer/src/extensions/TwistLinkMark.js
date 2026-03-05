import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * TwistLinkMark — Custom TipTap mark for inline twist/foreshadowing references.
 *
 * Renders as: <span data-twist-type="twist" data-twist-id="5" class="twist-link twist">the reveal</span>
 *         or: <span data-twist-type="foreshadow" data-twist-id="5" class="twist-link foreshadow">a hint</span>
 * Stored in markdown as: {{twist:5|the reveal}} / {{foreshadow:5|a hint}}
 *
 * Conversion between formats happens in the Python backend (chapters.py)
 * at the load/save boundary.
 */
export const TwistLinkMark = Mark.create({
    name: 'twistLink',
    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {}
        }
    },

    addAttributes() {
        return {
            twistType: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-twist-type'),
                renderHTML: (attributes) => ({
                    'data-twist-type': attributes.twistType
                })
            },
            twistId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-twist-id'),
                renderHTML: (attributes) => ({
                    'data-twist-id': attributes.twistId
                })
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-twist-type]'
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        const type = HTMLAttributes['data-twist-type'] || 'foreshadow'
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: `twist-link ${type}`,
                'data-twist-type': type,
                'data-twist-id': HTMLAttributes['data-twist-id']
            }),
            0 // content hole
        ]
    },

    addCommands() {
        return {
            setTwistLink:
                (attributes) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attributes)
                    },
            unsetTwistLink:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name)
                    }
        }
    }
})
