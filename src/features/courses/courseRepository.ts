import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { Course, CourseCardColor, CourseGroup, CourseSubject } from '../../types/course'

const firestore = getFirebaseFirestore()

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate()
  }
  return undefined
}

function isCourseCardColor(value: unknown): value is CourseCardColor {
  return ['blue', 'purple', 'green', 'orange', 'red', 'teal', 'indigo', 'pink', 'amber', 'cyan', 'slate', 'rose'].includes(value as string)
}

function mapCourse(id: string, data: Record<string, unknown>): Course {
  return {
    id,
    title: String(data.title ?? ''),
    slug: String(data.slug ?? ''),
    description: String(data.description ?? ''),
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
    groupId: typeof data.groupId === 'string' ? data.groupId : undefined,
    cardColor: isCourseCardColor(data.cardColor) ? data.cardColor : (isCourseCardColor(data.color) ? data.color : 'blue'),
    price: Number(data.price ?? 0),
    accessDurationDays: Math.max(1, Number(data.accessDurationDays ?? 30)),
    currency: data.currency === 'MGA' ? 'MGA' : 'MGA',
    status: data.status === 'published' || data.status === 'archived' ? data.status : 'draft',
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: toDate(data.publishedAt),
  }
}

function mapCourseSubject(id: string, data: Record<string, unknown>): CourseSubject {
  return {
    id,
    courseId: String(data.courseId ?? ''),
    subjectId: String(data.subjectId ?? ''),
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' ? data.description : undefined,
    order: Number(data.order ?? 0),
    status: data.status === 'published' || data.status === 'archived' ? data.status : 'draft',
  }
}


function mapGroup(id: string, data: Record<string, unknown>): CourseGroup {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    cardColor: isCourseCardColor(data.cardColor) ? data.cardColor : 'blue',
    status: data.status === 'published' ? 'published' : data.status === 'archived' ? 'archived' : 'draft',
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export async function listPublishedCourseGroups(): Promise<CourseGroup[]> {
  try {
    const snapshot = await getDocs(query(collection(firestore, 'courseGroups'), where('status', '==', 'published')))
    return snapshot.docs.map((item) => mapGroup(item.id, item.data())).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  } catch {
    // A group loading failure must never prevent the concours catalogue from loading.
    return []
  }
}

export async function listPublishedCourses(): Promise<Course[]> {
  const snapshot = await getDocs(
    query(collection(firestore, 'courses'), where('status', '==', 'published')),
  )

  return snapshot.docs
    .map((item) => mapCourse(item.id, item.data()))
    .sort((a, b) => {
      const aTime = a.publishedAt?.getTime() ?? 0
      const bTime = b.publishedAt?.getTime() ?? 0
      return bTime - aTime
    })
}

export async function getPublishedCourseBySlug(slug: string): Promise<Course | null> {
  const snapshot = await getDocs(
    query(
      collection(firestore, 'courses'),
      where('slug', '==', slug),
      where('status', '==', 'published'),
    ),
  )

  const item = snapshot.docs[0]
  return item ? mapCourse(item.id, item.data()) : null
}

export async function listPublishedCourseSubjects(courseId: string): Promise<CourseSubject[]> {
  try {
    const snapshot = await getDocs(
      query(
        collection(firestore, 'courseSubjects'),
        where('courseId', '==', courseId),
        where('status', '==', 'published'),
      ),
    )

    return snapshot.docs
      .map((item) => mapCourseSubject(item.id, item.data()))
      .sort((a, b) => a.order - b.order)
  } catch {
    // Fallback avoids hiding every concours when the composite index is missing.
    const snapshot = await getDocs(
      query(collection(firestore, 'courseSubjects'), where('courseId', '==', courseId)),
    )
    return snapshot.docs
      .map((item) => mapCourseSubject(item.id, item.data()))
      .filter((item) => item.status === 'published')
      .sort((a, b) => a.order - b.order)
  }
}

export async function getPublishedCourseById(courseId: string): Promise<Course | null> {
  const snapshot = await getDoc(doc(firestore, 'courses', courseId))
  if (!snapshot.exists()) return null

  const course = mapCourse(snapshot.id, snapshot.data())
  return course.status === 'published' ? course : null
}
