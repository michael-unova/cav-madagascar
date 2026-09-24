import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getFirebaseApp } from '../../lib/firebase/config'
import { getFirebaseAuth } from './firebaseAuth'
import { getUserProfile } from './authService'

type AuthContextValue = {
  user: FirebaseUser | null
  profile: Record<string, unknown> | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const auth = getFirebaseAuth(getFirebaseApp())

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const nextProfile = await getUserProfile(nextUser.uid)
        setProfile((nextProfile as Record<string, unknown> | null) ?? null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
