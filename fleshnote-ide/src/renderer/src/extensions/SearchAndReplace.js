import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const searchAndReplacePluginKey = new PluginKey('searchAndReplace')

function processSearches(doc, searchTerm, currentIndex = -1) {
    const decorations = []
    const results = []

    if (!searchTerm || searchTerm.length === 0) {
        return { decorations: DecorationSet.create(doc, decorations), results, currentIndex: -1 }
    }

    const regex = new RegExp(searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi')

    doc.descendants((node, pos) => {
        if (node.isText) {
            const text = node.text
            let match
            while ((match = regex.exec(text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                results.push({ from, to })
            }
        }
    })

    // Re-adjust index if out of bounds
    let newIndex = currentIndex
    if (results.length === 0) {
        newIndex = -1
    } else if (newIndex >= results.length) {
        newIndex = 0
    } else if (newIndex < 0 && results.length > 0) {
        newIndex = 0
    }

    results.forEach((r, idx) => {
        const isActive = idx === newIndex
        decorations.push(
            Decoration.inline(r.from, r.to, {
                class: isActive ? 'search-result search-result-active' : 'search-result',
            })
        )
    })

    return {
        decorations: DecorationSet.create(doc, decorations),
        results,
        currentIndex: newIndex
    }
}

export const SearchAndReplace = Extension.create({
    name: 'searchAndReplace',

    addStorage() {
        return {
            searchTerm: '',
            results: [],
            currentIndex: -1,
        }
    },

    addCommands() {
        return {
            setSearchTerm: (searchTerm) => ({ tr, dispatch }) => {
                if (dispatch) {
                    tr.setMeta(searchAndReplacePluginKey, { type: 'SET_TERM', searchTerm })
                }
                return true
            },
            nextSearchResult: () => ({ tr, dispatch, editor }) => {
                const results = editor.storage.searchAndReplace.results
                if (results.length === 0) return false

                const currentIndex = editor.storage.searchAndReplace.currentIndex
                const nextIndex = (currentIndex + 1) % results.length

                if (dispatch) {
                    tr.setMeta(searchAndReplacePluginKey, { type: 'SET_INDEX', index: nextIndex })
                    const result = results[nextIndex]
                    if (result) {
                        tr.setSelection(TextSelection.create(tr.doc, result.from, result.to))
                        tr.scrollIntoView()
                    }
                }
                return true
            },
            previousSearchResult: () => ({ tr, dispatch, editor }) => {
                const results = editor.storage.searchAndReplace.results
                if (results.length === 0) return false

                const currentIndex = editor.storage.searchAndReplace.currentIndex
                const prevIndex = (currentIndex - 1 + results.length) % results.length

                if (dispatch) {
                    tr.setMeta(searchAndReplacePluginKey, { type: 'SET_INDEX', index: prevIndex })
                    const result = results[prevIndex]
                    if (result) {
                        tr.setSelection(TextSelection.create(tr.doc, result.from, result.to))
                        tr.scrollIntoView()
                    }
                }
                return true
            },
            clearSearch: () => ({ tr, dispatch }) => {
                if (dispatch) {
                    tr.setMeta(searchAndReplacePluginKey, { type: 'CLEAR' })
                }
                return true
            },
        }
    },

    addProseMirrorPlugins() {
        const editor = this.editor

        return [
            new Plugin({
                key: searchAndReplacePluginKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply: (tr, oldState) => {
                        const meta = tr.getMeta(searchAndReplacePluginKey)

                        if (meta) {
                            if (meta.type === 'SET_TERM') {
                                editor.storage.searchAndReplace.searchTerm = meta.searchTerm
                                editor.storage.searchAndReplace.currentIndex = -1 // Reset index on new search
                            } else if (meta.type === 'SET_INDEX') {
                                editor.storage.searchAndReplace.currentIndex = meta.index
                            } else if (meta.type === 'CLEAR') {
                                editor.storage.searchAndReplace.searchTerm = ''
                                editor.storage.searchAndReplace.currentIndex = -1
                            }
                        }

                        const searchTerm = editor.storage.searchAndReplace.searchTerm

                        if (tr.docChanged || meta) {
                            const { decorations, results, currentIndex } = processSearches(tr.doc, searchTerm, editor.storage.searchAndReplace.currentIndex)
                            editor.storage.searchAndReplace.results = results
                            editor.storage.searchAndReplace.currentIndex = currentIndex
                            return decorations
                        }

                        return oldState.map(tr.mapping, tr.doc)
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
