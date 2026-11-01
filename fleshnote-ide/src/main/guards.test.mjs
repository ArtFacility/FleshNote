// node --test src/main/guards.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { assetPathFromUrl, dialogStartPath, isSafeExternalUrl } from './guards.js'

test('only web and mail links open outside the app', () => {
  for (const url of ['https://fleshnote.org', 'http://example.com/a', 'mailto:a@b.co'])
    assert.equal(isSafeExternalUrl(url), true, url)
  for (const url of [
    'file:///C:/Windows/System32/calc.exe',
    'smb://evil/share',
    'ms-msdt:/id',
    'javascript:alert(1)',
    'fleshnote-asset://load/x',
    'not a url',
    ''
  ])
    assert.equal(isSafeExternalUrl(url), false, url)
})

const asset = (p) => assetPathFromUrl(`fleshnote-asset://load/${p}`)

test('a project image is served, on Windows and Unix paths', () => {
  assert.equal(asset('C:/stories/My Book.flnote/assets/img.png'), 'C:/stories/My Book.flnote/assets/img.png')
  assert.equal(asset('C:/stories/a/assets/cover/img_1.JPG'), 'C:/stories/a/assets/cover/img_1.JPG')
  assert.equal(asset('/home/me/a/assets/i.webp'), '/home/me/a/assets/i.webp')
  assert.equal(asset('C:/stories/a%20b/assets/i%20j.png'), 'C:/stories/a b/assets/i j.png')
})

test('nothing else on disk is served', () => {
  for (const p of [
    'C:/Users/me/.ssh/id_rsa',
    'C:/stories/a/fleshnote.db',
    'C:/stories/a/assets/secrets.txt',
    'C:/stories/a/assets.png',
    'C:/Users/me/photo.png',
    'C:/stories/a/assets/..%2F..%2F..%2FUsers/me/photo.png',
    'C:/stories/a/assets/%2e%2e%5c%2e%2e%5cphoto.png',
    'C:/stories/a/assets/x%00.png',
    'C:/stories/a/assets/%E0%A4%A.png'
  ])
    assert.equal(asset(p), null, p)
})

test('a dialog starts where it was asked to, else in the last folder used', () => {
  const p = path.posix
  assert.equal(dialogStartPath('/docs/a.flreview', '/last', p), '/docs/a.flreview')
  assert.equal(dialogStartPath('board.svg', '/last', p), '/last/board.svg')
  assert.equal(dialogStartPath(undefined, '/last', p), '/last')
  assert.equal(dialogStartPath('board.svg', undefined, p), 'board.svg')
  assert.equal(dialogStartPath(undefined, undefined, p), undefined)
})
