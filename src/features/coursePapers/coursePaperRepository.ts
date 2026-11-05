import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import type { CoursePaper, CoursePaperGroup, CoursePaperGroupSummary, CoursePaperStatus, CoursePaperSummary } from '../../types/coursePaper'

const db = getFirebaseFirestore()
const COLLECTION = 'coursePapers'
const GROUPS = 'coursePaperGroups'

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
    groupId: String(data.groupId ?? ''),
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

function mapGroup(id: string, data: Record<string, unknown>): CoursePaperGroup {
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

/** Admin side: all papers of a concours, drafts included. */
export async function listCoursePapers(courseId: string): Promise<CoursePaper[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId)))
  return snap.docs
    .map(item => mapPaper(item.id, item.data()))
    .sort((a, b) => a.order - b.order || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
}

export async function createCoursePaper(courseId: string, groupId: string, input: CoursePaperInput, order: number, userId: string): Promise<string> {
  const clean = normalizePaperInput(input)
  const ref = await addDoc(collection(db, COLLECTION), {
    courseId,
    groupId,
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
  input: Partial<CoursePaperInput> & { html?: string; status?: CoursePaperStatus; groupId?: string },
  userId: string,
): Promise<void> {
  const { html, status, groupId, ...settings } = input
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
  if (groupId !== undefined) next.groupId = groupId
  await updateDoc(doc(db, COLLECTION, paperId), next)
}

export async function deleteCoursePaper(paperId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, paperId))
}

/** Admin side: the épreuves of a concours, drafts included. */
export async function listCoursePaperGroups(courseId: string): Promise<CoursePaperGroup[]> {
  const snap = await getDocs(query(collection(db, GROUPS), where('courseId', '==', courseId)))
  return snap.docs
    .map(item => mapGroup(item.id, item.data()))
    .sort((a, b) => a.order - b.order || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
}

export async function createCoursePaperGroup(courseId: string, title: string, order: number, userId: string): Promise<string> {
  const ref = await addDoc(collection(db, GROUPS), {
    courseId,
    title: title.trim(),
    status: 'draft' satisfies CoursePaperStatus,
    order,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCoursePaperGroup(
  groupId: string,
  input: { title?: string; status?: CoursePaperStatus },
  userId: string,
): Promise<void> {
  const next: Record<string, unknown> = { updatedBy: userId, updatedAt: serverTimestamp() }
  if (input.title !== undefined) next.title = input.title.trim()
  if (input.status) next.status = input.status
  await updateDoc(doc(db, GROUPS, groupId), next)
}

/** Deleting an épreuve deletes every Sujet type under it. Papers go first so none is orphaned. */
export async function deleteCoursePaperGroup(groupId: string): Promise<void> {
  const papers = await getDocs(query(collection(db, COLLECTION), where('groupId', '==', groupId)))
  await Promise.all(papers.docs.map(item => deleteDoc(item.ref)))
  await deleteDoc(doc(db, GROUPS, groupId))
}

/** Used when a concours is deleted: everything under it (papers and épreuves) must go too. */
export async function deleteCoursePapersForCourse(courseId: string): Promise<void> {
  const [papers, groups] = await Promise.all([
    getDocs(query(collection(db, COLLECTION), where('courseId', '==', courseId))),
    getDocs(query(collection(db, GROUPS), where('courseId', '==', courseId))),
  ])
  await Promise.all(papers.docs.map(item => deleteDoc(item.ref)))
  await Promise.all(groups.docs.map(item => deleteDoc(item.ref)))
}

/** Student side: published épreuves of a concours, each with its published Sujets types (no document content). */
export async function listStudentCoursePapers(courseId: string): Promise<CoursePaperGroupSummary[]> {
  const callable = httpsCallable<{ courseId: string }, { groups: CoursePaperGroupSummary[] }>(getFirebaseFunctions(), 'listStudentCoursePapers')
  const response = await callable({ courseId })
  return response.data.groups ?? []
}

/** Student side: the document of one published paper, checked against the student's access. */
export async function getStudentCoursePaper(courseId: string, paperId: string): Promise<{ paper: CoursePaperSummary; html: string }> {
  const callable = httpsCallable<{ courseId: string; paperId: string }, { paper: CoursePaperSummary; html: string }>(getFirebaseFunctions(), 'getStudentCoursePaper')
  const response = await callable({ courseId, paperId })
  return response.data
}
