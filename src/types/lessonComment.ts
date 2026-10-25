import type { Timestamp } from 'firebase/firestore'

export type LessonCommentAuthorRole = 'student' | 'manager'

export interface LessonComment {
  id: string
  userId: string
  studentName: string
  authorPhotoURL?: string | null
  authorRole: LessonCommentAuthorRole
  parentCommentId?: string | null
  courseId: string
  courseTitle: string
  subjectId: string
  subjectTitle: string
  topicId?: string | null
  topicTitle?: string | null
  lessonId: string
  lessonTitle: string
  content: string
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
  unreadForAdmin: boolean
  adminReply?: string
  adminReplyBy?: string
  adminReplyAt?: Timestamp | null
  /** Admins and content managers who opened this question, keyed by user id. */
  seenBy?: Record<string, { name: string; at?: Timestamp | null }>
  treated?: boolean
  treatedById?: string | null
  treatedByName?: string | null
  treatedAt?: Timestamp | null
}
