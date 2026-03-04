import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import MentionList from '../components/MentionList'

export default function getSuggestionConfig(getEntities) {
    return {
        items: ({ query }) => {
            const q = query.toLowerCase()
            const entities = typeof getEntities === 'function' ? getEntities() : getEntities
            // Filter entities
            const matches = entities.filter(e => {
                if (e.type === 'quicknote') return false
                if (e.name.toLowerCase().includes(q)) return true
                if (e.aliases && e.aliases.some(a => a.toLowerCase().includes(q))) return true
                return false
            })
            // Return top 10
            return matches.slice(0, 10).map(e => ({
                id: e.id,
                type: e.type,
                name: e.name
            }))
        },

        command: ({ editor, range, props }) => {
            let tr = editor.state.tr
            // The range covers the `@` up to the matched text.
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent(props.label) // Text is inserted
                .setTextSelection({ from: range.from, to: range.from + props.label.length }) // Select it
                .setEntityLink({
                    entityType: props.type,
                    entityId: String(props.id)
                })
                .setTextSelection(range.from + props.label.length)
                .insertContent(' ')
                .run()
        },

        render: () => {
            let component
            let popup

            return {
                onStart: props => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    })

                    if (!props.clientRect) {
                        return
                    }

                    popup = tippy('body', {
                        getReferenceClientRect: props.clientRect,
                        appendTo: () => document.body,
                        content: component.element,
                        showOnCreate: true,
                        interactive: true,
                        trigger: 'manual',
                        placement: 'bottom-start',
                        theme: 'fleshnote'
                    })
                },

                onUpdate(props) {
                    component.updateProps(props)

                    if (!props.clientRect) {
                        return
                    }

                    popup[0].setProps({
                        getReferenceClientRect: props.clientRect,
                    })
                },

                onKeyDown(props) {
                    if (props.event.key === 'Escape') {
                        popup[0].hide()
                        return true
                    }

                    return component.ref?.onKeyDown(props)
                },

                onExit() {
                    popup[0].destroy()
                    component.destroy()
                },
            }
        },
    }
}
