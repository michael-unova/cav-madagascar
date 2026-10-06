import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { Bookmark, UserNote } from '../../types/progress'

const db = getFirebaseFirestore()

function toDate(value: unknown): Date | undefined {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : undefined
}

export async function listMyBookmarks(userId: string): Promise<Bookmark[]> {
  const snap = await getDocs(query(collection(db, 'bookmarks'), where('userId', '==', userId)))
  return snap.docs.map(d => ({
    id: d.id,
    userId: String(d.data().userId ?? ''),
    courseId: String(d.data().courseId ?? ''),
    nodeId: typeof d.data().nodeId === 'string' ? d.data().nodeId : undefined,
    blockId: typeof d.data().blockId === 'string' ? d.data().blockId : undefined,
    createdAt: toDate(d.data().createdAt),
  }))
}

export async function createBookmark(input: { userId: string; courseId: string; nodeId?: string; blockId?: string }) {
  return addDoc(collection(db, 'bookmarks'), { ...input, createdAt: serverTimestamp() })
}

export async function deleteBookmark(id: string) {
  await deleteDoc(doc(db, 'bookmarks', id))
}

export async function listMyNotes(userId: string, courseId: string): Promise<UserNote[]> {
  const snap = await getDocs(query(collection(db, 'notes'), where('userId', '==', userId), where('courseId', '==', courseId)))
  return snap.docs.map(d => ({
    id: d.id,
    userId: String(d.data().userId ?? ''),
    courseId: String(d.data().courseId ?? ''),
    nodeId: typeof d.data().nodeId === 'string' ? d.data().nodeId : undefined,
    blockId: typeof d.data().blockId === 'string' ? d.data().blockId : undefined,
    content: String(d.data().content ?? ''),
    updatedAt: toDate(d.data().updatedAt),
  }))
}

export async function saveNote(input: { id?: string; userId: string; courseId: string; nodeId?: string; blockId?: string; content: string }) {
  if (input.id) {
    await updateDoc(doc(db, 'notes', input.id), { content: input.content, updatedAt: serverTimestamp() })
    return input.id
  }
  const ref = await addDoc(collection(db, 'notes'), {
    userId: input.userId,
    courseId: input.courseId,
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    ...(input.blockId ? { blockId: input.blockId } : {}),
    content: input.content,
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteNote(id: string) {
  await deleteDoc(doc(db, 'notes', id))
}
