import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseFirestore } from './firestore'
import { toIsoString } from './timestamps'
import { LESSONS_COLLECTION } from './lessons'
import type { LessonMaterial } from '../../types'

export const LESSON_MATERIALS_SUBCOLLECTION = 'materials'

function materialsCollection(lessonId: string) {
  return collection(getFirebaseFirestore(), LESSONS_COLLECTION, lessonId, LESSON_MATERIALS_SUBCOLLECTION)
}

function toLessonMaterial(snapshot: QueryDocumentSnapshot<DocumentData>): LessonMaterial {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    lessonId: data.lessonId ?? '',
    courseId: data.courseId ?? '',
    classId: data.classId ?? '',
    teacherId: data.teacherId ?? '',
    name: data.name ?? '',
    storagePath: data.storagePath ?? '',
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    contentType: data.contentType ?? 'application/octet-stream',
    createdAt: toIsoString(data.createdAt),
  }
}

/**
 * Reserves a material document id before anything is uploaded. The id has
 * to exist before the Storage upload starts, because the Storage path
 * embeds it (`lessons/{lessonId}/materials/{materialId}/{fileName}`), which
 * is what lets `storage.rules` and this document agree on which upload
 * belongs to which material.
 */
export function generateLessonMaterialId(lessonId: string): string {
  return doc(materialsCollection(lessonId)).id
}

export interface CreateLessonMaterialInput {
  id: string
  lessonId: string
  courseId: string
  classId: string
  teacherId: string
  name: string
  storagePath: string
  sizeBytes: number
  contentType: string
}

/**
 * Records a material's metadata in Firestore, at the id reserved by
 * `generateLessonMaterialId`, after its file has already been uploaded to
 * Storage at `storagePath`. The two writes are not atomic (Storage and
 * Firestore are separate services), so `lessonStorage.ts` always uploads
 * the file first and only calls this once the upload has succeeded, to
 * avoid a Firestore document pointing at a file that was never written.
 */
export async function createLessonMaterial({
  id,
  lessonId,
  courseId,
  classId,
  teacherId,
  name,
  storagePath,
  sizeBytes,
  contentType,
}: CreateLessonMaterialInput): Promise<void> {
  await setDoc(doc(materialsCollection(lessonId), id), {
    id,
    lessonId,
    courseId,
    classId,
    teacherId,
    name,
    storagePath,
    sizeBytes,
    contentType,
    createdAt: serverTimestamp(),
  })
}

/** Lists the materials attached to a lesson, alphabetically by file name. */
export async function listLessonMaterials(lessonId: string): Promise<LessonMaterial[]> {
  const snapshot = await getDocs(materialsCollection(lessonId))

  return snapshot.docs
    .map(toLessonMaterial)
    .sort((first, second) => first.name.localeCompare(second.name, 'fr'))
}

/** Deletes a material's Firestore document only; the caller deletes the Storage file first, mirroring `createLessonMaterial`'s ordering. */
export async function deleteLessonMaterialDocument(lessonId: string, materialId: string): Promise<void> {
  const firestore = getFirebaseFirestore()
  await deleteDoc(doc(firestore, LESSONS_COLLECTION, lessonId, LESSON_MATERIALS_SUBCOLLECTION, materialId))
}
