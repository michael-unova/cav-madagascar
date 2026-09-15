import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseFirestore } from './firestore'
import { toIsoString } from './timestamps'
import { buildEnrollmentId, type Enrollment } from '../../types/enrollment'

export const ENROLLMENTS_COLLECTION = 'enrollments'

function toEnrollment(snapshot: QueryDocumentSnapshot<DocumentData>): Enrollment {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    classId: data.classId ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    studentEmail: data.studentEmail ?? '',
    createdAt: toIsoString(data.createdAt),
  }
}

export interface JoinClassInput {
  classId: string
  studentId: string
  studentName: string
  studentEmail: string
}

/**
 * Enrolls the signed-in student in a class.
 *
 * Knowing the class code is the authorization: the code is the class
 * document id, and Security Rules only accept this write when a class with
 * that id exists. An unknown or mistyped code therefore fails as a
 * permission error rather than creating a dangling enrollment, and the
 * client never needs read access to classes it is not a member of.
 */
export async function joinClass({ classId, studentId, studentName, studentEmail }: JoinClassInput): Promise<void> {
  const firestore = getFirebaseFirestore()
  const id = buildEnrollmentId(classId, studentId)

  await setDoc(doc(firestore, ENROLLMENTS_COLLECTION, id), {
    id,
    classId,
    studentId,
    studentName,
    studentEmail,
    createdAt: serverTimestamp(),
  })
}

/** Lists the students enrolled in a class. Readable by the class's teacher. */
export async function listEnrollmentsByClass(classId: string): Promise<Enrollment[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, ENROLLMENTS_COLLECTION), where('classId', '==', classId)),
  )

  return snapshot.docs
    .map(toEnrollment)
    .sort((first, second) => first.studentName.localeCompare(second.studentName, 'fr'))
}

/** Lists the classes a student belongs to. */
export async function listEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
  const firestore = getFirebaseFirestore()
  const snapshot = await getDocs(
    query(collection(firestore, ENROLLMENTS_COLLECTION), where('studentId', '==', studentId)),
  )

  return snapshot.docs.map(toEnrollment)
}

/** Removes a student from a class, either by the student or by the teacher. */
export async function removeEnrollment(classId: string, studentId: string): Promise<void> {
  const firestore = getFirebaseFirestore()
  await deleteDoc(doc(firestore, ENROLLMENTS_COLLECTION, buildEnrollmentId(classId, studentId)))
}
