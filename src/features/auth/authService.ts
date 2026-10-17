import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  deleteUser,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from '../../lib/firebase/config'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseAuth } from './firebaseAuth'
import { getPublicSiteUrl } from '../../lib/siteUrl'

const firestore = getFirebaseFirestore()
const auth = getFirebaseAuth(getFirebaseApp())

/**
 * onAuthStateChanged fires as soon as Firebase Auth has a user, which is BEFORE
 * the Firestore profile document of a brand-new account has been written.
 * AuthProvider awaits this promise so it never caches an empty profile for a
 * freshly created account (which left Google sign-ups without role/status and
 * without a device session).
 */
let pendingSignIn: Promise<void> | null = null

export function waitForPendingSignIn(): Promise<void> {
  return pendingSignIn ?? Promise.resolve()
}

async function withPendingSignIn<T>(task: () => Promise<T>): Promise<T> {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  pendingSignIn = gate
  try {
    return await task()
  } finally {
    release()
    if (pendingSignIn === gate) pendingSignIn = null
  }
}

function accountSuspendedError() {
  const error = new Error('ACCOUNT_SUSPENDED') as Error & { code: string }
  error.code = 'auth/account-suspended'
  return error
}

export async function registerUser(
  displayName: string,
  email: string,
  password: string,
  phone: string,
): Promise<FirebaseUser> {
  return withPendingSignIn(() => registerUserInner(displayName, email, password, phone))
}

async function registerUserInner(
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
    throw accountSuspendedError()
  }
  return credential.user
}


/**
 * Makes sure a Google-authenticated user has a Firestore profile, and refuses
 * suspended accounts. Shared by the popup and the redirect flows.
 */
async function finishGoogleSignIn(user: FirebaseUser): Promise<FirebaseUser> {
  const existingProfile = await getUserProfile(user.uid)

  if (existingProfile?.status === 'suspended') {
    await signOut(auth)
    throw accountSuspendedError()
  }

  if (!existingProfile) {
    await setDoc(doc(firestore, 'users', user.uid), {
      uid: user.uid,
      displayName: user.displayName?.trim() || 'Étudiant',
      email: user.email,
      role: 'student',
      status: 'active',
      phone: '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  return user
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

// Popup problems that a full-page redirect can work around.
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
])

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  return withPendingSignIn(async () => {
    const provider = createGoogleProvider()
    try {
      const credential = await signInWithPopup(auth, provider)
      return await finishGoogleSignIn(credential.user)
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? ''
      if (REDIRECT_FALLBACK_CODES.has(code)) {
        // The page navigates away; the result is handled by completeGoogleRedirect().
        await signInWithRedirect(auth, provider)
        return null
      }
      throw error
    }
  })
}

/** Completes a Google sign-in started with signInWithRedirect (popup fallback). */
export async function completeGoogleRedirect(): Promise<void> {
  await withPendingSignIn(async () => {
    const result = await getRedirectResult(auth)
    if (result?.user) await finishGoogleSignIn(result.user)
  })
}

export async function logoutUser(): Promise<void> {
  await signOut(auth)
}

// If the e-mail function is down, students can still get Firebase's standard reset e-mail.
const RESET_FALLBACK_CODES = new Set(['functions/internal', 'functions/unavailable', 'functions/not-found', 'functions/deadline-exceeded'])

export async function resetPassword(email: string): Promise<void> {
  const address = email.trim()
  try {
    // Branded e-mail sent by the Cloud Function through Brevo (docs/EMAIL-BREVO.md).
    // The link it contains opens https://cav.mg/auth/action.
    await httpsCallable(getFirebaseFunctions(), 'sendPasswordResetEmail')({ email: address })
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? ''
    if (!RESET_FALLBACK_CODES.has(code)) throw error
    console.error('sendPasswordResetEmail unavailable, using the Firebase default e-mail', error)
    // The link in the default e-mail is built from the "Action URL" in Firebase Console > Authentication > Templates.
    auth.languageCode = 'fr'
    await sendPasswordResetEmail(auth, address, { url: `${getPublicSiteUrl()}/?auth=login`, handleCodeInApp: true })
  }
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
