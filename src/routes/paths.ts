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
