import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { roleDashboardPaths } from '../../routes/paths'
import { useAuth } from './useAuth'

/**
 * Wraps routes that only make sense for signed-out visitors, such as
 * login and register. An already authenticated visitor is redirected
 * straight to their dashboard instead of being shown the form again.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingState label="Chargement" />
  }

  if (user) {
    return <Navigate to={roleDashboardPaths[user.role]} replace />
  }

  return <>{children}</>
}
