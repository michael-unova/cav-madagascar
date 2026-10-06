import { getUserProfile } from '../auth/authService'

export type AdminRole = 'content_manager' | 'super_admin'

export function isAdminRole(role: unknown): role is AdminRole {
  return role === 'content_manager' || role === 'super_admin'
}

export async function getAdminRole(uid: string): Promise<AdminRole | null> {
  const profile = await getUserProfile(uid)
  const role = profile?.role
  return isAdminRole(role) ? role : null
}
