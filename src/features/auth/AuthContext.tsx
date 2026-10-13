import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getFirebaseApp } from '../../lib/firebase/config'
import { getFirebaseAuth } from './firebaseAuth'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { completeGoogleRedirect, getUserProfile, waitForPendingSignIn } from './authService'
import { useSingleDeviceSession } from './useSingleDeviceSession'

type AuthContextValue = { user: FirebaseUser | null; profile: Record<string, unknown> | null; loading: boolean; refreshProfile: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const auth = getFirebaseAuth(getFirebaseApp())
const firestore = getFirebaseFirestore()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Finish a Google sign-in that used the redirect fallback (no-op otherwise).
    void completeGoogleRedirect().catch(err => console.error('Google redirect sign-in failed:', err))
  }, [])

  useEffect(() => onAuthStateChanged(auth, async nextUser => {
    setUser(nextUser)
    if (!nextUser) { setProfile(null); setLoading(false); return }
    try {
      // A sign-in/registration in progress is still writing the Firestore profile.
      await waitForPendingSignIn()
      const nextProfile = await getUserProfile(nextUser.uid)
      setProfile((nextProfile as Record<string, unknown> | null) ?? null)
    } catch (err) {
      console.error(err)
      setProfile(null)
    } finally {
      setLoading(false)
    }

    void updateDoc(doc(firestore, 'users', nextUser.uid), { lastSeenAt: serverTimestamp() }).catch(console.error)
  }), [])

  useEffect(() => {
    if (!user) return
    const interval = window.setInterval(() => { void updateDoc(doc(firestore, 'users', user.uid), { lastSeenAt: serverTimestamp() }).catch(console.error) }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [user])

  useSingleDeviceSession(user, profile)

  const refreshProfile = async () => {
    const current = auth.currentUser
    if (!current) { setProfile(null); return }
    const nextProfile = await getUserProfile(current.uid)
    setProfile((nextProfile as Record<string, unknown> | null) ?? null)
  }

  const value = useMemo(() => ({ user, profile, loading, refreshProfile }), [user, profile, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context }
