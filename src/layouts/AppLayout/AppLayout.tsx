import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo/Logo'
import { NavItem } from '../../components/NavItem/NavItem'
import { Avatar } from '../../components/Avatar/Avatar'
import { Badge } from '../../components/Badge/Badge'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { paths } from '../../routes/paths'
import { cn } from '../../utils/cn'
import type { UserRole } from '../../types'
import styles from './AppLayout.module.css'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  teacher: 'Enseignant',
  student: 'Étudiant',
}

const roleDashboardPaths: Record<UserRole, string> = {
  admin: paths.dashboardAdmin,
  teacher: paths.dashboardTeacher,
  student: paths.dashboardStudent,
}

export interface AppLayoutProps {
  /**
   * The role whose dashboard is currently being viewed. This does not
   * enforce any authorization: it only labels which placeholder dashboard
   * is on screen until Milestone 2 introduces real Firebase Authentication
   * and resolves the signed in user's actual role.
   */
  role: UserRole
  children: ReactNode
}

export function AppLayout({ role, children }: AppLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)')
  const [isNavOpen, setIsNavOpen] = useState(false)

  const closeNav = () => setIsNavOpen(false)

  const navLinks = (
    <nav className={styles.nav}>
      <NavItem to={roleDashboardPaths[role]} label="Tableau de bord" icon="icon-home" onNavigate={closeNav} />
      <NavItem to={paths.profile} label="Profil" icon="icon-user" onNavigate={closeNav} />
    </nav>
  )

  const signOutLink = (
    <div className={styles.navFooter}>
      {/*
        Placeholder sign out action. Real session termination is wired up
        in Milestone 2 once Firebase Authentication is implemented.
      */}
      <Link to={paths.home} className={styles.logoutLink} onClick={closeNav}>
        <svg className={styles.logoutIcon} aria-hidden="true">
          <use href="/icons.svg#icon-logout" />
        </svg>
        <span>Déconnexion</span>
      </Link>
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
            <Avatar name={roleLabels[role]} size="sm" />
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
