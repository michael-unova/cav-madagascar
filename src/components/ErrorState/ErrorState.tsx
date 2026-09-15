import type { ReactNode } from 'react'
import styles from './ErrorState.module.css'

export interface ErrorStateProps {
  title?: string
  description?: string
  action?: ReactNode
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description = "Le contenu n'a pas pu être chargé. Veuillez réessayer.",
  action,
}: ErrorStateProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.iconWrapper}>
        <svg className={styles.icon} aria-hidden="true">
          <use href="/icons.svg#icon-alert" />
        </svg>
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
