import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const getDecorations = (doc) => {
    const decorations = []

    const regex = /#TODO[\s\S]*?(?=\u200B|$)/gi

    doc.descendants((node, pos) => {
        if (node.isText) {
            const text = node.text
            let match
            while ((match = regex.exec(text)) !== null) {
                decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                        class: 'todo-highlight',
                    })
                )
            }
        }
    })

    return DecorationSet.create(doc, decorations)
}

export const TodoHighlighter = Extension.create({
    name: 'todoHighlighter',

    addKeyboardShortcuts() {
        return {
            'Alt-t': () => {
                const { state } = this.editor
                const { from } = state.selection
                this.editor.chain()
                    .insertContent('#TODO \u200B')
                    .setTextSelection(from + 6)
                    .run()
                return true
            },
        }
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('todoHighlighter'),
                state: {
                    init(_, { doc }) {
                        return getDecorations(doc)
                    },
                    apply(tr, old) {
                        return tr.docChanged ? getDecorations(tr.doc) : old.map(tr.mapping, tr.doc)
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state)
                    },
                },
            }),
        ]
    },
})
