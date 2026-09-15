import { useEffect, useState, type ReactNode } from 'react'
import { getUserProfile } from '../../lib/firebase/users'
import { subscribeToAuthState } from './authService'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { User } from '../../types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setIsLoading(false)
        return
      }

      getUserProfile(firebaseUser.uid)
        .then((profile) => {
          setUser(profile)
        })
        .catch(() => {
          // The Firestore profile could not be read (offline, rules
          // mismatch, etc). Treat the visitor as signed out rather than
          // exposing a user with an unresolved role.
          setUser(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    })

    return unsubscribe
  }, [])

  const value: AuthContextValue = { user, isLoading }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
