import { Card } from '../../components/Card/Card'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import styles from './DashboardSectionCard.module.css'

export interface DashboardSectionCardProps {
  title: string
  icon: string
  emptyTitle: string
  emptyDescription: string
}

export function DashboardSectionCard({
  title,
  icon,
  emptyTitle,
  emptyDescription,
}: DashboardSectionCardProps) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </Card>
  )
}
