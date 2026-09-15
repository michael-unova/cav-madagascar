import { cn } from '../../utils/cn'
import styles from './Avatar.module.css'

export interface AvatarProps {
  name: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase())
  return initials.join('') || '?'
}

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size])} role="img" aria-label={name}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className={styles.image} />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  )
}
