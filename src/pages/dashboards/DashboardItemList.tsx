import { Link } from 'react-router-dom'
import styles from './DashboardItemList.module.css'

export interface DashboardItem {
  id: string
  label: string
  /** Short secondary line, for example the owning class or a count. */
  meta?: string
  to: string
}

export interface DashboardItemListProps {
  items: DashboardItem[]
}

/** Renders the first few entries of a section as links into the full page. */
export function DashboardItemList({ items }: DashboardItemListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <Link to={item.to} className={styles.row}>
            <span className={styles.body}>
              <span className={styles.label}>{item.label}</span>
              {item.meta && <span className={styles.meta}>{item.meta}</span>}
            </span>
            <svg className={styles.chevron} aria-hidden="true">
              <use href="/icons.svg#icon-chevron-right" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  )
}
