import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { getFirebaseStorage } from './storage'
import {
  createLessonMaterial,
  deleteLessonMaterialDocument,
  generateLessonMaterialId,
  listLessonMaterials,
} from './lessonMaterials'
import { deleteLessonDocument, listLessonsByCourse, updateLessonVideo } from './lessons'
import { deleteCourse } from './courses'
import type { Lesson } from '../../types'

/**
 * Upper bounds mirrored by `storage.rules`. Checking client side gives an
 * immediate French error message before a transfer starts; the rule is
 * still what actually enforces the limit, since a client-side check alone
 * can always be bypassed.
 */
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB
export const MAX_MATERIAL_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

const ALLOWED_MATERIAL_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]

export function isAllowedVideoType(contentType: string): boolean {
  return contentType.startsWith('video/')
}

export function isAllowedMaterialType(contentType: string): boolean {
  return contentType.startsWith('image/') || ALLOWED_MATERIAL_CONTENT_TYPES.includes(contentType)
}

/**
 * Strips characters that are awkward in a Storage path or a downloaded
 * file name, without renaming the file so much that the teacher no longer
 * recognizes it. The original name is still shown in the interface (see
 * `Lesson.videoName` / `LessonMaterial.name`); this sanitized version only
 * ever appears in the Storage path itself.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_')
}

function buildVideoPath(lessonId: string, fileName: string): string {
  return `lessons/${lessonId}/video/${sanitizeFileName(fileName)}`
}

function buildMaterialPath(lessonId: string, materialId: string, fileName: string): string {
  return `lessons/${lessonId}/materials/${materialId}/${sanitizeFileName(fileName)}`
}

/**
 * Uploads a file to Storage at `path`, reporting progress as a 0-100
 * integer. Rejects with the underlying `FirebaseError` on failure; callers
 * turn that into a French message with `getStorageErrorMessage`.
 */
function uploadToPath(path: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  const storageRef = ref(getFirebaseStorage(), path)
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type })

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      reject,
      () => resolve(),
    )
  })
}

/** Uploads a lesson's video and returns the Storage path it was written to. */
export async function uploadLessonVideo(
  lessonId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const path = buildVideoPath(lessonId, file.name)
  await uploadToPath(path, file, onProgress)
  return path
}

/** Uploads one lesson material and returns the Storage path it was written to. */
export async function uploadLessonMaterialFile(
  lessonId: string,
  materialId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const path = buildMaterialPath(lessonId, materialId, file.name)
  await uploadToPath(path, file, onProgress)
  return path
}

/**
 * Deletes a Storage object. Tolerates the object already being gone
 * (`storage/object-not-found`), since callers use this both for a normal
 * "replace the file" flow and for cleanup after an interrupted operation,
 * and a missing file in either case is not itself an error worth
 * surfacing.
 */
export async function deleteLessonFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), path))
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code !== 'storage/object-not-found') {
      throw error
    }
  }
}

/** Resolves a playable/downloadable URL for a Storage path, on demand. */
export async function getLessonFileUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), path))
}

/**
 * Replaces a lesson's video: uploads the new file, points the lesson at it,
 * then removes the previous file (if any and if its path actually changed,
 * which is not guaranteed when a teacher re-uploads a file with the same
 * name). The new file is written and recorded before the old one is
 * removed, so a failed upload never leaves the lesson without a video.
 */
export async function replaceLessonVideo(
  lesson: Lesson,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const path = await uploadLessonVideo(lesson.id, file, onProgress)
  await updateLessonVideo(lesson.id, { path, name: file.name, sizeBytes: file.size })

  if (lesson.videoPath && lesson.videoPath !== path) {
    await deleteLessonFile(lesson.videoPath)
  }
}

/** Removes a lesson's video: clears the Firestore fields, then deletes the file. */
export async function removeLessonVideo(lesson: Lesson): Promise<void> {
  if (!lesson.videoPath) {
    return
  }

  const path = lesson.videoPath
  await updateLessonVideo(lesson.id, null)
  await deleteLessonFile(path)
}

/**
 * Adds a material to a lesson: uploads the file, then records its metadata
 * in Firestore. If the Firestore write fails after a successful upload,
 * the orphaned Storage file is cleaned up rather than left behind with no
 * corresponding document (and therefore no way to reach or delete it
 * through the interface).
 */
export async function addLessonMaterial(
  lesson: Lesson,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const materialId = generateLessonMaterialId(lesson.id)
  const storagePath = await uploadLessonMaterialFile(lesson.id, materialId, file, onProgress)

  try {
    await createLessonMaterial({
      id: materialId,
      lessonId: lesson.id,
      courseId: lesson.courseId,
      classId: lesson.classId,
      teacherId: lesson.teacherId,
      name: file.name,
      storagePath,
      sizeBytes: file.size,
      contentType: file.type || 'application/octet-stream',
    })
  } catch (error) {
    await deleteLessonFile(storagePath)
    throw error
  }
}

/** Removes one material: deletes its file, then its Firestore document. */
export async function removeLessonMaterial(
  lessonId: string,
  materialId: string,
  storagePath: string,
): Promise<void> {
  await deleteLessonFile(storagePath)
  await deleteLessonMaterialDocument(lessonId, materialId)
}

/**
 * Deletes a lesson entirely: its video file, every material's file and
 * Firestore document, then the lesson's own Firestore document.
 *
 * Order matters here for a reason specific to this milestone: `storage.rules`
 * authorizes a delete by reading the lesson's Firestore document (via
 * `firestore.get()`) to confirm the requester is its teacher. If the
 * Firestore document were deleted first, that lookup would fail and every
 * subsequent Storage delete would be rejected as unauthorized. Storage
 * files are therefore always removed before the Firestore documents that
 * authorize deleting them.
 */
export async function deleteLessonWithContent(lessonId: string, videoPath: string | null): Promise<void> {
  const materials = await listLessonMaterials(lessonId)

  await Promise.all(materials.map((material) => deleteLessonFile(material.storagePath)))
  if (videoPath) {
    await deleteLessonFile(videoPath)
  }

  await Promise.all(materials.map((material) => deleteLessonMaterialDocument(lessonId, material.id)))
  await deleteLessonDocument(lessonId)
}

/**
 * Deletes every lesson of a course, each with its full cascade (materials,
 * video, and their Firestore documents). Lessons are removed one at a time
 * rather than in parallel: this is the first milestone where deleting one
 * parent can fan out into an unbounded number of Storage deletes (one
 * lesson can have many materials), and a bounded, sequential cascade is
 * simpler to reason about than a wide fan-out, at MVP volumes where the
 * difference in wall-clock time is not meaningful.
 *
 * Used by `deleteCourseWithContent` below and by `deleteClassWithContent`
 * in `classes.ts`, so that deleting a course or a class never leaves
 * lesson videos or materials behind as unreachable, billable Storage
 * objects. This extends the cascade-delete pattern established in
 * Milestone 3 (`deleteClassWithContent`) to the Storage-backed entities
 * this milestone introduces.
 */
export async function deleteLessonsForCourse(courseId: string): Promise<void> {
  const lessons = await listLessonsByCourse(courseId)

  for (const lesson of lessons) {
    await deleteLessonWithContent(lesson.id, lesson.videoPath)
  }
}

/** Deletes a course together with all of its lessons, materials, and video files. */
export async function deleteCourseWithContent(courseId: string): Promise<void> {
  await deleteLessonsForCourse(courseId)
  await deleteCourse(courseId)
}
