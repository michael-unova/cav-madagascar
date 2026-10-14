import test from 'node:test'
import assert from 'node:assert/strict'
import { handleRequest, isProxiedPath } from '../src/index.js'

const UP = 'cav-madagascar-b4beb.firebaseapp.com'

function mockFetch(impl) {
  const calls = []
  globalThis.fetch = async (input, init) => {
    const req = typeof input === 'string' ? { url: input, ...init } : input
    calls.push({ url: typeof input === 'string' ? input : input.url, init })
    return impl(req)
  }
  return calls
}

test('path allow-list', () => {
  assert.equal(isProxiedPath('/__/auth/handler'), true)
  assert.equal(isProxiedPath('/__/auth/iframe.js'), true)
  assert.equal(isProxiedPath('/__/firebase/init.json'), true)
  assert.equal(isProxiedPath('/__/firebase/other'), false)
  assert.equal(isProxiedPath('/auth/action'), false)
  assert.equal(isProxiedPath('/'), false)
})

test('proxies handler to firebaseapp.com preserving path and query, stripping cookies', async () => {
  const calls = mockFetch(() => new Response('ok', { status: 200, headers: { 'set-cookie': 'a=b', 'content-type': 'text/html' } }))
  const res = await handleRequest(
    new Request('https://cav.mg/__/auth/handler?apiKey=k&providerId=google.com', { headers: { cookie: 'secret=1' } }),
  )
  assert.equal(calls[0].url, `https://${UP}/__/auth/handler?apiKey=k&providerId=google.com`)
  assert.equal(calls[0].init.headers.get('cookie'), null)
  assert.equal(calls[0].init.headers.get('x-forwarded-host'), 'cav.mg')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('set-cookie'), null)
  assert.equal(await res.text(), 'ok')
})

test('rewrites upstream redirects back to cav.mg', async () => {
  mockFetch(() => new Response(null, { status: 302, headers: { location: `https://${UP}/__/auth/handler?x=1` } }))
  const res = await handleRequest(new Request('https://cav.mg/__/auth/handler'))
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), 'https://cav.mg/__/auth/handler?x=1')
})

test('rejects non-read methods on proxied paths', async () => {
  const calls = mockFetch(() => new Response('x'))
  const res = await handleRequest(new Request('https://cav.mg/__/auth/handler', { method: 'POST', body: 'a' }))
  assert.equal(res.status, 405)
  assert.equal(calls.length, 0)
})

test('non-Firebase paths pass through untouched', async () => {
  const calls = mockFetch(() => new Response('site'))
  const res = await handleRequest(new Request('https://cav.mg/courses'))
  assert.equal(await res.text(), 'site')
  assert.equal(calls[0].url, 'https://cav.mg/courses')
})

test('UPSTREAM_HOST env override', async () => {
  const calls = mockFetch(() => new Response('ok'))
  await handleRequest(new Request('https://cav.mg/__/firebase/init.json'), { UPSTREAM_HOST: 'other.firebaseapp.com' })
  assert.equal(calls[0].url, 'https://other.firebaseapp.com/__/firebase/init.json')
})
