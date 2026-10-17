import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActionUrl, decideThrottle, renderPasswordResetEmail, throttleKey } from '../lib/passwordResetEmail.js'

test('buildActionUrl keeps only the oobCode and targets the app action page on cav.mg', () => {
  const url = new URL(buildActionUrl('https://cav-madagascar-b4beb.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=k&lang=en'))
  assert.equal(url.origin, 'https://cav.mg')
  assert.equal(url.pathname, '/auth/action')
  assert.equal(url.searchParams.get('mode'), 'resetPassword')
  assert.equal(url.searchParams.get('oobCode'), 'ABC123')
  assert.equal(url.searchParams.get('apiKey'), null)
  assert.equal(url.searchParams.get('continueUrl'), 'https://cav.mg/?auth=login')
})

test('buildActionUrl rejects a link without oobCode', () => {
  assert.throws(() => buildActionUrl('https://x.test/__/auth/action?mode=resetPassword'))
})

test('email is French, contains the link and escapes HTML', () => {
  const m = renderPasswordResetEmail('https://cav.mg/auth/action?a=1&b="x"<y>')
  assert.match(m.subject, /mot de passe/)
  assert.match(m.html, /lang="fr"/)
  assert.ok(m.html.includes('a=1&amp;b=&quot;x&quot;&lt;y&gt;'))
  assert.ok(!m.html.includes('<y>'))
  assert.ok(m.text.includes('https://cav.mg/auth/action'))
  assert.ok(!/[—–]/.test(m.html + m.text), 'no em/en dashes')
})

test('throttle: 1 per minute, 5 per hour', () => {
  let h = []; let t = 1_000_000
  let d = decideThrottle(h, t); assert.equal(d.allowed, true); h = d.history
  d = decideThrottle(h, t + 30_000); assert.equal(d.allowed, false); h = d.history
  for (let i = 1; i <= 4; i++) { t += 61_000; d = decideThrottle(h, t); assert.equal(d.allowed, true); h = d.history }
  t += 61_000; d = decideThrottle(h, t); assert.equal(d.allowed, false) // 6th within the hour
  d = decideThrottle(h, t + 3_600_000); assert.equal(d.allowed, true)
})

test('throttleKey hashes and normalizes the address', () => {
  assert.equal(throttleKey('email', ' A@B.com '), throttleKey('email', 'a@b.com'))
  assert.ok(!throttleKey('email', 'a@b.com').includes('@'))
})
