/**
 * The three roles supported by the platform.
 * Role checks must always be enforced server side (Firebase Security Rules /
 * trusted backend logic). This type only exists to model the shape of data
 * on the client; it must never be treated as a source of authorization.
 */
export type UserRole = 'admin' | 'teacher' | 'student'

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  avatarUrl?: string
  createdAt: string
}
