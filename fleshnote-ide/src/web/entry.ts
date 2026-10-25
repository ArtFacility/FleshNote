// The browser build's entry (vite.web.config.mjs): the preload runs first, unchanged, and puts
// window.api in place with the browser's ipcRenderer (./electron); then the renderer starts.
import { emit } from './electron'
import { setClosing } from './backend'
import '../preload/index'
import '../renderer/src/main.tsx'

// Electron asks the renderer to finish saving before its window closes ('app:before-close');
// a tab's last moment is pagehide. Its requests go out with keepalive (see backend.ts).
window.addEventListener('pagehide', () => {
  setClosing(true)
  emit('app:before-close')
})
window.addEventListener('pageshow', (e) => {
  if (e.persisted) setClosing(false)
})
