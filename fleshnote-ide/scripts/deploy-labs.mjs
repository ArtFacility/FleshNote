#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain JavaScript, no types to declare */
// Puts FleshNote's browser build on Seneschal Labs (the home server), as /srv/labs/fleshnote/:
// labs/fleshnote (manifest and ./run), the build (out/web -> web/) and the backend.
//
//   node scripts/deploy-labs.mjs             build, copy, restart the backend if it changed
//   node scripts/deploy-labs.mjs --no-build  copy the last build
//   node scripts/deploy-labs.mjs --id fleshnote-demo   the demo copy: labs/<id> over labs/fleshnote
//
// The page picks up a new build on its next reload; the backend restarts only when its files
// changed. Once per machine, the app is set up there with sudo (seneschal repo:
// deploy/homeserver/setup-lab-app.sh fleshnote), which also lets this script restart it.
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HOST = process.env.LABS_HOST || 'homeserver'
const idArg = process.argv.indexOf('--id')
const ID = idArg > 0 ? process.argv[idArg + 1] : 'fleshnote'
const root = path.resolve(import.meta.dirname, '..')

// Not shipped: environments, builds, caches, tests and data the backend downloads on demand.
const SKIP_DIRS = new Set([
  '.venv',
  'build',
  'dist',
  '__pycache__',
  'nltk_data',
  'test_fixtures',
  'Testproject',
  'docs'
])
const skipFile = (name) =>
  /^test_.*\.py$|\.py[co]$|\.db-(shm|wal)$|\.log$/.test(name) || name.startsWith('temp_test_')

function step(what) {
  console.log(`==> ${what}`)
}

if (!process.argv.includes('--no-build')) {
  step('Building the browser version')
  const r = spawnSync('npm', ['run', 'build:web'], { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status || 1)
}
const web = path.join(root, 'out/web')
if (!fs.existsSync(path.join(web, 'index.html'))) {
  console.error('No build in out/web; run without --no-build')
  process.exit(1)
}

step('Staging')
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'fleshnote-labs-'))
fs.cpSync(path.join(root, 'labs', 'fleshnote'), stage, { recursive: true })
if (ID !== 'fleshnote') fs.cpSync(path.join(root, 'labs', ID), stage, { recursive: true }) // its own manifest
fs.cpSync(web, path.join(stage, 'web'), { recursive: true })
const backendSrc = path.join(root, 'backend')
fs.cpSync(backendSrc, path.join(stage, 'backend'), {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(backendSrc, src)
    if (!rel) return true
    const parts = rel.split(path.sep)
    if (parts.length === 1 && SKIP_DIRS.has(parts[0])) return false
    if (parts.includes('__pycache__')) return false
    return fs.statSync(src).isDirectory() || !skipFile(path.basename(src))
  }
})
fs.writeFileSync(
  path.join(stage, 'version'),
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version + '\n'
)

// What the backend is made of, so the server restarts it only when that changed.
const hash = crypto.createHash('sha256')
const walk = (dir) => {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full)
    else hash.update(path.relative(stage, full).replace(/\\/g, '/')).update(fs.readFileSync(full))
  }
}
walk(path.join(stage, 'backend'))
hash.update(fs.readFileSync(path.join(stage, 'run')))
fs.writeFileSync(path.join(stage, 'backend.hash'), hash.digest('hex') + '\n')

step(`Copying to ${HOST}:/srv/labs/${ID}`)
const dest = `/srv/labs/${ID}`
const remote = [
  'set -e',
  `[ -d ${dest}/data ] || { echo "${dest}/data is missing: set the app up once (setup-lab-app.sh ${ID})"; exit 3; }`,
  `s=~/labs-incoming/${ID}; rm -rf "$s"; mkdir -p "$s"; tar --warning=no-timestamp -C "$s" -xf -`,
  `old=$(cat ${dest}/backend.hash 2>/dev/null || true)`,
  `rsync -rlt --delete --no-g --chmod=Dg+rx,Fg+r --exclude /data/ "$s"/ ${dest}/`,
  `chmod 750 ${dest}/run`,
  `if [ "$old" = "$(cat ${dest}/backend.hash)" ] && systemctl is-active --quiet seneschal-lab@${ID}; then echo "backend unchanged"; ` +
    `elif sudo -n systemctl restart seneschal-lab@${ID}; then echo "backend restarted"; ` +
    `else echo "the backend changed but could not be restarted: sudo systemctl restart seneschal-lab@${ID}"; exit 4; fi`
].join('\n')
const tar = spawn('tar', ['-C', stage, '-cf', '-', '.'], { stdio: ['ignore', 'pipe', 'inherit'] })
const ssh = spawn('ssh', ['-o', 'BatchMode=yes', HOST, remote], {
  stdio: ['pipe', 'inherit', 'inherit']
})
tar.stdout.pipe(ssh.stdin)
ssh.on('close', (code) => {
  fs.rmSync(stage, { recursive: true, force: true })
  if (code !== 0) process.exit(code || 1)
  step('Deployed. Reload the page; a first start installs the Python packages (a few minutes).')
})
