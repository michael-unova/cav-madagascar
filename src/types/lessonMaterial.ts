/**
 * One downloadable file attached to a lesson (a PDF, a slide deck, a
 * worksheet, ...). Lives in the `materials` subcollection of its lesson
 * (`lessons/{lessonId}/materials/{materialId}`) rather than as an array
 * field on the `Lesson` document.
 *
 * A subcollection was chosen over an embedded array for two reasons: an
 * array field cannot be validated element-by-element in Security Rules
 * (there is no per-item `keys().hasOnly(...)` check for array contents,
 * only for the field as a whole), and deleting a single material would
 * otherwise require rewriting the entire lesson document, which is both
 * wasteful and a race with anything else editing that document at the same
 * time. `courseId`, `classId`, and `teacherId` are duplicated from the
 * parent lesson so both the interface and Security Rules can authorize a
 * material without an extra read of its parent.
 */
export interface LessonMaterial {
  id: string
  lessonId: string
  courseId: string
  classId: string
  teacherId: string
  /** Original file name, shown to the user; `storagePath` is sanitized. */
  name: string
  storagePath: string
  sizeBytes: number
  contentType: string
  createdAt: string
}
