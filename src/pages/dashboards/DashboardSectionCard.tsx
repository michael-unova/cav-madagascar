import type { ReactNode } from 'react'
import { Card } from '../../components/Card/Card'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import styles from './DashboardSectionCard.module.css'

export interface DashboardSectionCardProps {
  title: string
  icon: string
  emptyTitle: string
  emptyDescription: string
  /**
   * Real content for this section. When it is omitted, the card falls back
   * to its empty state, which is how sections whose data arrives in a
   * later milestone are still rendered honestly.
   */
  children?: ReactNode
  isLoading?: boolean
  errorMessage?: string | null
  /** Optional footer link, for example towards the full list. */
  action?: ReactNode
}

export function DashboardSectionCard({
  title,
  icon,
  emptyTitle,
  emptyDescription,
  children,
  isLoading = false,
  errorMessage = null,
  action,
}: DashboardSectionCardProps) {
  const hasContent = children !== undefined && children !== null && children !== false

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>{title}</h2>

      {isLoading ? (
        <LoadingState label="Chargement" />
      ) : errorMessage ? (
        <ErrorState title="Chargement impossible" description={errorMessage} />
      ) : hasContent ? (
        <>
          {children}
          {action && <div className={styles.action}>{action}</div>}
        </>
      ) : (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      )}
    </Card>
  )
}
