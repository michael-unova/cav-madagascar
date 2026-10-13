import { NavLink } from 'react-router-dom'
import { Container } from './ui/Container'
import { useAuth } from '../features/auth'

const items = [
  ['/admin', 'Tableau de bord'],
  ['/admin/courses', 'Concours'],
  ['/admin/subjects', 'Matières'],
  ['/admin/curriculum', 'Curriculum'],
  ['/admin/content', 'Contenus & leçons'],
  ['/admin/questions', 'Questions, exercices & quiz'],
  ['/admin/psychotechnical', 'Tests psychotechniques'],
  ['/admin/payments', 'Paiements'],
  ['/admin/users', 'Utilisateurs'],
  ['/admin/analytics', 'Analytics'],
] as const

export function AdminNav() {
  const { profile } = useAuth()
  const visibleItems = profile?.role === 'super_admin' ? items : items.filter(([to]) => to !== '/admin/analytics')
  return <div className="admin-nav-wrap"><Container><nav className="admin-nav" aria-label="Administration">{visibleItems.map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => isActive ? 'is-active' : ''}>{label}</NavLink>)}</nav></Container></div>
}
