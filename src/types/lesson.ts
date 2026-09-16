/**
 * A lesson belongs to exactly one course. `courseId` and `classId` are both
 * duplicated here (the class transitively through the course) so ownership
 * and enrollment checks, both in the interface and in Security Rules, never
 * require loading the parent course first. `teacherId` is duplicated for
 * the same reason, mirroring `Course.teacherId`.
 *
 * The video is optional: a lesson can be created with just a title and
 * description, then have its video uploaded afterward. `videoPath` is the
 * Firebase Storage path, not a download URL (a download URL is a resolved
 * artifact of a path, not the identity of "the current file"); the URL used
 * for playback is resolved on demand with `getLessonFileUrl`.
 *
 * Learning materials are not modelled on the lesson itself: they live in
 * the `materials` subcollection (see `LessonMaterial`), one document per
 * file, so adding or removing a single material never requires rewriting
 * this document.
 */
export interface Lesson {
  id: string
  courseId: string
  classId: string
  teacherId: string
  title: string
  description: string
  /**
   * Position within the course, starting at 0. Sorted in memory rather than
   * with `orderBy`, consistent with every other list in this project (see
   * the Milestone 3 "no composite indexes" decision).
   */
  order: number
  videoPath: string | null
  /** Original file name, kept for display since `videoPath` is sanitized. */
  videoName: string | null
  videoSizeBytes: number | null
  createdAt: string
  updatedAt: string
}
