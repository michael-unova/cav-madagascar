/**
 * Links one student to one class. The document id is always
 * `${classId}_${studentId}`, which makes membership checks in Security
 * Rules a single `exists()` lookup with no query involved.
 *
 * `studentName` and `studentEmail` are copied from the student's profile
 * when they join, because teachers cannot read other users' documents in
 * the `users` collection.
 */
export interface Enrollment {
  id: string
  classId: string
  studentId: string
  studentName: string
  studentEmail: string
  createdAt: string
}

export function buildEnrollmentId(classId: string, studentId: string): string {
  return `${classId}_${studentId}`
}
