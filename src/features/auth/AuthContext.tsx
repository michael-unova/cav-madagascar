import { createContext } from 'react'
import type { User } from '../../types'

export interface AuthContextValue {
  /** The signed-in user's resolved Firestore profile, or null when signed out. */
  user: User | null
  /** True until the initial Firebase Authentication state has resolved. */
  isLoading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
