import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/Logo/Logo'
import { NavItem } from '../../components/NavItem/NavItem'
import { Avatar } from '../../components/Avatar/Avatar'
import { Badge } from '../../components/Badge/Badge'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAuth } from '../../features/auth/useAuth'
import { signOutUser } from '../../features/auth/authService'
import { paths, roleDashboardPaths } from '../../routes/paths'
import { cn } from '../../utils/cn'
import type { UserRole } from '../../types'
import styles from './AppLayout.module.css'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  teacher: 'Enseignant',
  student: 'Étudiant',
}

export interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  // AppLayout only ever renders behind ProtectedRoute, so `user` is
  // expected to be set; the fallbacks below are defensive, not the
  // normal path.
  const { user } = useAuth()
  const role = user?.role ?? 'student'
  const displayName = user?.displayName ?? roleLabels[role]

  const isDesktop = useMediaQuery('(min-width: 960px)')
  const [isNavOpen, setIsNavOpen] = useState(false)
  const navigate = useNavigate()

  const closeNav = () => setIsNavOpen(false)

  const handleSignOut = async () => {
    closeNav()
    await signOutUser()
    navigate(paths.home)
  }

  const navLinks = (
    <nav className={styles.nav}>
      <NavItem to={roleDashboardPaths[role]} label="Tableau de bord" icon="icon-home" onNavigate={closeNav} />
      <NavItem to={paths.profile} label="Profil" icon="icon-user" onNavigate={closeNav} />
    </nav>
  )

  const signOutLink = (
    <div className={styles.navFooter}>
      <button type="button" className={styles.logoutLink} onClick={handleSignOut}>
        <svg className={styles.logoutIcon} aria-hidden="true">
          <use href="/icons.svg#icon-logout" />
        </svg>
        <span>Déconnexion</span>
      </button>
    </div>
  )

  return (
    <div className={styles.shell}>
      {isDesktop && (
        <aside className={styles.sidebar}>
          <Link to={paths.home} className={styles.logoLink}>
            <Logo />
          </Link>
          {navLinks}
          {signOutLink}
        </aside>
      )}

      <div className={styles.contentColumn}>
        <header className={styles.header}>
          {!isDesktop && (
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Ouvrir la navigation"
              onClick={() => setIsNavOpen(true)}
            >
              <svg className={styles.menuIcon} aria-hidden="true">
                <use href="/icons.svg#icon-menu" />
              </svg>
            </button>
          )}

          <div className={styles.headerSpacer} />

          <div className={styles.headerUser}>
            <Badge tone="primary">{roleLabels[role]}</Badge>
            <Avatar name={displayName} size="sm" />
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>

      {!isDesktop && (
        <div
          className={cn(styles.mobileOverlay, isNavOpen && styles.mobileOverlayOpen)}
          onClick={closeNav}
        >
          <div className={styles.mobileNav} onClick={(event) => event.stopPropagation()}>
            <div className={styles.mobileNavHeader}>
              <Logo size="sm" />
              <button
                type="button"
                className={styles.menuButton}
                aria-label="Fermer la navigation"
                onClick={closeNav}
              >
                <svg className={styles.menuIcon} aria-hidden="true">
                  <use href="/icons.svg#icon-close" />
                </svg>
              </button>
            </div>
            {navLinks}
            {signOutLink}
          </div>
        </div>
      )}
    </div>
  )
}
