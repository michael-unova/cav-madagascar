import { getAuth, type Auth } from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

let auth: Auth | undefined

export function getFirebaseAuth(app: FirebaseApp): Auth {
  if (!auth) {
    auth = getAuth(app)
  }
  return auth
}
