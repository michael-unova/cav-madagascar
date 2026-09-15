/**
 * A course belongs to exactly one class. `teacherId` duplicates the owning
 * class's teacher so ownership checks (both in the interface and in
 * Security Rules) do not require loading the class first.
 *
 * Lessons, materials, and video live in Milestone 4 and are not modelled
 * here yet.
 */
export interface Course {
  id: string
  classId: string
  teacherId: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
}
