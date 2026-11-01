// node --test scripts/nightlyVersion.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { nightlyVersion } from './nightlyVersion.mjs'

const semver = createRequire(import.meta.url)('semver')
const at = (iso) => new Date(iso)

test('a nightly is stamped to the minute, in UTC', () => {
  assert.equal(nightlyVersion('2.0.0-beta.2', at('2026-11-01T09:05:00Z')), '2.0.0-nightly.202611010905')
})

test('nightlies order correctly against betas, stable and each other', () => {
  const a = nightlyVersion('2.0.0-beta.2', at('2026-11-01T09:05:00Z'))
  const b = nightlyVersion('2.0.0-beta.2', at('2026-11-01T14:30:00Z'))
  assert.ok(semver.valid(a))
  assert.ok(semver.gt(b, a), 'a later build is newer')
  assert.ok(semver.gt(a, '2.0.0-beta.9'), 'newer than any beta')
  assert.ok(semver.lt(a, '2.0.0'), 'older than the stable release')
  assert.ok(semver.gt(nightlyVersion('2.1.0-dev', at('2026-12-01T00:00:00Z')), '2.0.0'), 'the next line is past it')
})

test('a released version in package.json is refused', () => {
  assert.throws(() => nightlyVersion('2.0.0'), /released version/)
})
