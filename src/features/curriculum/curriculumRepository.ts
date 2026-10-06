import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import type { CourseSubject } from '../../types/course'
import type { ContentNode, ContentBlock, ContentNodeType, ContentBlockType, ContentStatus } from '../../types/content'

const db = getFirebaseFirestore()

function sharedKey(prefix: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${id}`
}

function mapCourseSubject(id: string, data: Record<string, unknown>): CourseSubject {
  return { id, courseId: String(data.courseId ?? ''), subjectId: String(data.subjectId ?? ''), title: String(data.title ?? ''), matricule: typeof data.matricule === 'string' ? data.matricule : undefined, niveau: typeof data.niveau === 'string' ? data.niveau : undefined, description: typeof data.description === 'string' ? data.description : undefined, order: Number(data.order ?? 0), status: (data.status ?? 'draft') as CourseSubject['status'] }
}

function mapNode(id: string, data: Record<string, unknown>): ContentNode {
  return {
    id,
    courseSubjectId: typeof data.courseSubjectId === 'string' ? data.courseSubjectId : undefined,
    subjectId: typeof data.subjectId === 'string' ? data.subjectId : undefined,
    parentId: typeof data.parentId === 'string' ? data.parentId : undefined,
    type: (data.type ?? 'chapter') as ContentNodeType,
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' ? data.description : undefined,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    imagePosition: typeof data.imagePosition === 'string' ? data.imagePosition as ContentNode['imagePosition'] : undefined,
    order: Number(data.order ?? 0),
    status: (data.status ?? 'draft') as ContentStatus,
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    sharedKey: typeof data.sharedKey === 'string' ? data.sharedKey : undefined,
  }
}

function mapBlock(id: string, data: Record<string, unknown>): ContentBlock {
  return { id, nodeId: String(data.nodeId ?? ''), type: (data.type ?? 'text') as ContentBlockType, order: Number(data.order ?? 0), content: (data.content ?? {}) as Record<string, unknown>, media: data.media as ContentBlock['media'], settings: data.settings as Record<string, unknown> | undefined, status: (data.status ?? 'draft') as ContentStatus, createdBy: String(data.createdBy ?? ''), updatedBy: String(data.updatedBy ?? ''), sharedKey: typeof data.sharedKey === 'string' ? data.sharedKey : undefined }
}

export async function listCourseSubjects(courseId: string, publishedOnly = false): Promise<CourseSubject[]> {
  const constraints = publishedOnly
    ? [where('courseId', '==', courseId), where('status', '==', 'published')]
    : [where('courseId', '==', courseId), orderBy('order')]
  const snap = await getDocs(query(collection(db, 'courseSubjects'), ...constraints))
  return snap.docs.map(d => mapCourseSubject(d.id, d.data())).sort((a, b) => a.order - b.order)
}

export async function listCourseSubjectsBySubjectId(subjectId: string, publishedOnly = false): Promise<CourseSubject[]> {
  const constraints = publishedOnly
    ? [where('subjectId', '==', subjectId), where('status', '==', 'published')]
    : [where('subjectId', '==', subjectId)]
  const snap = await getDocs(query(collection(db, 'courseSubjects'), ...constraints))
  return snap.docs.map(d => mapCourseSubject(d.id, d.data())).sort((a, b) => a.order - b.order)
}

export async function attachSubject(input: { courseId: string; subjectId: string; title: string; matricule?: string; niveau?: string; description?: string; order: number; userId: string }) {
  return addDoc(collection(db, 'courseSubjects'), { ...input, status: 'published', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function updateCourseSubject(id: string, input: Partial<Pick<CourseSubject, 'title'|'description'|'order'|'status'>>, userId: string) {
  await updateDoc(doc(db, 'courseSubjects', id), { ...input, updatedBy: userId, updatedAt: serverTimestamp() })
}

export async function deleteCourseSubject(id: string) { await deleteDoc(doc(db, 'courseSubjects', id)) }

export async function listContentNodes(courseSubjectId: string, publishedOnly = false): Promise<ContentNode[]> {
  const constraints = publishedOnly
    ? [where('courseSubjectId', '==', courseSubjectId), where('status', '==', 'published')]
    : [where('courseSubjectId', '==', courseSubjectId), orderBy('order')]
  const snap = await getDocs(query(collection(db, 'contentNodes'), ...constraints))
  return snap.docs.map(d => mapNode(d.id, d.data())).sort((a, b) => a.order - b.order)
}

/** Canonical shared content for a reusable Matière. Legacy course-linked content is used as a fallback. */
export async function listSubjectContentNodes(subjectId: string, publishedOnly = false): Promise<ContentNode[]> {
  const constraints = publishedOnly
    ? [where('subjectId', '==', subjectId), where('status', '==', 'published')]
    : [where('subjectId', '==', subjectId), orderBy('order')]
  const snap = await getDocs(query(collection(db, 'contentNodes'), ...constraints))
  const canonical = snap.docs.map(d => mapNode(d.id, d.data())).sort((a, b) => a.order - b.order)
  if (canonical.length) return canonical
  const associations = await listCourseSubjectsBySubjectId(subjectId, publishedOnly)
  if (!associations.length) return []
  return listContentNodes(associations[0].id, publishedOnly)
}

/**
 * Resolves the content for one course/matière association. Course-linked legacy
 * content is preferred when it actually contains lessons. Otherwise the
 * reusable Matière content is used. This prevents a canonical Matière that only
 * contains a topic shell from hiding an older published lesson attached to the
 * concours.
 */
export async function listCourseSubjectContentNodes(
  courseSubjectId: string,
  subjectId: string,
  publishedOnly = false,
): Promise<ContentNode[]> {
  // Load the course-linked structure without filtering topics by publication.
  // A topic is a structural container: a published lesson may still belong to
  // a topic that was created before topics received their own publication state.
  const allCourseNodes = await listContentNodes(courseSubjectId, false)
  const courseNodes = publishedOnly
    ? (() => {
        const publishedLessons = allCourseNodes.filter(node => node.type !== 'topic' && node.status === 'published')
        const publishedLessonParentIds = new Set(publishedLessons.map(node => node.parentId).filter(Boolean) as string[])
        return allCourseNodes.filter(node =>
          node.status === 'published' || (node.type === 'topic' && publishedLessonParentIds.has(node.id))
        )
      })()
    : allCourseNodes

  if (countLessonNodes(courseNodes) > 0) {
    // Topic illustrations live on the canonical reusable Matière nodes.
    // Enrich legacy/course-linked topic nodes with that metadata so students
    // see the same illustration regardless of which content path supplied the lessons.
    const canonicalNodes = await listSubjectContentNodes(subjectId, false)
    const bySharedKey = new Map(canonicalNodes.filter(node => node.sharedKey).map(node => [node.sharedKey!, node]))
    const canonicalTopics = canonicalNodes.filter(node => node.type === 'topic')
    return courseNodes.map(node => {
      if (node.type !== 'topic') return node
      const canonical = (node.sharedKey ? bySharedKey.get(node.sharedKey) : undefined)
        ?? canonicalTopics.find(topic => topic.title.trim().toLowerCase() === node.title.trim().toLowerCase())
      if (!canonical) return node
      return {
        ...node,
        description: node.description ?? canonical.description,
        imageUrl: node.imageUrl ?? canonical.imageUrl,
        imagePosition: node.imagePosition ?? canonical.imagePosition,
      }
    })
  }

  const constraints = publishedOnly
    ? [where('subjectId', '==', subjectId), where('status', '==', 'published')]
    : [where('subjectId', '==', subjectId), orderBy('order')]
  const snap = await getDocs(query(collection(db, 'contentNodes'), ...constraints))
  const sharedNodes = snap.docs.map(d => mapNode(d.id, d.data())).sort((a, b) => a.order - b.order)
  if (countLessonNodes(sharedNodes) > 0) return sharedNodes

  return sharedNodes.length ? sharedNodes : courseNodes
}

export async function listSharedContentNodes(subjectId: string): Promise<ContentNode[]> {
  return listSubjectContentNodes(subjectId, false)
}

export async function createContentNode(input: { courseSubjectId:string; parentId?:string; type:ContentNodeType; title:string; description?:string; order:number; userId:string; sharedKey?:string }) {
  const { parentId, description, userId, sharedKey: key, ...rest } = input
  return addDoc(collection(db, 'contentNodes'), { ...rest, ...(parentId ? { parentId } : {}), ...(description ? { description } : {}), ...(key ? { sharedKey: key } : {}), status: 'draft', createdBy: userId, updatedBy: userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

/** Creates one canonical node for the Matière. It is not copied per concours. */
export async function createSharedContentNode(input: { subjectId: string; parentSharedKey?: string; type: ContentNodeType; title: string; description?: string; imageUrl?: string; imagePosition?: ContentNode['imagePosition']; order: number; userId: string }) {
  let parentId: string | undefined
  if (input.parentSharedKey) {
    const parentSnap = await getDocs(query(collection(db, 'contentNodes'), where('sharedKey', '==', input.parentSharedKey)))
    parentId = parentSnap.docs.find(item => item.data().subjectId === input.subjectId)?.id
  }
  const key = sharedKey('node')
  const ref = await addDoc(collection(db, 'contentNodes'), {
    subjectId: input.subjectId,
    ...(parentId ? { parentId } : {}),
    type: input.type,
    title: input.title.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.imageUrl?.trim() ? { imageUrl: input.imageUrl.trim() } : {}),
    ...(input.imagePosition ? { imagePosition: input.imagePosition } : {}),
    order: input.order,
    status: 'draft',
    sharedKey: key,
    createdBy: input.userId,
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { sharedKey: key, nodeIds: [ref.id] }
}

export async function updateContentNode(id:string,input:Partial<Pick<ContentNode,'title'|'description'|'order'|'status'|'parentId'|'type'>>,userId:string) {
  await updateDoc(doc(db,'contentNodes',id),{...input,updatedBy:userId,updatedAt:serverTimestamp()})
}

export async function updateSharedContentNode(key: string, input: Partial<Pick<ContentNode,'title'|'description'|'imageUrl'|'imagePosition'|'order'|'status'|'type'>>, userId: string) {
  const snap = await getDocs(query(collection(db, 'contentNodes'), where('sharedKey', '==', key)))
  const batch = writeBatch(db)
  snap.docs.forEach(item => batch.update(item.ref, { ...input, updatedBy: userId, updatedAt: serverTimestamp() }))
  await batch.commit()
}


export async function getStudentLessonContent(courseId: string, nodeId: string): Promise<ContentBlock[]> {
  const callable = httpsCallable<{ courseId: string; nodeId: string }, { nodeId: string; blocks: ContentBlock[] }>(
    getFirebaseFunctions(),
    'getStudentLessonContent',
  )
  const response = await callable({ courseId, nodeId })
  return response.data.blocks.sort((a: ContentBlock, b: ContentBlock) => a.order - b.order)
}

export async function listContentBlocks(nodeId:string, publishedOnly = false):Promise<ContentBlock[]> {
  const constraints = publishedOnly
    ? [where('nodeId', '==', nodeId), where('status', '==', 'published')]
    : [where('nodeId', '==', nodeId), orderBy('order')]
  const snap=await getDocs(query(collection(db,'contentBlocks'), ...constraints))
  return snap.docs.map(d=>mapBlock(d.id,d.data())).sort((a, b) => a.order - b.order)
}

export async function createContentBlock(input:{nodeId:string;type:ContentBlockType;order:number;content:Record<string,unknown>;media?:ContentBlock['media'];userId:string;sharedKey?:string}) {
  return addDoc(collection(db,'contentBlocks'),{...input,status:'draft',createdBy:input.userId,updatedBy:input.userId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
}

export async function createSharedContentBlock(input:{nodeSharedKey:string;type:ContentBlockType;order:number;content:Record<string,unknown>;media?:ContentBlock['media'];userId:string}) {
  const nodes = await getDocs(query(collection(db, 'contentNodes'), where('sharedKey', '==', input.nodeSharedKey)))
  if (nodes.empty) throw new Error('Leçon partagée introuvable.')
  const key = sharedKey('block')
  const batch = writeBatch(db)
  nodes.docs.forEach(node => {
    const ref = doc(collection(db, 'contentBlocks'))
    batch.set(ref, { nodeId: node.id, type: input.type, order: input.order, content: input.content, ...(input.media ? { media: input.media } : {}), status: 'draft', sharedKey: key, createdBy: input.userId, updatedBy: input.userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
  await batch.commit()
  return key
}

export async function updateContentBlock(id:string,input:Partial<Pick<ContentBlock,'content'|'media'|'settings'|'order'|'status'|'type'>>,userId:string) {
  await updateDoc(doc(db,'contentBlocks',id),{...input,updatedBy:userId,updatedAt:serverTimestamp()})
}

export async function updateSharedContentBlock(key: string, input: Partial<Pick<ContentBlock,'content'|'media'|'settings'|'order'|'status'|'type'>>, userId: string) {
  const snap = await getDocs(query(collection(db, 'contentBlocks'), where('sharedKey', '==', key)))
  const batch = writeBatch(db)
  snap.docs.forEach(item => batch.update(item.ref, { ...input, updatedBy: userId, updatedAt: serverTimestamp() }))
  await batch.commit()
}

export async function deleteContentBlock(id: string) { await deleteDoc(doc(db, 'contentBlocks', id)) }
export async function deleteSharedContentBlock(key: string) {
  const snap = await getDocs(query(collection(db, 'contentBlocks'), where('sharedKey', '==', key)))
  const batch = writeBatch(db); snap.docs.forEach(item => batch.delete(item.ref)); await batch.commit()
}

export async function deleteContentNode(id: string) {
  const blocks = await getDocs(query(collection(db, 'contentBlocks'), where('nodeId', '==', id)))
  const batch = writeBatch(db); blocks.docs.forEach(item => batch.delete(item.ref)); batch.delete(doc(db, 'contentNodes', id)); await batch.commit()
}

export async function deleteSharedContentNode(key: string) {
  const nodes = await getDocs(query(collection(db, 'contentNodes'), where('sharedKey', '==', key)))
  const blocksPerNode = await Promise.all(nodes.docs.map(node => getDocs(query(collection(db, 'contentBlocks'), where('nodeId', '==', node.id)))))
  const batch = writeBatch(db)
  blocksPerNode.forEach(snapshot => snapshot.docs.forEach(item => batch.delete(item.ref)))
  nodes.docs.forEach(item => batch.delete(item.ref))
  await batch.commit()
}


function countLessonNodes(nodes: ContentNode[]): number {
  const children = nodes.filter((node) => Boolean(node.parentId));
  return children.length ? children.length : nodes.filter((node) => node.type !== 'topic').length
}

/** Counts the published lessons visible to a student for one course. Course-linked
 * content is checked first; reusable subject content is used when the association
 * has no legacy content. This keeps the student count aligned with the admin view. */
export async function countPublishedCourseLessons(courseId: string, subjects?: CourseSubject[]): Promise<number> {
  const courseSubjects = subjects ?? await listCourseSubjects(courseId, true)
  let total = 0
  for (const association of courseSubjects) {
    const nodes = await listCourseSubjectContentNodes(association.id, association.subjectId, true)
    total += countLessonNodes(nodes)
  }
  return total
}
