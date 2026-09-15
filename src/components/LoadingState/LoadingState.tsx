import styles from './LoadingState.module.css'

export interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = 'Chargement en cours' }: LoadingStateProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  )
}
