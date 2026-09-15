import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseFirestore } from './firestore'
import { toIsoString } from './timestamps'
import type { Course } from '../../types'

export const COURSES_COLLECTION = 'courses'

/**
 * Firestore caps `in` filters at 30 values. Requests are chunked well below
 * that ceiling so the limit never becomes a surprise as classes grow.
 */
const IN_QUERY_CHUNK_SIZE = 10

function toCourse(snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Course {
  const data = snapshot.data() ?? {}
  const createdAt = toIsoString(data.createdAt)

  return {
    id: snapshot.id,
    classId: data.classId ?? '',
    teacherId: data.teacherId ?? '',
    title: data.title ?? '',
    description: data.description ?? '',
    createdAt,
    updatedAt: toIsoString(data.updatedAt, createdAt),
  }
}

export interface CreateCourseInput {
  classId: string
  teacherId: string
  title: string
  description: string
}

export async function createCourse({ classId, teacherId, title, description }: CreateCourseInput): Promise<string> {
  const firestore = getFirebaseFirestore()
  const reference = doc(collection(firestore, COURSES_COLLECTION))

  await setDoc(reference, {
    id: reference.id,
    classId,
    teacherId,
    title,
    description,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return reference.id
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, COURSES_COLLECTION, courseId))

  return snapshot.exists() ? toCourse(snapshot) : null
}

/** Lists the courses of a single class, ordered in memory (see `classes.ts`). */
export async function listCoursesByClass(classId: string): Promise<Course[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, COURSES_COLLECTION), where('classId', '==', classId)),
  )

  return sortByNewest(snapshot.docs.map(toCourse))
}

/** Lists every course owned by one teacher, across all of their classes. */
export async function listCoursesByTeacher(teacherId: string): Promise<Course[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, COURSES_COLLECTION), where('teacherId', '==', teacherId)),
  )

  return sortByNewest(snapshot.docs.map(toCourse))
}

/** Lists the courses of several classes, used for a student's course list. */
export async function listCoursesByClassIds(classIds: string[]): Promise<Course[]> {
  if (classIds.length === 0) {
    return []
  }

  const firestore = getFirebaseFirestore()
  const chunks: string[][] = []
  for (let index = 0; index < classIds.length; index += IN_QUERY_CHUNK_SIZE) {
    chunks.push(classIds.slice(index, index + IN_QUERY_CHUNK_SIZE))
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(firestore, COURSES_COLLECTION), where('classId', 'in', chunk))),
    ),
  )

  return sortByNewest(snapshots.flatMap((snapshot) => snapshot.docs.map(toCourse)))
}

/** Lists every course on the platform. Only administrators may do this. */
export async function listAllCourses(): Promise<Course[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(collection(firestore, COURSES_COLLECTION))

  return sortByNewest(snapshot.docs.map(toCourse))
}

export interface UpdateCourseInput {
  title: string
  description: string
}

export async function updateCourse(courseId: string, { title, description }: UpdateCourseInput): Promise<void> {
  const firestore = getFirebaseFirestore()
  await updateDoc(doc(firestore, COURSES_COLLECTION, courseId), {
    title,
    description,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCourse(courseId: string): Promise<void> {
  const firestore = getFirebaseFirestore()
  await deleteDoc(doc(firestore, COURSES_COLLECTION, courseId))
}

function sortByNewest(courses: Course[]): Course[] {
  return courses.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}
