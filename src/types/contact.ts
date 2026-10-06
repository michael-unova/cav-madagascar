import type { Timestamp } from 'firebase/firestore'

export type ContactStatus = 'unread' | 'read'

export interface ContactMessage {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  subject: string
  message: string
  status: ContactStatus
  createdAt: Timestamp | null
  readAt: Timestamp | null
}
