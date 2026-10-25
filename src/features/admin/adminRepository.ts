import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
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

export interface SubjectDependencies {
  /** Existing concours that include this subject. */
  courses: { id: string; title: string }[]
  /** Links pointing to concours that no longer exist (left behind by deleted concours). */
  staleLinks: number
  nodes: number
  blocks: number
  questions: number
  questionSets: number
}

async function subjectDeletionRefs(subjectId: string) {
  const [linkSnap, nodeSnap, questionSnap, setSnap, courseSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'courseSubjects'), where('subjectId', '==', subjectId))),
    getDocs(query(collection(firestore, 'contentNodes'), where('subjectId', '==', subjectId))),
    getDocs(query(collection(firestore, 'questions'), where('subjectId', '==', subjectId))),
    getDocs(query(collection(firestore, 'questionSets'), where('subjectId', '==', subjectId))),
    getDocs(collection(firestore, 'courses')),
  ])
  const nodeIds = nodeSnap.docs.map((item) => item.id)
  const blockRefs = []
  for (let index = 0; index < nodeIds.length; index += 30) {
    const blockSnap = await getDocs(query(collection(firestore, 'contentBlocks'), where('nodeId', 'in', nodeIds.slice(index, index + 30))))
    blockRefs.push(...blockSnap.docs.map((item) => item.ref))
  }
  return {
    linkSnap,
    courseTitles: new Map(courseSnap.docs.map((item) => [item.id, String(item.data().title ?? item.id)])),
    nodeRefs: nodeSnap.docs.map((item) => item.ref),
    blockRefs,
    questionRefs: questionSnap.docs.map((item) => item.ref),
    setRefs: setSnap.docs.map((item) => item.ref),
  }
}

export async function getSubjectDependencies(subjectId: string): Promise<SubjectDependencies> {
  const refs = await subjectDeletionRefs(subjectId)
  const liveCourseIds = new Set<string>()
  let staleLinks = 0
  refs.linkSnap.docs.forEach((item) => {
    const courseId = String(item.data().courseId ?? '')
    if (refs.courseTitles.has(courseId)) liveCourseIds.add(courseId)
    else staleLinks += 1
  })
  return {
    courses: Array.from(liveCourseIds).map((id) => ({ id, title: refs.courseTitles.get(id) ?? id })),
    staleLinks,
    nodes: refs.nodeRefs.length,
    blocks: refs.blockRefs.length,
    questions: refs.questionRefs.length,
    questionSets: refs.setRefs.length,
  }
}

/**
 * Permanently deletes a subject: its links to concours, themes, lessons, lesson blocks,
 * questions and evaluations, then the subject itself (last, so a failed attempt can be retried).
 */
export async function deleteSubject(subjectId: string): Promise<void> {
  const refs = await subjectDeletionRefs(subjectId)
  const all = [
    ...refs.linkSnap.docs.map((item) => item.ref),
    ...refs.blockRefs,
    ...refs.nodeRefs,
    ...refs.questionRefs,
    ...refs.setRefs,
  ]
  for (let index = 0; index < all.length; index += 400) {
    const batch = writeBatch(firestore)
    all.slice(index, index + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  await deleteDoc(doc(firestore, 'subjects', subjectId))
}

export interface DuplicateSubjectResult {
  subjectId: string
  nodes: number
  blocks: number
  questions: number
  questionSets: number
}

function freshKey(prefix: string): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${id}`
}

/** Returns a matricule based on `base` that no existing matière uses. */
export function uniqueCopyMatricule(base: string, existing: string[]): string {
  const taken = new Set(existing.map((item) => item.trim().toUpperCase()))
  const root = `${base.trim().toUpperCase()}-COPIE`
  if (!taken.has(root)) return root
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${root}-${index}`
    if (!taken.has(candidate)) return candidate
  }
  return `${root}-${Date.now()}`
}

/**
 * Creates an independent copy of a matière: chapters/lessons, lesson blocks (text, images, files,
 * videos, quizzes), questions and question sets. Every copied record gets a new id and new sharedKey,
 * so editing the copy never changes the original. Uploaded files are referenced by URL, so images and
 * attachments are present in the copy and replacing them in the copy leaves the original untouched.
 * The copy is created as a draft and is not attached to any concours.
 */
export async function duplicateSubject(
  sourceId: string,
  input: { name: string; matricule: string; userId: string },
): Promise<DuplicateSubjectResult> {
  const sourceSnap = await getDoc(doc(firestore, 'subjects', sourceId))
  if (!sourceSnap.exists()) throw new Error('La matière à dupliquer est introuvable.')
  const source = sourceSnap.data()

  // 1) Read everything first, so a read problem never leaves a half-made copy.
  let nodeDocs = (await getDocs(query(collection(firestore, 'contentNodes'), where('subjectId', '==', sourceId)))).docs
  if (!nodeDocs.some((item) => item.data().parentId) ) {
    // Older content may still be linked to a concours association instead of the matière itself.
    const links = await getDocs(query(collection(firestore, 'courseSubjects'), where('subjectId', '==', sourceId)))
    for (const link of links.docs) {
      const legacy = (await getDocs(query(collection(firestore, 'contentNodes'), where('courseSubjectId', '==', link.id)))).docs
      if (legacy.length > nodeDocs.length) { nodeDocs = legacy; if (legacy.some((item) => item.data().parentId)) break }
    }
  }
  const nodeIds = nodeDocs.map((item) => item.id)
  const blockDocs = []
  for (let index = 0; index < nodeIds.length; index += 30) {
    const snap = await getDocs(query(collection(firestore, 'contentBlocks'), where('nodeId', 'in', nodeIds.slice(index, index + 30))))
    blockDocs.push(...snap.docs)
  }
  const questionDocs = (await getDocs(query(collection(firestore, 'questions'), where('subjectId', '==', sourceId)))).docs
  const setDocs = (await getDocs(query(collection(firestore, 'questionSets'), where('subjectId', '==', sourceId)))).docs

  // 2) Create the new matière (draft, not linked to any concours).
  const newSubject = await addDoc(collection(firestore, 'subjects'), {
    name: input.name.trim(),
    matricule: input.matricule.trim().toUpperCase(),
    niveau: String(source.niveau ?? ''),
    description: String(source.description ?? ''),
    status: 'draft',
    createdBy: input.userId,
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const newSubjectId = newSubject.id

  try {
    // 3) Plan new ids up front so parent links and cross references can be remapped.
    const nodeIdMap = new Map<string, string>()
    const nodeKeyMap = new Map<string, string>()
    nodeDocs.forEach((item) => {
      nodeIdMap.set(item.id, doc(collection(firestore, 'contentNodes')).id)
      const key = item.data().sharedKey
      if (typeof key === 'string' && key && !nodeKeyMap.has(key)) nodeKeyMap.set(key, freshKey('node'))
    })
    const blockKeyMap = new Map<string, string>()
    const questionIdMap = new Map<string, string>()
    questionDocs.forEach((item) => questionIdMap.set(item.id, doc(collection(firestore, 'questions')).id))

    const writes: Array<(batch: ReturnType<typeof writeBatch>) => void> = []

    nodeDocs.forEach((item) => {
      const data = { ...item.data() } as Record<string, unknown>
      delete data.courseSubjectId
      delete data.createdAt
      delete data.updatedAt
      const parentId = typeof data.parentId === 'string' ? nodeIdMap.get(data.parentId) : undefined
      delete data.parentId
      const key = typeof data.sharedKey === 'string' ? nodeKeyMap.get(data.sharedKey) : undefined
      delete data.sharedKey
      const target = doc(firestore, 'contentNodes', nodeIdMap.get(item.id)!)
      writes.push((batch) => batch.set(target, {
        ...data,
        subjectId: newSubjectId,
        ...(parentId ? { parentId } : {}),
        ...(key ? { sharedKey: key } : {}),
        createdBy: input.userId,
        updatedBy: input.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }))
    })

    blockDocs.forEach((item) => {
      const data = { ...item.data() } as Record<string, unknown>
      delete data.createdAt
      delete data.updatedAt
      const newNodeId = nodeIdMap.get(String(data.nodeId ?? ''))
      if (!newNodeId) return
      let key: string | undefined
      if (typeof data.sharedKey === 'string' && data.sharedKey) {
        key = blockKeyMap.get(data.sharedKey)
        if (!key) { key = freshKey('block'); blockKeyMap.set(data.sharedKey, key) }
      }
      delete data.sharedKey
      writes.push((batch) => batch.set(doc(collection(firestore, 'contentBlocks')), {
        ...data,
        nodeId: newNodeId,
        ...(key ? { sharedKey: key } : {}),
        createdBy: input.userId,
        updatedBy: input.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }))
    })

    questionDocs.forEach((item) => {
      const data = { ...item.data() } as Record<string, unknown>
      delete data.courseId
      delete data.courseSubjectId
      delete data.updatedAt
      delete data.createdAt
      const contentNodeId = typeof data.contentNodeId === 'string' ? nodeIdMap.get(data.contentNodeId) : undefined
      delete data.contentNodeId
      writes.push((batch) => batch.set(doc(firestore, 'questions', questionIdMap.get(item.id)!), {
        ...data,
        subjectId: newSubjectId,
        ...(contentNodeId ? { contentNodeId } : {}),
        createdBy: input.userId,
        updatedAt: serverTimestamp(),
      }))
    })

    setDocs.forEach((item) => {
      const data = { ...item.data() } as Record<string, unknown>
      delete data.courseId
      delete data.courseSubjectId
      delete data.updatedAt
      delete data.createdAt
      const oldIds = Array.isArray(data.questionIds) ? data.questionIds.map(String) : []
      const questionIds = oldIds.map((id) => questionIdMap.get(id)).filter((id): id is string => Boolean(id))
      const snapshots = Array.isArray(data.questions) ? (data.questions as Array<Record<string, unknown>>) : []
      const questions = snapshots
        .filter((snapshot) => questionIdMap.has(String(snapshot.id)))
        .map((snapshot) => ({ ...snapshot, id: questionIdMap.get(String(snapshot.id))! }))
      writes.push((batch) => batch.set(doc(collection(firestore, 'questionSets')), {
        ...data,
        subjectId: newSubjectId,
        questionIds,
        questions,
        createdBy: input.userId,
        updatedAt: serverTimestamp(),
      }))
    })

    for (let index = 0; index < writes.length; index += 400) {
      const batch = writeBatch(firestore)
      writes.slice(index, index + 400).forEach((write) => write(batch))
      await batch.commit()
    }

    return {
      subjectId: newSubjectId,
      nodes: nodeDocs.length,
      blocks: blockDocs.length,
      questions: questionDocs.length,
      questionSets: setDocs.length,
    }
  } catch (error) {
    // Remove the partial copy so nothing half-finished stays in the library.
    try { await deleteSubject(newSubjectId) } catch (cleanupError) { console.error(cleanupError) }
    throw error
  }
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
