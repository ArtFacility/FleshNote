// The browser build of FleshNote (Seneschal Labs): the renderer and the preload, unchanged,
// with src/web standing in for Electron. `npm run build:web` writes out/web, and
// scripts/deploy-labs.mjs puts it on the home server with labs/fleshnote and the backend.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import liftHandlers from './src/web/lift-handlers.mjs'

const root = resolve(import.meta.dirname)

export default defineConfig({
  root: resolve(root, 'src/web'),
  base: './', // the app's folder on the Labs site is not named anywhere
  resolve: {
    alias: {
      '@renderer': resolve(root, 'src/renderer/src'),
      electron: resolve(root, 'src/web/electron.ts'),
      '@electron-toolkit/preload': resolve(root, 'src/web/toolkit-preload.ts')
    }
  },
  define: {
    // the preload's choice between contextBridge and window: a page has no isolated context
    'process.contextIsolated': 'false'
  },
  plugins: [
    react(),
    liftHandlers({ root }),
    {
      // fleshnote-asset://load/<path> is Electron's protocol for project images; the browser
      // build fetches them from the server instead (backend.ts fileUrl)
      name: 'fleshnote-asset-urls',
      transform(code, id) {
        if (!id.includes('/src/renderer/') || !code.includes('fleshnote-asset://load/')) return null
        return { code: code.replaceAll('fleshnote-asset://load/', 'api/web/file?p='), map: null }
      }
    }
  ],
  build: {
    outDir: resolve(root, 'out/web'),
    emptyOutDir: true
  }
})
