import { cn } from '../../utils/cn'
import styles from './Logo.module.css'

export interface LogoProps {
  size?: 'sm' | 'md'
}

export function Logo({ size = 'md' }: LogoProps) {
  return (
    <span className={cn(styles.logo, styles[size])}>
      <svg viewBox="0 0 24 24" className={styles.mark} aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="var(--color-primary)" />
        <path
          d="M12 8.4C11 7.4 9.4 6.9 8 7.1v9.8c1.4-.2 3 .3 4 1.3M12 8.4c1-1 2.6-1.5 4-1.3v9.8c-1.4-.2-3 .3-4 1.3"
          stroke="#F4EFE4"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className={styles.word}>
        Nova <span className={styles.wordAccent}>Études</span>
      </span>
    </span>
  )
}
