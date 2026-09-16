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
import { COURSES_COLLECTION } from './courses'
import { ENROLLMENTS_COLLECTION } from './enrollments'
import { deleteLessonsForCourse } from './lessonStorage'
import type { Class } from '../../types'

export const CLASSES_COLLECTION = 'classes'

/**
 * Alphabet for class codes: digits and uppercase letters, minus the pairs
 * that are easy to confuse when a code is read aloud or copied by hand
 * (0/O, 1/I/L, 2/Z, 5/S, 8/B).
 */
const CODE_ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY'
const CODE_LENGTH = 7

/**
 * Generates the id used both as the class document id and as the code
 * students type to join. `crypto.getRandomValues` is used rather than
 * `Math.random` so codes are not predictable from one another.
 */
export function createClassCode(): string {
  const values = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(values)

  let code = ''
  for (const value of values) {
    code += CODE_ALPHABET[value % CODE_ALPHABET.length]
  }
  return code
}

function toClass(snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Class {
  const data = snapshot.data() ?? {}
  const createdAt = toIsoString(data.createdAt)

  return {
    id: snapshot.id,
    name: data.name ?? '',
    description: data.description ?? '',
    teacherId: data.teacherId ?? '',
    teacherName: data.teacherName ?? '',
    createdAt,
    updatedAt: toIsoString(data.updatedAt, createdAt),
  }
}

export interface CreateClassInput {
  name: string
  description: string
  teacherId: string
  teacherName: string
}

/**
 * Creates a class and returns its id (which is also its join code).
 *
 * Codes are generated client side, so a collision with an existing class is
 * possible in principle. A collision is not silently tolerated: writing to
 * an id that already exists is an update rather than a create, which
 * Security Rules reject for a teacher who does not own that class, so the
 * write is retried with a fresh code instead of overwriting anyone's data.
 */
export async function createClass({ name, description, teacherId, teacherName }: CreateClassInput): Promise<string> {
  const firestore = getFirebaseFirestore()
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = createClassCode()
    const reference = doc(firestore, CLASSES_COLLECTION, id)

    const existing = await getDoc(reference).catch(() => null)
    if (existing?.exists()) {
      continue
    }

    await setDoc(reference, {
      id,
      name,
      description,
      teacherId,
      teacherName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return id
  }

  throw new Error('class-code-generation-failed')
}

export async function getClass(classId: string): Promise<Class | null> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDoc(doc(firestore, CLASSES_COLLECTION, classId))

  return snapshot.exists() ? toClass(snapshot) : null
}

/**
 * Lists the classes owned by one teacher.
 *
 * Results are sorted in memory rather than with `orderBy`, because
 * combining an equality filter with an ordering on a different field would
 * require a composite index to be deployed alongside the code. At MVP
 * volumes the difference is not measurable, and it keeps the project
 * deployable without extra Firebase configuration.
 */
export async function listClassesByTeacher(teacherId: string): Promise<Class[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, CLASSES_COLLECTION), where('teacherId', '==', teacherId)),
  )

  return sortByNewest(snapshot.docs.map(toClass))
}

/** Reads a specific set of classes, used to resolve a student's enrollments. */
export async function listClassesByIds(classIds: string[]): Promise<Class[]> {
  if (classIds.length === 0) {
    return []
  }

  const firestore = getFirebaseFirestore()
  const snapshots = await Promise.all(
    classIds.map((classId) => getDoc(doc(firestore, CLASSES_COLLECTION, classId))),
  )

  return sortByNewest(snapshots.filter((snapshot) => snapshot.exists()).map(toClass))
}

/** Lists every class on the platform. Only administrators may do this. */
export async function listAllClasses(): Promise<Class[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(collection(firestore, CLASSES_COLLECTION))

  return sortByNewest(snapshot.docs.map(toClass))
}

export interface UpdateClassInput {
  name: string
  description: string
}

export async function updateClass(classId: string, { name, description }: UpdateClassInput): Promise<void> {
  const firestore = getFirebaseFirestore()
  await updateDoc(doc(firestore, CLASSES_COLLECTION, classId), {
    name,
    description,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Deletes a class together with its courses and enrollments.
 *
 * The cascade runs on the client, so an interrupted delete can leave
 * orphaned children behind. That is acceptable while the data model is
 * this shallow (orphans are unreachable, since every route resolves a
 * course or enrollment through its class), but it is the kind of work that
 * belongs in a Cloud Function once lessons, materials, and submissions
 * exist underneath a class.
 *
 * As of Milestone 4, each course's lessons (and their video and material
 * files in Firebase Storage) are cascaded first, via
 * `deleteLessonsForCourse`. Storage objects have no equivalent of a
 * Firestore batch delete, and leaving them behind would be worse than the
 * Firestore orphans described above: unlike an orphaned Firestore document,
 * an orphaned Storage file has no path left in the interface that could
 * ever reach it again to clean it up, and it keeps counting against
 * storage usage indefinitely.
 */
export async function deleteClassWithContent(classId: string): Promise<void> {
  const firestore = getFirebaseFirestore()

  const [courseSnapshot, enrollmentSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, COURSES_COLLECTION), where('classId', '==', classId))),
    getDocs(query(collection(firestore, ENROLLMENTS_COLLECTION), where('classId', '==', classId))),
  ])

  for (const courseDoc of courseSnapshot.docs) {
    await deleteLessonsForCourse(courseDoc.id)
  }

  const children = [...courseSnapshot.docs, ...enrollmentSnapshot.docs]

  // Firestore batches accept at most 500 writes.
  for (let index = 0; index < children.length; index += 400) {
    const batch = writeBatch(firestore)
    for (const child of children.slice(index, index + 400)) {
      batch.delete(child.ref)
    }
    await batch.commit()
  }

  await deleteDoc(doc(firestore, CLASSES_COLLECTION, classId))
}

function sortByNewest(classes: Class[]): Class[] {
  return classes.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}
