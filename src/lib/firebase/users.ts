import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseFirestore } from './firestore'
import type { User, UserRole } from '../../types'

const USERS_COLLECTION = 'users'

export interface CreateUserProfileInput {
  id: string
  email: string
  displayName: string
  role: UserRole
}

/**
 * Creates the Firestore profile document for a newly registered user.
 * The document id always matches the Firebase Authentication uid, so
 * Firestore Security Rules can enforce "a user may only write their own
 * document" without an extra lookup.
 */
export async function createUserProfile({ id, email, displayName, role }: CreateUserProfileInput): Promise<void> {
  const firestore = getFirebaseFirestore()
  await setDoc(doc(firestore, USERS_COLLECTION, id), {
    id,
    email,
    displayName,
    role,
    createdAt: serverTimestamp(),
  })
}

/**
 * Reads a user's profile document and returns it in application shape.
 * Returns null when the document does not exist, for example if Firestore
 * writes were ever to fall out of sync with Firebase Authentication.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, USERS_COLLECTION, uid))

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data()
  const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
    ? data.createdAt.toDate().toISOString()
    : new Date().toISOString()

  return {
    id: snapshot.id,
    email: data.email,
    displayName: data.displayName,
    role: data.role as UserRole,
    avatarUrl: data.avatarUrl,
    createdAt,
  }
}
