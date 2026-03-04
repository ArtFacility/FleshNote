import { useEffect } from 'react'

export default function HemingwayMode({ editor }) {
    useEffect(() => {
        if (!editor) return

        // We use a global capture event listener to intercept Backspace/Delete early on the editor element.
        const handleKeyDown = (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        const editorDom = document.querySelector('.editor-area')
        if (editorDom) {
            editorDom.addEventListener('keydown', handleKeyDown, { capture: true })
        }

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleKeyDown, { capture: true })
            }
        }
    }, [editor])

    return null // Hemingway has no distinct UI overlay by itself
}
