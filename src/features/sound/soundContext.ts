import { createContext, useContext } from 'react'

export type NotificationSoundValue = {
  /** Sound preference of the signed-in account. */
  enabled: boolean
  /** Short French confirmation shown after an action, or null. */
  message: string | null
  toggle: () => void
  test: () => void
}

export const NotificationSoundContext = createContext<NotificationSoundValue | null>(null)

export function useNotificationSound(): NotificationSoundValue {
  const value = useContext(NotificationSoundContext)
  if (!value) throw new Error('useNotificationSound must be used inside NotificationSoundProvider')
  return value
}
