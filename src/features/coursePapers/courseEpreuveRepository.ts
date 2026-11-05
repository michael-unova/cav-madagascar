import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import type { CourseEpreuve, CourseEpreuveSummary, CoursePaperStatus } from '../../types/coursePaper'

const db = getFirebaseFirestore()
const COLLECTION = 'courseEpreuves'

function dateOf(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) return (value as { toDate: () => Date }).toDate()
  return value instanceof Date ? value : undefined
}

function mapEpreuve(id: string, data: Record<string, unknown>): CourseEpreuve {
  return {
    id,
    courseId: String(data.courseId ?? ''),
    title: String(data.title ?? ''),
    status: data.status === 'published' ? 'published' : 'draft',
    order: Number(data.order ?? 0),
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: dateOf(data.createdAt),
    updatedAt: dateOf(data.updatedAt),
  }
}

/**
 * Admin side: moves papers written before épreuves existed into a default épreuve.
 * Safe to call every time: it does nothing when there is nothing to move.
 */
export async function ensureCoursePaperEpreuves(courseId: string): Promise<void> {
  const callable = httpsCallable<{ courseId: string }, { ok: boolean }>(getFirebaseFunctions(), 'ensureCoursePaperEpreuves')
  await callable({ courseId })
}

/** Admin side: all épreuves of a concours, drafts included. */
export async function listCourseEpreuves(courseId: string): Promise<CourseEpreuve[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId)))
  return snap.docs
    .map(item => mapEpreuve(item.id, item.data()))
    .sort((a, b) => a.order - b.order || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
}

export async function createCourseEpreuve(courseId: string, title: string, order: number, userId: string): Promise<string> {
  const clean = title.trim()
  if (!clean) throw new Error('Le nom de l’épreuve est obligatoire.')
  const ref = await addDoc(collection(db, COLLECTION), {
    courseId,
    title: clean,
    status: 'draft' satisfies CoursePaperStatus,
    order,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCourseEpreuve(
  epreuveId: string,
  input: { title?: string; status?: CoursePaperStatus },
  userId: string,
): Promise<void> {
  const next: Record<string, unknown> = { updatedBy: userId, updatedAt: serverTimestamp() }
  if (input.title !== undefined) {
    const clean = input.title.trim()
    if (!clean) throw new Error('Le nom de l’épreuve est obligatoire.')
    next.title = clean
  }
  if (input.status) next.status = input.status
  await updateDoc(doc(db, COLLECTION, epreuveId), next)
}

/** Deletes an épreuve together with the Sujets types it holds. */
export async function deleteCourseEpreuve(epreuveId: string): Promise<void> {
  const papers = await getDocs(query(collection(db, 'coursePapers'), where('epreuveId', '==', epreuveId)))
  for (let index = 0; index < papers.docs.length; index += 400) {
    const batch = writeBatch(db)
    papers.docs.slice(index, index + 400).forEach(item => batch.delete(item.ref))
    await batch.commit()
  }
  await deleteDoc(doc(db, COLLECTION, epreuveId))
}

/** Used when a concours is deleted: its épreuves must not outlive it (its papers are removed separately). */
export async function deleteCourseEpreuvesForCourse(courseId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId)))
  await Promise.all(snap.docs.map(item => deleteDoc(item.ref)))
}

/** Student side: the épreuves of a concours that hold at least one published Sujet type. */
export async function listStudentCourseEpreuves(courseId: string): Promise<CourseEpreuveSummary[]> {
  const callable = httpsCallable<{ courseId: string }, { epreuves: CourseEpreuveSummary[] }>(getFirebaseFunctions(), 'listStudentCourseEpreuves')
  const response = await callable({ courseId })
  return response.data.epreuves
}
