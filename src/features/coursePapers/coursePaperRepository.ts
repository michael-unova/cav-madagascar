import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import type { CoursePaper, CoursePaperStatus, CoursePaperSummary } from '../../types/coursePaper'

const db = getFirebaseFirestore()
const COLLECTION = 'coursePapers'

function dateOf(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) return (value as { toDate: () => Date }).toDate()
  return value instanceof Date ? value : undefined
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapPaper(id: string, data: Record<string, unknown>): CoursePaper {
  return {
    id,
    courseId: String(data.courseId ?? ''),
    epreuveId: String(data.epreuveId ?? ''),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    timeLimitMinutes: numberOrNull(data.timeLimitMinutes),
    passMark: numberOrNull(data.passMark),
    status: data.status === 'published' ? 'published' : 'draft',
    order: Number(data.order ?? 0),
    html: String(data.html ?? ''),
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: dateOf(data.createdAt),
    updatedAt: dateOf(data.updatedAt),
  }
}

export interface CoursePaperInput {
  title: string
  description: string
  timeLimitMinutes: number | null
  passMark: number | null
}

/** Keeps values inside the ranges the UI promises, whatever the form sent. */
export function normalizePaperInput(input: CoursePaperInput): CoursePaperInput {
  const minutes = input.timeLimitMinutes
  const mark = input.passMark
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    timeLimitMinutes: minutes !== null && Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.round(minutes), 24 * 60) : null,
    passMark: mark !== null && Number.isFinite(mark) && mark >= 0 ? Math.min(Math.round(mark), 100) : null,
  }
}

/** Admin side: all papers of a concours (or of one épreuve of it), drafts included. */
export async function listCoursePapers(courseId: string, epreuveId?: string): Promise<CoursePaper[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId)))
  return snap.docs
    .map(item => mapPaper(item.id, item.data()))
    .filter(paper => epreuveId === undefined || paper.epreuveId === epreuveId)
    .sort((a, b) => a.order - b.order || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
}

export async function createCoursePaper(courseId: string, epreuveId: string, input: CoursePaperInput, order: number, userId: string): Promise<string> {
  const clean = normalizePaperInput(input)
  const ref = await addDoc(collection(db, COLLECTION), {
    courseId,
    epreuveId,
    ...clean,
    status: 'draft' satisfies CoursePaperStatus,
    order,
    html: '',
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCoursePaper(
  paperId: string,
  input: Partial<CoursePaperInput> & { html?: string; status?: CoursePaperStatus },
  userId: string,
): Promise<void> {
  const { html, status, ...settings } = input
  const next: Record<string, unknown> = { updatedBy: userId, updatedAt: serverTimestamp() }
  if (Object.keys(settings).length) {
    const clean = normalizePaperInput({
      title: settings.title ?? '',
      description: settings.description ?? '',
      timeLimitMinutes: settings.timeLimitMinutes ?? null,
      passMark: settings.passMark ?? null,
    })
    Object.assign(next, clean)
  }
  if (html !== undefined) next.html = html
  if (status) next.status = status
  await updateDoc(doc(db, COLLECTION, paperId), next)
}

export async function deleteCoursePaper(paperId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, paperId))
}

/** Used when a concours is deleted: its papers must not outlive it. */
export async function deleteCoursePapersForCourse(courseId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId)))
  await Promise.all(snap.docs.map(item => deleteDoc(item.ref)))
}

/** Student side: published papers of one épreuve of a concours (no document content). */
export async function listStudentCoursePapers(courseId: string, epreuveId: string): Promise<CoursePaperSummary[]> {
  const callable = httpsCallable<{ courseId: string; epreuveId: string }, { papers: CoursePaperSummary[] }>(getFirebaseFunctions(), 'listStudentCoursePapers')
  const response = await callable({ courseId, epreuveId })
  return response.data.papers
}

/** Student side: the document of one published paper, checked against the student's access. */
export async function getStudentCoursePaper(courseId: string, paperId: string): Promise<{ paper: CoursePaperSummary; html: string }> {
  const callable = httpsCallable<{ courseId: string; paperId: string }, { paper: CoursePaperSummary; html: string }>(getFirebaseFunctions(), 'getStudentCoursePaper')
  const response = await callable({ courseId, paperId })
  return response.data
}
