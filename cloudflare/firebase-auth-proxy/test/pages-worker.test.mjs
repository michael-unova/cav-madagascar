import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { isProxiedPath } from '../../../public/_worker.js'

const UP = 'cav-madagascar-b4beb.firebaseapp.com'

function mockFetch(impl) {
  const calls = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: typeof input === 'string' ? input : input.url, init })
    return impl()
  }
  return calls
}

const assets = (body = 'site') => ({ fetch: async () => new Response(body) })

test('only Firebase helper paths are proxied', () => {
  assert.equal(isProxiedPath('/__/auth/handler'), true)
  assert.equal(isProxiedPath('/__/auth/iframe'), true)
  assert.equal(isProxiedPath('/__/firebase/init.json'), true)
  assert.equal(isProxiedPath('/__/firebase/other'), false)
  assert.equal(isProxiedPath('/auth/action'), false)
  assert.equal(isProxiedPath('/'), false)
})

test('forwards /__/auth/handler to Firebase, keeping query and dropping cookies', async () => {
  const calls = mockFetch(() => new Response('google', { headers: { 'set-cookie': 'a=b' } }))
  const res = await worker.fetch(
    new Request('https://cav.mg/__/auth/handler?apiKey=k&providerId=google.com', { headers: { cookie: 's=1' } }),
    { ASSETS: assets() },
  )
  assert.equal(calls[0].url, `https://${UP}/__/auth/handler?apiKey=k&providerId=google.com`)
  assert.equal(calls[0].init.headers.get('cookie'), null)
  assert.equal(res.headers.get('set-cookie'), null)
  assert.equal(await res.text(), 'google')
})

test('rewrites upstream redirects back to cav.mg', async () => {
  mockFetch(() => new Response(null, { status: 302, headers: { location: `https://${UP}/__/auth/handler?x=1` } }))
  const res = await worker.fetch(new Request('https://cav.mg/__/auth/handler'), { ASSETS: assets() })
  assert.equal(res.headers.get('location'), 'https://cav.mg/__/auth/handler?x=1')
})

test('rejects write methods on proxied paths', async () => {
  const calls = mockFetch(() => new Response('x'))
  const res = await worker.fetch(new Request('https://cav.mg/__/auth/handler', { method: 'POST', body: 'a' }), { ASSETS: assets() })
  assert.equal(res.status, 405)
  assert.equal(calls.length, 0)
})

test('everything else is served by the static site', async () => {
  const calls = mockFetch(() => new Response('should not be called'))
  const res = await worker.fetch(new Request('https://cav.mg/courses'), { ASSETS: assets('static-site') })
  assert.equal(await res.text(), 'static-site')
  assert.equal(calls.length, 0)
})
