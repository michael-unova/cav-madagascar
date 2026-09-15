import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import styles from './Badge.module.css'

type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'danger'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={cn(styles.badge, styles[tone])}>{children}</span>
}
