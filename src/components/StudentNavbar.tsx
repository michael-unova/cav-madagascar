import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, logoutUser } from '../features/auth'
import { subscribeMyNotifications } from '../features/lessonComments'
import type { LessonNotification } from '../features/lessonComments/lessonCommentRepository'

export function StudentNavbar() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<LessonNotification[]>([])

  useEffect(() => {
    if (!user) return
    return subscribeMyNotifications(user.uid, setNotifications, () => setNotifications([]))
  }, [user])

  if (!user) return null
  const name = String(profile?.displayName ?? user.displayName ?? 'Étudiant')
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'E'
  const photo = String(profile?.photoURL ?? user.photoURL ?? '')

  const links = [
    ['/dashboard', '⌂', 'Accueil'],
    ['/courses', '◈', 'Concours'],
    ['/courses', '▣', 'Mes cours'],
    ['/library', '▤', 'Bibliothèque'],
    ['/results', '◒', 'Résultats'],
  ]

  return <header className="student-navbar">
    <div className="student-navbar-inner">
      <Link to="/dashboard" className="student-brand" aria-label="CAV Madagascar">
        <img src="/assets/cav-logo.png" alt="CAV Madagascar" />
      </Link>
      <nav className="student-nav-links" aria-label="Navigation étudiant">
        {links.map(([href, icon, label], index) => {
          const active = index === 0 ? location.pathname === '/dashboard' : index === 1 ? location.pathname === '/courses' : index === 3 ? location.pathname.startsWith('/library') : false
          return <Link key={label} to={href} className={active ? 'is-active' : ''}><span>{icon}</span>{label}</Link>
        })}
      </nav>
      <div className="student-nav-search"><span>⌕</span><input aria-label="Rechercher" placeholder="Rechercher un concours, une matière..." /></div>
      <div className="student-nav-actions">
        <button type="button" className="student-bell" aria-label="Notifications">♧{notifications.length > 0 && <b>{notifications.length > 99 ? '99+' : notifications.length}</b>}</button>
        {photo ? <img src={photo} alt="" className="student-avatar" /> : <span className="student-avatar student-avatar-fallback">{initials}</span>}
        <span className="student-user-name">{name}</span>
        <span className="student-user-chevron">⌄</span>
        <button className="student-logout" type="button" onClick={() => void (async () => { await logoutUser(); navigate('/', { replace: true }) })()}>Se déconnecter</button>
      </div>
    </div>
  </header>
}
