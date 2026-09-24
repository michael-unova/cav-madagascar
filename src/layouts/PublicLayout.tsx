import { Link, Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { Container } from '../components/ui/Container'

export function PublicLayout() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Container className="header-inner">
          <Logo />
          <nav className="main-nav" aria-label="Navigation principale">
            <Link to="/">Accueil</Link>
            <Link to="/courses">Concours</Link>
            <Link to="/about">À propos</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-login" to="/login">Se connecter</Link>
            <Link className="ui-button ui-button-primary" to="/register">Créer un compte</Link>
          </div>
        </Container>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <Container>
          <p>© {new Date().getFullYear()} CAV Madagascar. Tous droits réservés.</p>
        </Container>
      </footer>
    </div>
  )
}
