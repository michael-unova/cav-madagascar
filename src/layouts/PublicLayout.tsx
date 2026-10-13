import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { Container } from '../components/ui/Container'
import { useAuth, logoutUser } from '../features/auth'
import { ContentProtection } from '../components/ContentProtection'
import { StudentNavbar } from '../components/StudentNavbar'

export function PublicLayout() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'content_manager' || profile?.role === 'super_admin'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function logout() {
    await logoutUser()
    navigate('/', { replace: true })
  }

  return <div className="site-shell cav-redesign-shell">
    {user && !isAdmin ? <StudentNavbar /> : <header className="site-header">
      <Container className="header-inner">
        <Logo />
        <nav className={`main-nav${mobileMenuOpen ? ' mobile-menu-open' : ''}`} aria-label="Navigation principale">
          <Link onClick={() => setMobileMenuOpen(false)} className={location.pathname === '/' ? 'is-active' : ''} to="/">Accueil</Link>
          <Link onClick={() => setMobileMenuOpen(false)} className={location.pathname.startsWith('/courses') ? 'is-active' : ''} to="/courses">Concours</Link>
          <Link onClick={() => setMobileMenuOpen(false)} className={location.pathname === '/about' ? 'is-active' : ''} to="/about#how-it-works">Comment ça marche</Link>
          <Link onClick={() => setMobileMenuOpen(false)} className={location.pathname === '/about' ? 'is-active' : ''} to="/about">À propos</Link>
          {!user && <Link onClick={() => setMobileMenuOpen(false)} className={location.pathname === '/contact' ? 'is-active' : ''} to="/contact">Contact</Link>}
        </nav>
        {!user && <button className="public-mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button>}
        <div className="header-actions">
          {user ? <><Link className="header-login" to={isAdmin ? '/admin' : '/dashboard'}>{isAdmin ? 'Administration' : 'Mon espace'}</Link><button className="ui-button ui-button-secondary" onClick={() => void logout()}>Se déconnecter</button></> : <><Link className="header-login" to="/login">Se connecter</Link><Link className="ui-button ui-button-primary" to="/register">Créer un compte</Link></>}
        </div>
      </Container>
    </header>}
    <main><ContentProtection><Outlet /></ContentProtection></main>
    {user && !isAdmin && <nav className="student-mobile-nav" aria-label="Navigation mobile">
      <Link to="/dashboard"><span>⌂</span>Accueil</Link>
      <Link to="/courses"><span>◈</span>Concours</Link>
      <Link to="/library"><span>▤</span>Bibliothèque</Link>
      <Link to="/dashboard"><span>◒</span>Résultats</Link>
    </nav>}
    {!user && <footer className="site-footer"><Container><p>© {new Date().getFullYear()} CAV Madagascar. Tous droits réservés.</p></Container></footer>}
  </div>
}
