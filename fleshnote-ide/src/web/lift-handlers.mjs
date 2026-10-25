/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain JavaScript, no types to declare */
// Vite plugin for the browser build: lifts Electron main's IPC handlers that only pass their
// arguments on to the Python backend (src/main/index.ts) into the browser, so the browser build
// gets every new endpoint without a line of its own.
//
// A handler is lifted when its body uses nothing but its own parameters and locals,
// backendPost / backendGet, and JavaScript's globals. Everything else (dialogs, files, windows)
// has a hand-written browser version in src/web/handlers.ts. The build fails when a channel the
// preload uses has neither, or when handlers.ts names a channel the preload doesn't have.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const VIRTUAL = 'virtual:fleshnote-lifted'
const GLOBALS = new Set([
  'backendPost',
  'backendGet',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Math',
  'Date',
  'Promise',
  'Error',
  'console',
  'undefined',
  'encodeURIComponent',
  'decodeURIComponent',
  'Uint8Array',
  'Map',
  'Set',
  'isNaN',
  'parseInt',
  'parseFloat',
  'RegExp'
])

function parse(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

// The names a function's body reads that it doesn't declare itself.
function freeNames(fn) {
  const declared = new Set()
  walk(fn, (n) => {
    if (
      (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) &&
      ts.isIdentifier(n.name)
    ) {
      declared.add(n.name.text)
    }
    if ((ts.isFunctionDeclaration(n) || ts.isCatchClause(n)) && n.name) declared.add(n.name.text)
    if (
      ts.isCatchClause(n) &&
      n.variableDeclaration &&
      ts.isIdentifier(n.variableDeclaration.name)
    ) {
      declared.add(n.variableDeclaration.name.text)
    }
  })
  const free = new Set()
  walk(fn, (n) => {
    if (!ts.isIdentifier(n)) return
    const p = n.parent
    if (ts.isPropertyAccessExpression(p) && p.name === n) return
    if (
      (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p)) &&
      p.name === n
    )
      return
    if (ts.isBindingElement(p) && p.propertyName === n) return
    if (ts.isTypeReferenceNode(p) || ts.isQualifiedName(p) || ts.isTypeQueryNode(p)) return
    if (
      (ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isBindingElement(p)) &&
      p.name === n
    )
      return
    if (!declared.has(n.text) && !GLOBALS.has(n.text)) free.add(n.text)
  })
  return free
}

// ipcMain.handle('channel', fn) / ipcMain.on('channel', fn) calls in main.
export function mainHandlers(file) {
  const out = []
  walk(parse(file), (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return
    const callee = n.expression
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== 'ipcMain') return
    if (!['handle', 'on'].includes(callee.name.text)) return
    const [ch, fn] = n.arguments
    if (
      !ch ||
      !ts.isStringLiteral(ch) ||
      !fn ||
      !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))
    )
      return
    out.push({ channel: ch.text, fn, free: [...freeNames(fn)] })
  })
  return out
}

// The channels the preload sends on (ipcRenderer.invoke / send).
export function preloadChannels(file) {
  const out = new Set()
  walk(parse(file), (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return
    const callee = n.expression
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== 'ipcRenderer') return
    if (!['invoke', 'send'].includes(callee.name.text)) return
    const ch = n.arguments[0]
    if (ch && ts.isStringLiteral(ch)) out.add(ch.text)
  })
  return out
}

// The keys of `export const webHandlers = { ... }` in handlers.ts.
export function webChannels(file) {
  const out = new Set()
  walk(parse(file), (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== 'webHandlers')
      return
    if (!n.initializer || !ts.isObjectLiteralExpression(n.initializer)) return
    for (const p of n.initializer.properties) {
      if (p.name && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name))) out.add(p.name.text)
    }
  })
  return out
}

// A top-level constant of main the browser versions need too (main's DEFAULT_HOTKEYS).
export function mainConstant(file, name) {
  let text = null
  walk(parse(file), (n) => {
    if (
      text === null &&
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer
    ) {
      text = n.initializer.getText()
    }
  })
  if (text === null) throw new Error(`${name} not found in ${file}`)
  return text
}

export function plan({ main, preload, handlers }) {
  const all = mainHandlers(main)
  const web = webChannels(handlers)
  const lifted = all.filter((h) => h.free.length === 0 && !web.has(h.channel))
  const used = preloadChannels(preload)
  const have = new Set([...lifted.map((h) => h.channel), ...web])
  const missing = [...used].filter((c) => !have.has(c))
  const stray = [...web].filter((c) => !used.has(c))
  const handWritten = all
    .filter((h) => h.free.length > 0)
    .map((h) => `${h.channel} (${h.free.join(', ')})`)
  return { lifted, missing, stray, handWritten }
}

export default function liftHandlers({ root }) {
  const files = {
    main: path.join(root, 'src/main/index.ts'),
    preload: path.join(root, 'src/preload/index.ts'),
    handlers: path.join(root, 'src/web/handlers.ts')
  }
  const backend = path.join(root, 'src/web/backend.ts').replace(/\\/g, '/')
  return {
    name: 'fleshnote-lift-handlers',
    buildStart() {
      const p = plan(files)
      if (p.missing.length || p.stray.length) {
        this.error(
          (p.missing.length
            ? `No browser version for: ${p.missing.join(', ')}. Add one to src/web/handlers.ts. `
            : '') +
            (p.stray.length
              ? `src/web/handlers.ts names channels the preload doesn't use: ${p.stray.join(', ')}.`
              : '')
        )
      }
      this.info?.(`${p.lifted.length} handlers lifted from main`)
    },
    resolveId(id) {
      return id === VIRTUAL ? '\0' + VIRTUAL : null
    },
    load(id) {
      if (id !== '\0' + VIRTUAL) return null
      const { lifted } = plan(files)
      const src = fs.readFileSync(files.main, 'utf8')
      const entries = lifted.map(
        (h) => `  ${JSON.stringify(h.channel)}: ${src.slice(h.fn.getStart(), h.fn.getEnd())}`
      )
      const code =
        `import { backendPost, backendGet } from ${JSON.stringify(backend)}\n` +
        `export const lifted = {\n${entries.join(',\n')}\n}\n` +
        `export const mainConstants = { DEFAULT_HOTKEYS: ${mainConstant(files.main, 'DEFAULT_HOTKEYS')} }\n`
      return ts.transpileModule(code, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
      }).outputText
    }
  }
}
