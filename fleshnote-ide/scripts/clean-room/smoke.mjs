// Launches the packaged app in the raw environment and checks it comes up.
import { _electron } from 'playwright-core'
const [exe, shot] = process.argv.slice(2)
const out = { errors: [] }
const app = await _electron.launch({ executablePath: exe, args: ['--no-sandbox'], timeout: 120000 })
try {
  const deadline = Date.now() + 150000
  let page
  while (Date.now() < deadline && !page) {
    page = app.windows().find((w) => w.url().includes('index.html'))
    if (!page) await new Promise((r) => setTimeout(r, 1000))
  }
  if (!page) throw new Error('main window never appeared: ' + app.windows().map((w) => w.url().slice(0, 40)))
  page.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)))
  await page.waitForLoadState('load'); await new Promise((r) => setTimeout(r, 6000))
  out.versions = await app.evaluate(({ app }) => ({ app: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }))
  out.body = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160)
  out.pdfBytes = await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await w.loadURL('data:text/html,<h1>Chapter</h1><p>Print test</p>')
    const b = await w.webContents.printToPDF({ pageSize: 'A5' })
    w.destroy(); return b.length
  })
  await page.screenshot({ path: shot })
} catch (e) { out.failure = String(e).slice(0, 400) }
console.log('SMOKE', JSON.stringify(out))
const pid = app.process().pid
await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 15000))])
try { process.kill(pid, 'SIGKILL') } catch {}
process.exit(out.failure ? 1 : 0)
