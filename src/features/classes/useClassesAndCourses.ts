import { useAsyncData, type AsyncData } from '../../hooks/useAsyncData'
import { listAllClasses, listClassesByIds, listClassesByTeacher } from '../../lib/firebase/classes'
import { listAllCourses, listCoursesByClassIds, listCoursesByTeacher } from '../../lib/firebase/courses'
import { listEnrollmentsByStudent } from '../../lib/firebase/enrollments'
import type { Class, Course, User } from '../../types'

export interface ClassesAndCourses {
  classes: Class[]
  courses: Course[]
}

/**
 * Loads everything the signed-in user is allowed to see, in one place.
 *
 * Classes and courses are fetched together rather than by two independent
 * hooks because a student's courses are resolved through their
 * enrollments: splitting them would read the same `enrollments` documents
 * twice on every page that shows both.
 *
 * What each role sees is decided by Firestore Security Rules, not here.
 * Picking the narrowest query per role only avoids requests that the
 * server would reject anyway.
 */
export function useClassesAndCourses(user: User): AsyncData<ClassesAndCourses> {
  return useAsyncData<ClassesAndCourses>(async () => {
    if (user.role === 'teacher') {
      const [classes, courses] = await Promise.all([
        listClassesByTeacher(user.id),
        listCoursesByTeacher(user.id),
      ])
      return { classes, courses }
    }

    if (user.role === 'admin') {
      const [classes, courses] = await Promise.all([listAllClasses(), listAllCourses()])
      return { classes, courses }
    }

    const enrollments = await listEnrollmentsByStudent(user.id)
    const classIds = enrollments.map((enrollment) => enrollment.classId)
    const [classes, courses] = await Promise.all([
      listClassesByIds(classIds),
      listCoursesByClassIds(classIds),
    ])
    return { classes, courses }
  }, [user.id, user.role])
}

/** Groups courses by class id, for course counts and per-class lists. */
export function countCoursesByClass(courses: Course[]): Record<string, number> {
  return courses.reduce<Record<string, number>>((counts, course) => {
    counts[course.classId] = (counts[course.classId] ?? 0) + 1
    return counts
  }, {})
}
