import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase/auth'
import { createUserProfile } from '../../lib/firebase/users'
import type { UserRole } from '../../types'

export interface SignUpInput {
  displayName: string
  email: string
  password: string
  role: UserRole
}

/**
 * Creates a Firebase Authentication account, sets its display name, and
 * creates the matching Firestore profile document that stores the user's
 * role. Only 'student' and 'teacher' are ever passed in from the register
 * form; Firestore Security Rules independently enforce this so a client
 * cannot self-assign the 'admin' role, which is provisioned manually.
 */
export async function signUp({ displayName, email, password, role }: SignUpInput): Promise<void> {
  const auth = getFirebaseAuth()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
  await createUserProfile({ id: credential.user.uid, email, displayName, role })
}

export async function signIn(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth()
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth())
}

/**
 * Subscribes to Firebase Authentication state changes. Returns the
 * unsubscribe function so callers can clean up on unmount.
 */
export function subscribeToAuthState(callback: (firebaseUser: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}
