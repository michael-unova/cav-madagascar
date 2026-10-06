import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
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
    status: data.status === 'published' ? 'published' : 'draft',
    createdBy: String(data.createdBy ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listPublishedLibraryBooks(): Promise<LibraryBook[]> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(query(collection(db, COLLECTION), where('status', '==', 'published')))
  return snapshot.docs.map(mapBook).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function listAdminLibraryBooks(): Promise<LibraryBook[]> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(collection(db, COLLECTION))
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
    status: 'draft',
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return refDoc.id
}

export async function updateLibraryBook(id: string, data: Partial<Omit<LibraryBook, 'id' | 'createdBy' | 'createdAt'>>): Promise<void> {
  const db = getFirebaseFirestore()
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() })
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
