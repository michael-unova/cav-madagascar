import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAuthDomain } from '../../../src/lib/firebase/authDomain.ts'

const FB = 'cav-madagascar-b4beb.firebaseapp.com'
const json = (body, type = 'application/json') => new Response(JSON.stringify(body), { headers: { 'content-type': type } })
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) } }
const run = (fetchFn, over = {}) => resolveAuthDomain('cav.mg', 'cav-madagascar-b4beb', { hostname: 'cav.mg', fetchFn, storage: memoryStorage(), ...over })

test('keeps cav.mg when the proxy serves genuine Firebase JSON', async () => {
  assert.equal(await run(async () => json({ apiKey: 'abc', projectId: 'p' })), 'cav.mg')
})

test('falls back to firebaseapp.com when cav.mg answers with the website (the reported bug)', async () => {
  assert.equal(await run(async () => new Response('<!doctype html><html>CAV</html>', { headers: { 'content-type': 'text/html' } })), FB)
})

test('falls back when the JSON has no apiKey, on HTTP errors and on network errors', async () => {
  assert.equal(await run(async () => json({ hello: 1 })), FB)
  assert.equal(await run(async () => new Response('no', { status: 404, headers: { 'content-type': 'application/json' } })), FB)
  assert.equal(await run(async () => { throw new TypeError('network') }), FB)
})

test('does nothing off the custom domain (localhost, previews, Android)', async () => {
  let called = false
  const f = async () => { called = true; return json({ apiKey: 'x' }) }
  assert.equal(await run(f, { hostname: 'localhost' }), 'cav.mg')
  assert.equal(called, false)
})

test('passes through when already using the firebaseapp.com domain or when unconfigured', async () => {
  const f = async () => { throw new Error('should not be called') }
  assert.equal(await resolveAuthDomain(FB, 'cav-madagascar-b4beb', { hostname: FB, fetchFn: f }), FB)
  assert.equal(await resolveAuthDomain(undefined, 'p', { hostname: 'cav.mg', fetchFn: f }), undefined)
})

test('caches the result: a good proxy for an hour, a bad one for a minute', async () => {
  let n = 0, t = 0
  const storage = memoryStorage()
  const env = (ok) => ({ hostname: 'cav.mg', storage, now: () => t, fetchFn: async () => { n++; return ok ? json({ apiKey: 'k' }) : new Response('<html>', { headers: { 'content-type': 'text/html' } }) } })
  assert.equal(await resolveAuthDomain('cav.mg', 'p', env(false)), 'p.firebaseapp.com')
  t = 30_000
  assert.equal(await resolveAuthDomain('cav.mg', 'p', env(true)), 'p.firebaseapp.com') // cached failure
  assert.equal(n, 1)
  t = 61_000
  assert.equal(await resolveAuthDomain('cav.mg', 'p', env(true)), 'cav.mg') // re-checked, now fixed
  assert.equal(n, 2)
})
