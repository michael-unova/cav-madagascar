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
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseFirestore } from './firestore'
import { toIsoString } from './timestamps'
import type { Lesson } from '../../types'

export const LESSONS_COLLECTION = 'lessons'

function toLesson(snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Lesson {
  const data = snapshot.data() ?? {}
  const createdAt = toIsoString(data.createdAt)

  return {
    id: snapshot.id,
    courseId: data.courseId ?? '',
    classId: data.classId ?? '',
    teacherId: data.teacherId ?? '',
    title: data.title ?? '',
    description: data.description ?? '',
    order: typeof data.order === 'number' ? data.order : 0,
    videoPath: data.videoPath ?? null,
    videoName: data.videoName ?? null,
    videoSizeBytes: typeof data.videoSizeBytes === 'number' ? data.videoSizeBytes : null,
    createdAt,
    updatedAt: toIsoString(data.updatedAt, createdAt),
  }
}

export interface CreateLessonInput {
  courseId: string
  classId: string
  teacherId: string
  title: string
  description: string
}

/**
 * Creates a lesson with no video yet (the upload happens afterward, from
 * the lesson's own page). `order` is assigned automatically as one past the
 * highest existing order in the course, so a teacher never has to think
 * about numbering; reordering afterward is done with `swapLessonOrder`.
 */
export async function createLesson({
  courseId,
  classId,
  teacherId,
  title,
  description,
}: CreateLessonInput): Promise<string> {
  const firestore = getFirebaseFirestore()
  const existing = await listLessonsByCourse(courseId)
  const nextOrder = existing.reduce((max, lesson) => Math.max(max, lesson.order + 1), 0)

  const reference = doc(collection(firestore, LESSONS_COLLECTION))

  await setDoc(reference, {
    id: reference.id,
    courseId,
    classId,
    teacherId,
    title,
    description,
    order: nextOrder,
    videoPath: null,
    videoName: null,
    videoSizeBytes: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return reference.id
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, LESSONS_COLLECTION, lessonId))

  return snapshot.exists() ? toLesson(snapshot) : null
}

/** Lists the lessons of one course, ordered by their `order` field. */
export async function listLessonsByCourse(courseId: string): Promise<Lesson[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, LESSONS_COLLECTION), where('courseId', '==', courseId)),
  )

  return snapshot.docs.map(toLesson).sort((first, second) => first.order - second.order)
}

export interface UpdateLessonMetaInput {
  title: string
  description: string
}

/** Updates title/description only; ordering and video fields are untouched. */
export async function updateLessonMeta(lessonId: string, { title, description }: UpdateLessonMetaInput): Promise<void> {
  const firestore = getFirebaseFirestore()
  await updateDoc(doc(firestore, LESSONS_COLLECTION, lessonId), {
    title,
    description,
    updatedAt: serverTimestamp(),
  })
}

export interface LessonVideoInfo {
  path: string
  name: string
  sizeBytes: number
}

/**
 * Sets or clears the video fields on a lesson. Called after a Storage
 * upload succeeds (with the new file's info) or after a video is removed
 * (with `null`). The Storage object itself is managed separately by the
 * caller: this function only updates the Firestore pointer to it.
 */
export async function updateLessonVideo(lessonId: string, video: LessonVideoInfo | null): Promise<void> {
  const firestore = getFirebaseFirestore()
  await updateDoc(doc(firestore, LESSONS_COLLECTION, lessonId), {
    videoPath: video?.path ?? null,
    videoName: video?.name ?? null,
    videoSizeBytes: video?.sizeBytes ?? null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Swaps the `order` field of two lessons in the same course, used by the
 * "move up" / "move down" controls. A batch keeps the swap atomic, so a
 * failed write never leaves two lessons sharing (or skipping) a position.
 */
export async function swapLessonOrder(first: Lesson, second: Lesson): Promise<void> {
  const firestore = getFirebaseFirestore()
  const batch = writeBatch(firestore)

  batch.update(doc(firestore, LESSONS_COLLECTION, first.id), {
    order: second.order,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(firestore, LESSONS_COLLECTION, second.id), {
    order: first.order,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

/** Deletes a lesson's Firestore document only; see `deleteLessonWithContent` in lessonStorage.ts for the full cascade including Storage files and the materials subcollection. */
export async function deleteLessonDocument(lessonId: string): Promise<void> {
  const firestore = getFirebaseFirestore()
  await deleteDoc(doc(firestore, LESSONS_COLLECTION, lessonId))
}
