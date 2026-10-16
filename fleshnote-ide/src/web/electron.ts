/* eslint-disable @typescript-eslint/no-explicit-any -- values crossing the IPC boundary are untyped, as in the preload (window.api: unknown) */
// What the preload (src/preload/index.ts) imports from 'electron', for the browser build: the
// preload runs unchanged, and its ipcRenderer calls reach the handlers lifted from main
// (virtual:fleshnote-lifted) or their browser versions (./handlers).
import { lifted } from 'virtual:fleshnote-lifted'
import { webHandlers } from './handlers'
import { pendingPath, resolvePaths } from './backend'

type Listener = (event: unknown, ...args: any[]) => void
const listeners = new Map<string, Set<Listener>>()
const event = { sender: { id: 1 } }

/** Sends an event to the preload's listeners, as main's webContents.send does. */
export function emit(channel: string, ...args: any[]): void {
  for (const l of listeners.get(channel) ?? []) l(event, ...args)
}

async function dispatch(channel: string, args: any[]): Promise<any> {
  const handler =
    (webHandlers as Record<string, any>)[channel] ?? (lifted as Record<string, any>)[channel]
  if (!handler) throw new Error(`${channel} is not available in the browser`)
  return handler(event, ...(await resolvePaths(args)))
}

export const ipcRenderer = {
  invoke: (channel: string, ...args: any[]) => dispatch(channel, args),
  send: (channel: string, ...args: any[]) => {
    dispatch(channel, args).catch((err) => console.error(channel, err))
  },
  on(channel: string, listener: Listener) {
    if (!listeners.has(channel)) listeners.set(channel, new Set())
    listeners.get(channel)!.add(listener)
    return ipcRenderer
  },
  removeListener(channel: string, listener: Listener) {
    listeners.get(channel)?.delete(listener)
    return ipcRenderer
  },
  removeAllListeners(channel: string) {
    listeners.delete(channel)
    return ipcRenderer
  }
}

export const contextBridge = {
  exposeInMainWorld: (key: string, value: unknown) => {
    ;(window as any)[key] = value
  }
}

export const webUtils = { getPathForFile: (file: File) => pendingPath(file) }

export default { ipcRenderer, contextBridge, webUtils }
