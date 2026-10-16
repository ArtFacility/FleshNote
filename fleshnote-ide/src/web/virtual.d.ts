/* eslint-disable @typescript-eslint/no-explicit-any -- values crossing the IPC boundary are untyped, as in the preload (window.api: unknown) */
declare module 'virtual:fleshnote-lifted' {
  /** main's IPC handlers that only call the backend, lifted by lift-handlers.mjs. */
  export const lifted: Record<string, (event: unknown, ...args: any[]) => any>
  export const mainConstants: { DEFAULT_HOTKEYS: Record<string, string> }
}
