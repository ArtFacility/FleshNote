#!/usr/bin/env node
// Builds a nightly for this machine's system into dist/nightly, ready to upload to the
// bucket's fleshnote/nightly/ folder. package.json isn't changed: the version is stamped
// into the build only. Run once on each system you ship (Windows, Linux).
//
//   node scripts/build-nightly.mjs               everything, including the frozen backend
//   node scripts/build-nightly.mjs --no-backend  reuse backend/dist
//
// Step by step, and how the channel works: docs/NIGHTLY_BUILDS.md
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { nightlyVersion } from './nightlyVersion.mjs'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = nightlyVersion(pkg.version)
const out = path.join('dist', 'nightly')
const win = process.platform === 'win32'

function run(command, cwd = root) {
  console.log(`==> ${command}`)
  const r = spawnSync(command, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status || 1)
}

console.log(`Building FleshNote ${version}`)
if (!process.argv.includes('--no-backend')) {
  const python = path.join('.venv', win ? 'Scripts/python.exe' : 'bin/python')
  run(`"${python}" build_backend.py`, path.join(root, 'backend'))
}
run('npm ci')
run('npm run build')

fs.rmSync(path.join(root, out), { recursive: true, force: true })
const targets = win ? '--win' : process.platform === 'linux' ? '--linux AppImage deb' : '--mac'
run(
  `npx electron-builder ${targets} --publish never ` +
    `--config.extraMetadata.version=${version} --config.directories.output=${out}`
)

const files = fs.readdirSync(path.join(root, out)).filter((f) => fs.statSync(path.join(root, out, f)).isFile())
const isFeed = (f) => /^latest.*\.yml$/.test(f)
const payload = files.filter((f) => !isFeed(f) && f !== 'builder-debug.yml' && f !== 'builder-effective-config.yaml')
const feed = files.filter(isFeed)
if (!feed.length) {
  console.error(`No latest*.yml in ${out}: the app wouldn't see this build.`)
  process.exit(1)
}
console.log(`\nBuilt ${version} in ${out}. Upload to fleshnote/nightly/ in this order:`)
for (const f of payload) console.log(`  ${f}`)
console.log('Then, last, so nobody is offered files that aren\'t there yet:')
for (const f of feed) console.log(`  ${f}`)
