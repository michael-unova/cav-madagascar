import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import styles from './NavItem.module.css'

export interface NavItemProps {
  to: string
  label: string
  icon: string
  onNavigate?: () => void
}

export function NavItem({ to, label, icon, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) => cn(styles.item, isActive && styles.active)}
    >
      <svg className={styles.icon} aria-hidden="true">
        <use href={`/icons.svg#${icon}`} />
      </svg>
      <span>{label}</span>
    </NavLink>
  )
}
