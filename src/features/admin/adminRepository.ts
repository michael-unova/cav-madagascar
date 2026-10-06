import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { Course, CourseCardColor, CourseGroup, CourseStatus } from '../../types/course'
import type { Subject } from '../../types/subject'

const firestore = getFirebaseFirestore()

function dateOf(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate()
  }
  return value instanceof Date ? value : undefined
}

function isCourseCardColor(value: unknown): value is CourseCardColor {
  return ['blue', 'purple', 'green', 'orange', 'red', 'teal', 'indigo', 'pink', 'amber', 'cyan', 'slate', 'rose'].includes(value as string)
}

function courseFrom(id: string, data: Record<string, unknown>): Course {
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
    currency: 'MGA',
    status: (data.status === 'published' || data.status === 'archived') ? data.status : 'draft',
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: dateOf(data.createdAt),
    updatedAt: dateOf(data.updatedAt),
    publishedAt: dateOf(data.publishedAt),
  }
}

function subjectFrom(id: string, data: Record<string, unknown>): Subject {
  return {
    id,
    name: String(data.name ?? ''),
    matricule: String(data.matricule ?? ''),
    niveau: String(data.niveau ?? ''),
    description: String(data.description ?? ''),
    status: (data.status === 'published' || data.status === 'archived') ? data.status : 'draft',
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: dateOf(data.createdAt),
    updatedAt: dateOf(data.updatedAt),
  }
}


function groupFrom(id: string, data: Record<string, unknown>): CourseGroup {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    cardColor: isCourseCardColor(data.cardColor) ? data.cardColor : 'blue',
    status: (data.status === 'published' || data.status === 'archived') ? data.status : 'draft',
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    createdAt: dateOf(data.createdAt),
    updatedAt: dateOf(data.updatedAt),
  }
}

export async function listAdminCourseGroups(): Promise<CourseGroup[]> {
  const snapshot = await getDocs(query(collection(firestore, 'courseGroups'), orderBy('title')))
  return snapshot.docs.map((item) => groupFrom(item.id, item.data()))
}

export async function createCourseGroup(input: {
  title: string
  description: string
  cardColor: CourseCardColor
  userId: string
}): Promise<string> {
  const ref = await addDoc(collection(firestore, 'courseGroups'), {
    title: input.title.trim(),
    description: input.description.trim(),
    cardColor: input.cardColor,
    status: 'published' satisfies CourseStatus,
    createdBy: input.userId,
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCourseGroup(
  groupId: string,
  input: Partial<Pick<CourseGroup, 'title' | 'description' | 'cardColor' | 'status'>>,
  userId: string,
): Promise<void> {
  await updateDoc(doc(firestore, 'courseGroups', groupId), {
    ...input,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCourseGroup(groupId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'courseGroups', groupId))
}

export async function listAdminCourses(): Promise<Course[]> {
  const snapshot = await getDocs(query(collection(firestore, 'courses'), orderBy('title')))
  return snapshot.docs.map((item) => courseFrom(item.id, item.data()))
}

export async function createCourse(input: {
  title: string
  slug: string
  description: string
  price: number
  accessDurationDays?: number
  cardColor?: CourseCardColor
  thumbnailUrl?: string
  userId: string
}): Promise<string> {
  const ref = await addDoc(collection(firestore, 'courses'), {
    title: input.title.trim(),
    slug: input.slug.trim().toLowerCase(),
    description: input.description.trim(),
    price: input.price,
    accessDurationDays: Math.max(1, Math.floor(input.accessDurationDays ?? 30)),
    cardColor: input.cardColor ?? 'blue',
    ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
    currency: 'MGA',
    status: 'draft' satisfies CourseStatus,
    createdBy: input.userId,
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function syncPublishedCourseSubjectLinks(): Promise<void> {
  const [coursesSnapshot, subjectsSnapshot, linksSnapshot] = await Promise.all([
    getDocs(collection(firestore, 'courses')),
    getDocs(collection(firestore, 'subjects')),
    getDocs(collection(firestore, 'courseSubjects')),
  ])
  const publishedCourses = new Set(
    coursesSnapshot.docs
      .filter((item) => item.data().status === 'published')
      .map((item) => item.id),
  )
  const publishedSubjects = new Set(
    subjectsSnapshot.docs
      .filter((item) => item.data().status === 'published')
      .map((item) => item.id),
  )
  const updates = linksSnapshot.docs
    .filter((item) => item.data().status !== 'published'
      && publishedCourses.has(String(item.data().courseId ?? ''))
      && publishedSubjects.has(String(item.data().subjectId ?? '')))
    .map((item) => updateDoc(item.ref, { status: 'published', updatedAt: serverTimestamp() }))
  await Promise.all(updates)
}

export async function updateCourse(
  courseId: string,
  input: Partial<Pick<Course, 'title' | 'slug' | 'description' | 'price' | 'accessDurationDays' | 'cardColor' | 'groupId' | 'status'>> & { thumbnailUrl?: string | null },
  userId: string,
): Promise<void> {
  const { thumbnailUrl, ...courseFields } = input
  await updateDoc(doc(firestore, 'courses', courseId), {
    ...courseFields,
    ...(thumbnailUrl === null ? { thumbnailUrl: deleteField() } : thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
    ...(input.accessDurationDays !== undefined ? { accessDurationDays: Math.max(1, Math.floor(input.accessDurationDays)) } : {}),
    ...(input.status === 'published' ? { publishedAt: serverTimestamp() } : {}),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  })
  if (input.status === 'published') {
    const links = await getDocs(query(collection(firestore, 'courseSubjects'), where('courseId', '==', courseId)))
    const subjects = await getDocs(collection(firestore, 'subjects'))
    const publishedSubjectIds = new Set(subjects.docs.filter((item) => item.data().status === 'published').map((item) => item.id))
    await Promise.all(links.docs
      .filter((item) => publishedSubjectIds.has(String(item.data().subjectId ?? '')))
      .map((item) => updateDoc(item.ref, { status: 'published', updatedAt: serverTimestamp() })))
  }
}


export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'courses', courseId))
}

export async function listAdminSubjects(): Promise<Subject[]> {
  const snapshot = await getDocs(query(collection(firestore, 'subjects'), orderBy('name')))
  return snapshot.docs.map((item) => subjectFrom(item.id, item.data()))
}

export async function createSubject(input: {
  name: string
  matricule: string
  niveau: string
  description: string
  userId: string
}): Promise<string> {
  const ref = await addDoc(collection(firestore, 'subjects'), {
    name: input.name.trim(),
    matricule: input.matricule.trim().toUpperCase(),
    niveau: input.niveau.trim(),
    description: input.description.trim(),
    status: 'draft',
    createdBy: input.userId,
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteSubject(subjectId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'subjects', subjectId))
}

export async function updateSubject(
  subjectId: string,
  input: Partial<Pick<Subject, 'name' | 'matricule' | 'niveau' | 'description' | 'status'>>,
  userId: string,
): Promise<void> {
  await updateDoc(doc(firestore, 'subjects', subjectId), {
    ...input,
    ...(input.matricule ? { matricule: input.matricule.trim().toUpperCase() } : {}),
    ...(input.niveau ? { niveau: input.niveau.trim() } : {}),
    ...(input.name ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  })
  if (input.status === 'published') {
    const links = await getDocs(query(collection(firestore, 'courseSubjects'), where('subjectId', '==', subjectId)))
    const courses = await getDocs(collection(firestore, 'courses'))
    const publishedCourseIds = new Set(courses.docs.filter((item) => item.data().status === 'published').map((item) => item.id))
    await Promise.all(links.docs
      .filter((item) => publishedCourseIds.has(String(item.data().courseId ?? '')))
      .map((item) => updateDoc(item.ref, { status: 'published', updatedAt: serverTimestamp() })))
  }
}



export interface AdminUserRow {
  uid: string
  displayName: string
  email: string
  role: 'student' | 'content_manager' | 'super_admin'
  status: 'active' | 'suspended'
  photoURL?: string
  createdAt?: Date
  lastSeenAt?: Date
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const snapshot = await getDocs(collection(firestore, 'users'))
  return snapshot.docs.map(item => {
    const data = item.data()
    return {
      uid: item.id,
      displayName: String(data.displayName ?? 'Utilisateur'),
      email: String(data.email ?? ''),
      role: (data.role === 'super_admin' || data.role === 'content_manager' ? data.role : 'student') as AdminUserRow['role'],
      status: (data.status === 'suspended' ? 'suspended' : 'active') as AdminUserRow['status'],
      photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
      createdAt: dateOf(data.createdAt),
      lastSeenAt: dateOf(data.lastSeenAt),
    }
  }).sort((a,b) => a.displayName.localeCompare(b.displayName, 'fr'))
}
