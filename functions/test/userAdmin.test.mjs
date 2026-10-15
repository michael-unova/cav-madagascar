import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCanManageTarget, isAuthUserNotFound } from '../lib/userAdmin.js'

const superAdmin = { role: 'super_admin' }
const manager = { role: 'content_manager' }

const code = fn => { try { fn() } catch (e) { return e.code } return 'ok' }

test('any admin can suspend/delete a student', () => {
  for (const actor of [superAdmin, manager]) for (const action of ['suspend', 'delete'])
    assert.equal(code(() => assertCanManageTarget(actor, { role: 'student' }, action)), 'ok')
})

test('super admin can suspend/delete a content manager', () => {
  for (const action of ['suspend', 'delete'])
    assert.equal(code(() => assertCanManageTarget(superAdmin, manager, action)), 'ok')
})

test('content manager cannot suspend/delete another manager', () => {
  for (const action of ['suspend', 'delete'])
    assert.equal(code(() => assertCanManageTarget(manager, manager, action)), 'permission-denied')
})

test('super admin accounts are never manageable', () => {
  for (const actor of [superAdmin, manager]) for (const action of ['suspend', 'delete'])
    assert.equal(code(() => assertCanManageTarget(actor, superAdmin, action)), 'permission-denied')
})

test('auth/user-not-found detection', () => {
  assert.equal(isAuthUserNotFound({ code: 'auth/user-not-found' }), true)
  assert.equal(isAuthUserNotFound({ code: 'auth/internal-error' }), false)
  assert.equal(isAuthUserNotFound(null), false)
})
