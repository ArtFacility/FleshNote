// Work that must finish before the window closes (saving the open chapter, sealing
// the writing session). The main process waits for closeReady(), up to a few seconds.

const handlers = new Set()
let installed = false

export function onBeforeClose(fn) {
  handlers.add(fn)
  return () => handlers.delete(fn)
}

export function installCloseGuard() {
  if (installed || !window.api?.onBeforeClose) return
  installed = true
  window.api.onBeforeClose(async () => {
    try {
      await Promise.allSettled([...handlers].map((fn) => Promise.resolve().then(fn)))
    } finally {
      window.api.closeReady()
    }
  })
}
