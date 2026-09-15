import type { UserRole } from '../types'

/**
 * Centralized route paths. Keeping these in one place avoids typos in
 * `<Link>` targets and makes future route changes a one-line edit.
 */
export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  profile: '/profile',
  dashboard: '/dashboard',
  dashboardStudent: '/dashboard/student',
  dashboardTeacher: '/dashboard/teacher',
  dashboardAdmin: '/dashboard/admin',
} as const

/**
 * Maps each role to its dashboard route. Centralized here so
 * `DashboardRedirect`, `ProtectedRoute`, `PublicOnlyRoute`, and `AppLayout`
 * all agree on where each role lands.
 */
export const roleDashboardPaths: Record<UserRole, string> = {
  admin: paths.dashboardAdmin,
  teacher: paths.dashboardTeacher,
  student: paths.dashboardStudent,
}
