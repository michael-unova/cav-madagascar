import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  getDocs,
  type Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { ContactMessage } from '../../types/contact'

const COLLECTION = 'contactMessages'

function toMessage(id: string, data: Record<string, unknown>): ContactMessage {
  return {
    id,
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    subject: typeof data.subject === 'string' ? data.subject : '',
    message: typeof data.message === 'string' ? data.message : '',
    status: data.status === 'read' ? 'read' : 'unread',
    createdAt: (data.createdAt as Timestamp | null | undefined) ?? null,
    readAt: (data.readAt as Timestamp | null | undefined) ?? null,
  }
}

export async function createContactMessage(input: Omit<ContactMessage, 'id' | 'status' | 'createdAt' | 'readAt'>) {
  const db = getFirebaseFirestore()
  await addDoc(collection(db, COLLECTION), {
    ...input,
    status: 'unread',
    createdAt: serverTimestamp(),
    readAt: null,
  })
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const db = getFirebaseFirestore()
  const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')))
  return snapshot.docs.map(item => toMessage(item.id, item.data()))
}

export async function markContactMessageRead(id: string) {
  const db = getFirebaseFirestore()
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'read',
    readAt: serverTimestamp(),
  })
}

export async function markContactMessageUnread(id: string) {
  const db = getFirebaseFirestore()
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'unread',
    readAt: null,
  })
}

export async function deleteContactMessage(id: string) {
  const db = getFirebaseFirestore()
  await deleteDoc(doc(db, COLLECTION, id))
}
