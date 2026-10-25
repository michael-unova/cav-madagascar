import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { LessonComment, LessonCommentAuthorRole } from '../../types/lessonComment'

const COLLECTION = 'lessonComments'
const NOTIFICATIONS = 'notifications'
const db = getFirebaseFirestore()

function mapComment(id: string, data: Record<string, unknown>): LessonComment {
  return {
    id,
    userId: String(data.userId ?? ''),
    studentName: String(data.studentName ?? 'Étudiant'),
    authorPhotoURL: typeof data.authorPhotoURL === 'string' ? data.authorPhotoURL : null,
    authorRole: data.authorRole === 'manager' ? 'manager' : 'student',
    category: data.category === 'technical' ? 'technical' : 'course',
    parentCommentId: typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    courseId: String(data.courseId ?? ''),
    courseTitle: String(data.courseTitle ?? ''),
    subjectId: String(data.subjectId ?? ''),
    subjectTitle: String(data.subjectTitle ?? ''),
    topicId: typeof data.topicId === 'string' ? data.topicId : undefined,
    topicTitle: typeof data.topicTitle === 'string' ? data.topicTitle : undefined,
    lessonId: String(data.lessonId ?? ''),
    lessonTitle: String(data.lessonTitle ?? ''),
    content: String(data.content ?? ''),
    createdAt: (data.createdAt as LessonComment['createdAt']) ?? null,
    updatedAt: (data.updatedAt as LessonComment['updatedAt']) ?? null,
    unreadForAdmin: data.unreadForAdmin === true,
    adminReply: typeof data.adminReply === 'string' ? data.adminReply : undefined,
    adminReplyBy: typeof data.adminReplyBy === 'string' ? data.adminReplyBy : undefined,
    adminReplyAt: (data.adminReplyAt as LessonComment['adminReplyAt']) ?? null,
    seenBy: mapSeenBy(data.seenBy),
    treated: data.treated === true,
    treatedById: typeof data.treatedById === 'string' ? data.treatedById : null,
    treatedByName: typeof data.treatedByName === 'string' ? data.treatedByName : null,
    treatedAt: (data.treatedAt as LessonComment['treatedAt']) ?? null,
  }
}

function mapSeenBy(value: unknown): LessonComment['seenBy'] {
  if (!value || typeof value !== 'object') return {}
  const result: NonNullable<LessonComment['seenBy']> = {}
  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    result[uid] = { name: String(record.name ?? 'Administrateur'), at: (record.at as NonNullable<LessonComment['seenBy']>[string]['at']) ?? null }
  }
  return result
}

function sortNewest(items: LessonComment[]) {
  return [...items].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export function subscribeLessonComments(lessonId: string, courseId: string, onChange: (items: LessonComment[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('lessonId', '==', lessonId), where('courseId', '==', courseId))
  return onSnapshot(q, snapshot => onChange(sortNewest(snapshot.docs.map(item => mapComment(item.id, item.data())))), error => onError?.(error))
}


export function subscribeLessonCommentLoves(commentId: string, userId: string, onChange: (state: { count: number; loved: boolean }) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION, commentId, 'loves'))
  return onSnapshot(q, snapshot => {
    onChange({ count: snapshot.size, loved: Boolean(userId && snapshot.docs.some(item => item.id === userId)) })
  }, error => onError?.(error))
}

export async function toggleLessonCommentLove(commentId: string, userId: string, loved: boolean) {
  if (!userId) return
  const loveRef = doc(db, COLLECTION, commentId, 'loves', userId)
  if (loved) await deleteDoc(loveRef)
  else await setDoc(loveRef, { userId, createdAt: serverTimestamp() })
}

export const subscribeMyLessonComments = (lessonId: string, _userId: string, onChange: (items: LessonComment[]) => void, onError?: (error: Error) => void) => subscribeLessonComments(lessonId, '', onChange, onError)

export function subscribeAdminLessonComments(onChange: (items: LessonComment[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, COLLECTION), snapshot => onChange(sortNewest(snapshot.docs.map(item => mapComment(item.id, item.data())))), error => onError?.(error))
}

export function subscribeUnreadLessonCommentCount(onChange: (count: number) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('unreadForAdmin', '==', true), where('authorRole', '==', 'student'))
  return onSnapshot(q, snapshot => onChange(snapshot.size), error => onError?.(error))
}

export async function createLessonComment(input: Omit<LessonComment, 'id' | 'createdAt' | 'updatedAt' | 'unreadForAdmin' | 'adminReply' | 'adminReplyBy' | 'adminReplyAt'>) {
  return addDoc(collection(db, COLLECTION), {
    ...input,
    authorRole: input.authorRole ?? 'student',
    category: input.category === 'technical' ? 'technical' : 'course',
    parentCommentId: input.parentCommentId ?? null,
    content: input.content.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadForAdmin: input.authorRole === 'manager' ? false : true,
    adminReply: null,
    adminReplyBy: null,
    adminReplyAt: null,
  })
}

export async function updateLessonComment(commentId: string, content: string, authorRole: LessonCommentAuthorRole = 'student') {
  // A student edit goes back to the admin inbox; an edit of an admin reply never does.
  await updateDoc(doc(db, COLLECTION, commentId), { content: content.trim(), updatedAt: serverTimestamp(), unreadForAdmin: authorRole === 'student' })
}

export async function deleteLessonComment(commentId: string) {
  await deleteDoc(doc(db, COLLECTION, commentId))
}

/** Collects a comment and all of its descendants (replies, replies to replies). */
export function collectCommentThreadIds(rootId: string, all: LessonComment[]): string[] {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const item of all) {
      if (item.parentCommentId && ids.has(item.parentCommentId) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return Array.from(ids)
}

/** Moderation delete: removes a comment together with every reply under it, so no orphan replies remain. */
export async function deleteLessonCommentThread(commentIds: string[]) {
  const ids = Array.from(new Set(commentIds.filter(Boolean)))
  for (let start = 0; start < ids.length; start += 400) {
    const batch = writeBatch(db)
    ids.slice(start, start + 400).forEach(id => batch.delete(doc(db, COLLECTION, id)))
    await batch.commit()
  }
}

/** Records, once per admin, that this question was opened. Other admins see it right away. */
export async function markQuestionSeen(commentId: string, userId: string, name: string) {
  if (!userId) return
  await updateDoc(doc(db, COLLECTION, commentId), { [`seenBy.${userId}`]: { name: name.trim().slice(0, 160) || 'Administrateur', at: serverTimestamp() } })
}

/** Marks a question as treated (resolved) or reopens it. */
export async function setQuestionTreated(commentId: string, treated: boolean, userId: string, name: string) {
  await updateDoc(doc(db, COLLECTION, commentId), treated
    ? { treated: true, treatedById: userId, treatedByName: name.trim().slice(0, 160) || 'Administrateur', treatedAt: serverTimestamp() }
    : { treated: false, treatedById: null, treatedByName: null, treatedAt: null })
}

export async function markLessonCommentRead(commentId: string) {
  await updateDoc(doc(db, COLLECTION, commentId), { unreadForAdmin: false, updatedAt: serverTimestamp() })
}

export async function markLessonCommentsRead(commentIds: string[]) {
  const ids = Array.from(new Set(commentIds.filter(Boolean)))
  await Promise.all(ids.map(commentId => markLessonCommentRead(commentId)))
}

export async function replyToLessonComment(input: {
  parent: LessonComment
  content: string
  userId: string
  authorName: string
  authorPhotoURL?: string | null
  authorRole: LessonCommentAuthorRole
}) {
  return createLessonComment({
    userId: input.userId,
    studentName: input.authorName,
    authorPhotoURL: input.authorPhotoURL ?? null,
    authorRole: input.authorRole,
    category: input.parent.category ?? 'course',
    parentCommentId: input.parent.id,
    courseId: input.parent.courseId,
    courseTitle: input.parent.courseTitle,
    subjectId: input.parent.subjectId,
    subjectTitle: input.parent.subjectTitle,
    topicId: input.parent.topicId ?? null,
    topicTitle: input.parent.topicTitle ?? null,
    lessonId: input.parent.lessonId,
    lessonTitle: input.parent.lessonTitle,
    content: input.content.trim(),
  })
}

export interface LessonNotification {
  id: string
  userId: string
  type: string
  message: string
  actorUserId?: string
  actorName?: string
  lessonId?: string
  courseId?: string
  commentId?: string
  broadcastId?: string
  senderName?: string
  title?: string
  category?: string
  read: boolean
  createdAt?: import('firebase/firestore').Timestamp | null
}

function mapNotification(id: string, data: Record<string, unknown>): LessonNotification {
  return { id, userId: String(data.userId ?? ''), type: String(data.type ?? 'comment'), message: String(data.message ?? ''), actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : undefined, actorName: typeof data.actorName === 'string' ? data.actorName : undefined, lessonId: typeof data.lessonId === 'string' ? data.lessonId : undefined, courseId: typeof data.courseId === 'string' ? data.courseId : undefined, commentId: typeof data.commentId === 'string' ? data.commentId : undefined, broadcastId: typeof data.broadcastId === 'string' ? data.broadcastId : undefined, senderName: typeof data.senderName === 'string' ? data.senderName : undefined, title: typeof data.title === 'string' ? data.title : undefined, category: typeof data.category === 'string' ? data.category : undefined, read: data.read === true, createdAt: (data.createdAt as LessonNotification['createdAt']) ?? null }
}

export function subscribeMyNotifications(userId: string, onChange: (items: LessonNotification[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, NOTIFICATIONS), where('userId', '==', userId), where('read', '==', false))
  return onSnapshot(q, snapshot => onChange(snapshot.docs.map(item => mapNotification(item.id, item.data())).sort((a,b)=>(b.createdAt?.toMillis?.() ?? 0)-(a.createdAt?.toMillis?.() ?? 0))), error => onError?.(error))
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, NOTIFICATIONS, notificationId), { read: true, readAt: serverTimestamp() })
}
