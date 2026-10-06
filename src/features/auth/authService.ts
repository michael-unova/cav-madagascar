import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  deleteUser,
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
  phone: string,
): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)

  try {
    await updateProfile(credential.user, { displayName: displayName.trim() })

    await setDoc(doc(firestore, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName: displayName.trim(),
      email: credential.user.email,
      role: 'student',
      status: 'active',
      phone: phone.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return credential.user
  } catch (error) {
    try {
      await deleteUser(credential.user)
    } catch (rollbackError) {
      console.error('Registration rollback failed:', rollbackError)
    }
    throw error
  }
}

export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const profile = await getUserProfile(credential.user.uid)
  if (profile && profile.status === 'suspended') {
    await signOut(auth)
    const error = new Error('ACCOUNT_SUSPENDED') as Error & { code: string }
    error.code = 'auth/account-suspended'
    throw error
  }
  return credential.user
}


export async function loginWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const credential = await signInWithPopup(auth, provider)
  const existingProfile = await getUserProfile(credential.user.uid)

  if (existingProfile?.status === 'suspended') {
    await signOut(auth)
    const error = new Error('ACCOUNT_SUSPENDED') as Error & { code: string }
    error.code = 'auth/account-suspended'
    throw error
  }

  if (!existingProfile) {
    await setDoc(doc(firestore, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName: credential.user.displayName?.trim() || 'Étudiant',
      email: credential.user.email,
      role: 'student',
      status: 'active',
      phone: '',
      photoURL: credential.user.photoURL || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  return credential.user
}

export async function logoutUser(): Promise<void> {
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  const actionUrl = `${window.location.origin}/auth/action`
  auth.languageCode = 'fr'
  await sendPasswordResetEmail(auth, email.trim(), {
    url: actionUrl,
    handleCodeInApp: true,
  })
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
  if (auth.currentUser?.uid === uid && (data.displayName !== undefined || data.photoURL !== undefined)) {
    await updateProfile(auth.currentUser, {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.photoURL !== undefined ? { photoURL: data.photoURL } : {}),
    })
  }
}
