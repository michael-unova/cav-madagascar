import { NavLink } from 'react-router-dom'
import { Container } from './ui/Container'

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
  return <div className="admin-nav-wrap"><Container><nav className="admin-nav" aria-label="Administration">{items.map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => isActive ? 'is-active' : ''}>{label}</NavLink>)}</nav></Container></div>
}
