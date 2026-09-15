import { Link, Outlet } from 'react-router-dom'
import { Logo } from '../../components/Logo/Logo'
import { Button } from '../../components/Button/Button'
import { paths } from '../../routes/paths'
import styles from './PublicLayout.module.css'

export function PublicLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to={paths.home} className={styles.logoLink}>
            <Logo />
          </Link>
          <nav className={styles.nav}>
            <Button to={paths.login} variant="ghost" size="sm">
              Se connecter
            </Button>
            <Button to={paths.register} variant="primary" size="sm">
              Commencer
            </Button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Logo size="sm" />
          <p className={styles.footerText}>
            © {new Date().getFullYear()} Nova Études. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
