// What the preload imports from '@electron-toolkit/preload', for the browser build.
import { ipcRenderer } from './electron'

export const electronAPI = {
  ipcRenderer,
  process: { platform: 'web', versions: {} as Record<string, string>, env: {} }
}
