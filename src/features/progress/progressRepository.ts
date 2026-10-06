import { doc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { LearningProgress } from '../../types/progress'
import { listCourseSubjects, listSubjectContentNodes } from '../curriculum'

const db = getFirebaseFirestore()

function toDate(value: unknown): Date | undefined {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : undefined
}

function mapProgress(id: string, data: Record<string, unknown>): LearningProgress {
  return {
    id,
    userId: String(data.userId ?? ''),
    courseId: String(data.courseId ?? ''),
    courseSubjectId: typeof data.courseSubjectId === 'string' ? data.courseSubjectId : undefined,
    nodeId: String(data.nodeId ?? ''),
    blockId: typeof data.blockId === 'string' ? data.blockId : undefined,
    completed: Boolean(data.completed),
    videoTimestampSeconds: typeof data.videoTimestampSeconds === 'number' ? data.videoTimestampSeconds : undefined,
    lastViewedAt: toDate(data.lastViewedAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function progressId(userId: string, courseId: string, nodeId: string) {
  return `${userId}_${courseId}_${nodeId}`
}

export async function getNodeProgress(userId: string, courseId: string, nodeId: string): Promise<LearningProgress | null> {
  // Query by ownership fields instead of reading a potentially non-existent
  // document by ID. The Firestore rules can safely authorize this query for
  // the signed-in owner, while a missing progress record simply returns null.
  const snap = await getDocs(query(
    collection(db, 'progress'),
    where('userId', '==', userId),
  ))
  const first = snap.docs.find(doc => {
    const data = doc.data()
    return data.courseId === courseId && data.nodeId === nodeId
  })
  return first ? mapProgress(first.id, first.data()) : null
}

export async function saveNodeProgress(input: {
  userId: string
  courseId: string
  courseSubjectId: string
  nodeId: string
  blockId?: string
  completed?: boolean
  videoTimestampSeconds?: number
}) {
  const ref = doc(db, 'progress', progressId(input.userId, input.courseId, input.nodeId))
  await setDoc(ref, {
    userId: input.userId,
    courseId: input.courseId,
    courseSubjectId: input.courseSubjectId,
    nodeId: input.nodeId,
    ...(input.blockId ? { blockId: input.blockId } : {}),
    ...(typeof input.completed === 'boolean' ? { completed: input.completed } : {}),
    ...(typeof input.videoTimestampSeconds === 'number' ? { videoTimestampSeconds: input.videoTimestampSeconds } : {}),
    lastViewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function listMyProgress(userId: string): Promise<LearningProgress[]> {
  const snap = await getDocs(query(collection(db, 'progress'), where('userId', '==', userId)))
  return snap.docs.map(d => mapProgress(d.id, d.data()))
}

export async function getCourseProgressSummary(userId: string, courseId: string) {
  const [subjects, progress] = await Promise.all([
    listCourseSubjects(courseId, true),
    listMyProgress(userId),
  ])
  const nodesPerSubject = await Promise.all(subjects.map(subject => listSubjectContentNodes(subject.subjectId, true)))
  const lessonNodesPerSubject = nodesPerSubject.map(nodes => {
    const children = nodes.filter(node => node.parentId)
    return children.length ? children : nodes.filter(node => !node.parentId && node.type !== 'topic')
  })
  const lessonNodeIds = new Set(lessonNodesPerSubject.flat().map(node => node.id))
  const totalLessons = lessonNodeIds.size
  const courseProgress = progress.filter(item => item.courseId === courseId)
  const completedLessons = courseProgress.filter(item => item.completed && lessonNodeIds.has(item.nodeId)).length
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)
  const lastViewed = courseProgress
    .filter(item => item.lastViewedAt)
    .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))[0]

  return { totalLessons, completedLessons, percent, lastViewed }
}

export * from '../../types/progress'
