import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getFirebaseApp } from '../../lib/firebase/config'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseAuth } from './firebaseAuth'

const firestore = getFirebaseFirestore()
const auth = getFirebaseAuth(getFirebaseApp())

export async function registerUser(
  displayName: string,
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)

  await updateProfile(credential.user, { displayName: displayName.trim() })

  await setDoc(doc(firestore, 'users', credential.user.uid), {
    uid: credential.user.uid,
    displayName: displayName.trim(),
    email: credential.user.email,
    role: 'student',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return credential.user
}

export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function logoutUser(): Promise<void> {
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim())
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(firestore, 'users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function updateUserProfile(
  uid: string,
  data: { displayName?: string; phone?: string; photoURL?: string },
): Promise<void> {
  await updateDoc(doc(firestore, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
