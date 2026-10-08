import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, deleteField } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseStorage } from '../../lib/firebase/storage'
import type { CreateLibraryBookInput, LibraryBook } from '../../types/library'

const COLLECTION = 'libraryBooks'

function mapBook(snapshot: { id: string; data: () => Record<string, unknown> }): LibraryBook {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    title: String(data.title ?? ''),
    author: String(data.author ?? ''),
    description: String(data.description ?? ''),
    category: String(data.category ?? 'Général'),
    type: data.type === 'link' ? 'link' : 'pdf',
    coverUrl: String(data.coverUrl ?? ''),
    resourceUrl: String(data.resourceUrl ?? ''),
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
    visibility: data.visibility === 'enrolled' ? 'enrolled' : 'public',
    courseIds: Array.isArray(data.courseIds) ? data.courseIds.map(String).filter(Boolean) : (typeof data.courseId === 'string' ? [data.courseId] : []),
    courseId: typeof data.courseId === 'string' ? data.courseId : undefined,
    status: data.status === 'published' ? 'published' : 'draft',
    createdBy: String(data.createdBy ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listPublishedLibraryBooks(userId: string): Promise<LibraryBook[]> {
  const db = getFirebaseFirestore()
  const books = new Map<string, LibraryBook>()

  // Public resources can be queried directly. Restricted resources are queried
  // one concours at a time so Firestore rules can prove the student's access
  // to that specific concours.
  const publicSnapshot = await getDocs(query(
    collection(db, COLLECTION),
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
  ))
  publicSnapshot.docs.forEach(docSnap => books.set(docSnap.id, mapBook(docSnap)))

  const enrollmentSnapshot = await getDocs(query(
    collection(db, 'enrollments'),
    where('userId', '==', userId),
  ))
  const activeCourseIds = Array.from(new Set(enrollmentSnapshot.docs
    .filter(docSnap => {
      const data = docSnap.data()
      if (data.status !== 'active') return false
      const expiresAt = data.expiresAt
      return !expiresAt || typeof expiresAt.toDate !== 'function' || expiresAt.toDate() > new Date()
    })
    .map(docSnap => String(docSnap.data().courseId ?? ''))
    .filter(Boolean)))

  // Query one selected concours at a time. This keeps each Firestore query
  // aligned with the access rule and still lets one book be visible for many
  // concours without duplicating the resource.
  await Promise.all(activeCourseIds.map(async courseId => {
    const snapshot = await getDocs(query(
      collection(db, COLLECTION),
      where('status', '==', 'published'),
      where('visibility', '==', 'enrolled'),
      where('courseIds', 'array-contains', courseId),
    ))
    snapshot.docs.forEach(docSnap => books.set(docSnap.id, mapBook(docSnap)))
  }))

  return Array.from(books.values()).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function listAdminLibraryBooks(): Promise<LibraryBook[]> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(collection(db, COLLECTION))
  // Books created before access control existed are treated as public and
  // normalized once an administrator opens the library. This keeps existing
  // resources visible after the new visibility rules are deployed.
  const legacyBooks = snapshot.docs.filter(item => !('visibility' in item.data()))
  if (legacyBooks.length) {
    await Promise.all(legacyBooks.map(item => updateDoc(item.ref, { visibility: 'public', updatedAt: serverTimestamp() })))
  }
  return snapshot.docs.map(mapBook).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function createLibraryBook(input: CreateLibraryBookInput): Promise<string> {
  const db = getFirebaseFirestore()
  const refDoc = await addDoc(collection(db, COLLECTION), {
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description.trim(),
    category: input.category.trim() || 'Général',
    type: input.type,
    coverUrl: input.coverUrl.trim(),
    resourceUrl: input.resourceUrl.trim(),
    keywords: input.keywords.map(value => value.trim()).filter(Boolean).slice(0, 20),
    visibility: input.visibility,
    ...(input.visibility === 'enrolled' ? { courseIds: input.courseIds ?? (input.courseId ? [input.courseId] : []) } : {}),
    status: 'draft',
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return refDoc.id
}

export async function updateLibraryBook(id: string, data: Partial<Omit<LibraryBook, 'id' | 'createdBy' | 'createdAt'>>): Promise<void> {
  const db = getFirebaseFirestore()
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() }
  if (data.visibility === 'public') { payload.courseId = deleteField(); payload.courseIds = deleteField() }
  await updateDoc(doc(db, COLLECTION, id), payload)
}

export async function deleteLibraryBook(book: LibraryBook): Promise<void> {
  const db = getFirebaseFirestore()
  await deleteDoc(doc(db, COLLECTION, book.id))
  const storage = getFirebaseStorage()
  const paths = [`library/${book.id}/resource`, `library/${book.id}/cover`]
  await Promise.all(paths.map(async path => {
    try { await deleteObject(ref(storage, path)) } catch { /* file may not exist */ }
  }))
}
