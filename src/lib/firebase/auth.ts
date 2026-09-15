import { getAuth, type Auth } from 'firebase/auth'
import { getFirebaseApp } from './config'

let auth: Auth | undefined

/**
 * Returns the singleton Firebase Auth instance.
 *
 * This is a foundation only: sign-in flows, session handling, and role
 * resolution are implemented in Milestone 2 (Authentication + Roles).
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
  }
  return auth
}
