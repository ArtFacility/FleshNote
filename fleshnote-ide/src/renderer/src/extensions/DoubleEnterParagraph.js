import { Extension } from '@tiptap/core'
import { doubleEnterCommand } from '../utils/doubleEnter'

/** Enter as doubleEnterCommand describes, while the setting is on. */
export const DoubleEnterParagraph = Extension.create({
  name: 'doubleEnterParagraph',

  addOptions() {
    return { isOn: () => false }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) =>
        this.options.isOn() && doubleEnterCommand(editor.state, editor.view.dispatch)
    }
  }
})
