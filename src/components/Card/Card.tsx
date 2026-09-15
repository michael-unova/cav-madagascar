import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import styles from './Card.module.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'md' | 'lg'
}

export function Card({ children, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div className={cn(styles.card, padding === 'lg' && styles.paddingLg, className)} {...rest}>
      {children}
    </div>
  )
}
