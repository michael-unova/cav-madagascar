import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'icon-inbox', title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.iconWrapper}>
        <svg className={styles.icon} aria-hidden="true">
          <use href={`/icons.svg#${icon}`} />
        </svg>
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
