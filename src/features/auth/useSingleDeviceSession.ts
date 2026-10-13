import { signOut, type User as FirebaseUser } from 'firebase/auth'
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect } from 'react'
import { getFirebaseApp } from '../../lib/firebase/config'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import { getFirebaseAuth } from './firebaseAuth'
import { announceSessionReplaced } from './sessionNotice'

// One active device per student account. Signing in on a new device claims the
// session on the server; every other device is signed out immediately.
const STORAGE_KEY = 'cav_device_session'
const LOCK_NAME = 'cav-device-session-claim'

function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function readStoredSession(uid: string): string | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as { uid?: string; sid?: string } | null
    return parsed && parsed.uid === uid && typeof parsed.sid === 'string' && parsed.sid ? parsed.sid : null
  } catch {
    return null
  }
}

function writeStoredSession(uid: string, sid: string) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid, sid })) } catch { /* storage unavailable */ }
}

function clearStoredSession() {
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
}

async function establishSession(user: FirebaseUser) {
  const ref = doc(getFirebaseFirestore(), 'userSessions', user.uid)
  const stored = readStoredSession(user.uid)

  let remote: string | undefined
  try {
    remote = (await getDocFromServer(ref)).data()?.sessionId as string | undefined
  } catch {
    remote = undefined
  }

  if (stored && stored === remote) {
    // Same device (reload or another tab): keep the session, make sure the token carries it.
    const token = await user.getIdTokenResult()
    if (token.claims.sid !== stored) await user.getIdToken(true)
    return
  }

  // New sign-in on this device: take over the account.
  const sessionId = newSessionId()
  await httpsCallable(getFirebaseFunctions(), 'claimDeviceSession')({ sessionId })
  writeStoredSession(user.uid, sessionId)
  await user.getIdToken(true)
}

export function useSingleDeviceSession(user: FirebaseUser | null, profile: Record<string, unknown> | null) {
  const uid = user?.uid ?? null
  const enforced = profile?.role === 'student' && profile?.status === 'active'

  useEffect(() => {
    if (!user || !uid || !enforced) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function start(currentUser: FirebaseUser, currentUid: string) {
      try {
        // Serialise across tabs of the same browser so two tabs never claim twice.
        if (typeof navigator !== 'undefined' && navigator.locks) {
          await navigator.locks.request(LOCK_NAME, () => establishSession(currentUser))
        } else {
          await establishSession(currentUser)
        }
      } catch (error) {
        console.error('Device session could not be established:', error)
        return
      }
      if (cancelled) return

      unsubscribe = onSnapshot(doc(getFirebaseFirestore(), 'userSessions', currentUid), snapshot => {
        if (snapshot.metadata.fromCache) return
        const remote = snapshot.data()?.sessionId as string | undefined
        const mine = readStoredSession(currentUid)
        if (remote && mine && remote !== mine) {
          clearStoredSession()
          void signOut(getFirebaseAuth(getFirebaseApp())).finally(announceSessionReplaced)
        }
      }, error => console.error('Device session listener:', error))
    }

    void start(user, uid)
    return () => { cancelled = true; unsubscribe?.() }
  }, [user, uid, enforced])
}
