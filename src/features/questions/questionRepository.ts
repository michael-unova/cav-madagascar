import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { PracticeAttempt, PracticeQuestionSnapshot, Question, QuestionSet, QuestionSetType, QuestionType, QuestionDifficulty } from '../../types/question'

const db = getFirebaseFirestore()

function toDate(value: unknown): Date | undefined {
  return value && typeof value === 'object' && 'toDate' in value ? (value as { toDate: () => Date }).toDate() : undefined
}

function mapQuestion(id: string, data: Record<string, unknown>): Question {
  return {
    id,
    type: (data.type ?? 'multiple_choice') as QuestionType,
    questionContent: (data.questionContent ?? {}) as Record<string, unknown>,
    options: Array.isArray(data.options) ? data.options as Question['options'] : undefined,
    correctAnswer: data.correctAnswer,
    explanation: typeof data.explanation === 'string' ? data.explanation : undefined,
    difficulty: (data.difficulty ?? 'medium') as QuestionDifficulty,
    points: Number(data.points ?? 1),
    courseId: typeof data.courseId === 'string' ? data.courseId : undefined,
    courseSubjectId: typeof data.courseSubjectId === 'string' ? data.courseSubjectId : undefined,
    subjectId: String(data.subjectId ?? ''),
    contentNodeId: typeof data.contentNodeId === 'string' ? data.contentNodeId : undefined,
    status: (data.status ?? 'draft') as Question['status'],
    createdBy: String(data.createdBy ?? ''),
    updatedAt: toDate(data.updatedAt),
  }
}

function mapQuestionSet(id: string, data: Record<string, unknown>): QuestionSet {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    questionIds: Array.isArray(data.questionIds) ? data.questionIds.map(String) : [],
    questions: Array.isArray(data.questions) ? data.questions as PracticeQuestionSnapshot[] : [],
    courseId: typeof data.courseId === 'string' ? data.courseId : undefined,
    courseSubjectId: typeof data.courseSubjectId === 'string' ? data.courseSubjectId : undefined,
    subjectId: String(data.subjectId ?? ''),
    type: (data.type ?? 'practice') as QuestionSetType,
    settings: data.settings && typeof data.settings === 'object' ? data.settings as QuestionSet['settings'] : undefined,
    status: (data.status ?? 'draft') as QuestionSet['status'],
    createdBy: String(data.createdBy ?? ''),
    updatedAt: toDate(data.updatedAt),
  }
}

function mapAttempt(id: string, data: Record<string, unknown>): PracticeAttempt {
  return { id, userId: String(data.userId ?? ''), courseId: String(data.courseId ?? ''), questionSetId: String(data.questionSetId ?? ''), answers: Array.isArray(data.answers) ? data.answers as PracticeAttempt['answers'] : [], earnedPoints: Number(data.earnedPoints ?? 0), totalPoints: Number(data.totalPoints ?? 0), percentage: Number(data.percentage ?? 0), pendingManualCount: Number(data.pendingManualCount ?? 0), submittedAt: toDate(data.submittedAt) }
}

export async function listAdminQuestions(subjectId = ''): Promise<Question[]> {
  const constraints = subjectId ? [where('subjectId', '==', subjectId)] : []
  const snapshot = await getDocs(query(collection(db, 'questions'), ...constraints))
  return snapshot.docs.map(item => mapQuestion(item.id, item.data())).sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
}

export async function listPublishedQuestionsForLesson(contentNodeId: string): Promise<Question[]> {
  if (!contentNodeId) return []
  const snapshot = await getDocs(query(
    collection(db, 'questions'),
    where('contentNodeId', '==', contentNodeId),
    where('status', '==', 'published'),
  ))
  return snapshot.docs
    .map(item => mapQuestion(item.id, item.data()))
    .sort((a, b) => (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0))
}

export async function getQuestion(questionId: string): Promise<Question | null> {
  const snapshot = await getDoc(doc(db, 'questions', questionId))
  return snapshot.exists() ? mapQuestion(snapshot.id, snapshot.data()) : null
}

export async function createQuestion(input: {
  subjectId: string
  contentNodeId?: string
  type: QuestionType
  questionContent: Record<string, unknown>
  options?: Question['options']
  correctAnswer?: unknown
  explanation?: string
  difficulty: QuestionDifficulty
  points: number
  userId: string
}) {
  const { explanation, ...rest } = input
  return addDoc(collection(db, 'questions'), {
    ...rest,
    ...(explanation?.trim() ? { explanation: explanation.trim() } : {}),
    status: 'draft',
    createdBy: input.userId,
    updatedAt: serverTimestamp(),
  })
}

export async function updateQuestion(questionId: string, input: Partial<Pick<Question, 'subjectId' | 'courseId' | 'courseSubjectId' | 'contentNodeId' | 'type' | 'questionContent' | 'options' | 'correctAnswer' | 'explanation' | 'difficulty' | 'points' | 'status'>>) {
  await updateDoc(doc(db, 'questions', questionId), { ...input, updatedAt: serverTimestamp() })
}

export async function deleteQuestion(questionId: string): Promise<void> { await deleteDoc(doc(db, 'questions', questionId)) }

export async function listAdminQuestionSets(subjectId = ''): Promise<QuestionSet[]> {
  const constraints = subjectId ? [where('subjectId', '==', subjectId)] : []
  const snapshot = await getDocs(query(collection(db, 'questionSets'), ...constraints))
  return snapshot.docs.map(item => mapQuestionSet(item.id, item.data())).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function listPublishedPracticeSets(subjectId: string): Promise<QuestionSet[]> {
  const snapshot = await getDocs(query(collection(db, 'questionSets'), where('subjectId', '==', subjectId), where('status', '==', 'published')))
  return snapshot.docs.map(item => mapQuestionSet(item.id, item.data())).filter(item => ['practice', 'exercise', 'quiz'].includes(item.type)).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function listPublishedImportantQuestionSets(subjectId: string): Promise<QuestionSet[]> {
  const snapshot = await getDocs(query(collection(db, 'questionSets'), where('subjectId', '==', subjectId), where('status', '==', 'published')))
  return snapshot.docs.map(item => mapQuestionSet(item.id, item.data())).filter(item => item.type === 'important_questions').sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export async function getPublishedPracticeSet(setId: string): Promise<QuestionSet | null> {
  const snapshot = await getDoc(doc(db, 'questionSets', setId))
  if (!snapshot.exists()) return null
  const set = mapQuestionSet(snapshot.id, snapshot.data())
  return set.status === 'published' && ['practice', 'exercise', 'quiz'].includes(set.type) ? set : null
}

export async function createQuestionSet(input: { title: string; description: string; subjectId: string; questionIds: string[]; type: QuestionSetType; settings?: QuestionSet['settings']; userId: string }): Promise<string> {
  const questions = await Promise.all(input.questionIds.map(id => getQuestion(id)))
  const snapshots: PracticeQuestionSnapshot[] = questions
    .filter((q): q is Question => Boolean(q && q.status === 'published' && q.subjectId === input.subjectId))
    .map(q => ({
      id: q.id,
      type: q.type,
      questionContent: q.questionContent,
      ...(q.options ? { options: q.options } : {}),
      ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
      points: q.points,
    }))
  if (snapshots.length === 0) throw new Error('Sélectionnez au moins une question publiée de cette matière.')
  const ref = await addDoc(collection(db, 'questionSets'), { title: input.title.trim(), description: input.description.trim(), subjectId: input.subjectId, questionIds: snapshots.map(q => q.id), questions: snapshots, type: input.type, ...(input.settings ? { settings: input.settings } : {}), status: 'draft', createdBy: input.userId, updatedAt: serverTimestamp() })
  return ref.id
}

/** Backward-compatible helper for old data. */
export async function createPracticeSet(input: { title: string; description: string; courseId: string; courseSubjectId: string; questionIds: string[]; userId: string }): Promise<string> {
  const questions = await Promise.all(input.questionIds.map(id => getQuestion(id)))
  const first = questions.find(Boolean)
  if (!first?.subjectId) throw new Error('La question sélectionnée n’est associée à aucune matière.')
  return createQuestionSet({ title: input.title, description: input.description, subjectId: first.subjectId, questionIds: input.questionIds, type: 'practice', userId: input.userId })
}

export async function updateQuestionSetStatus(setId: string, status: QuestionSet['status']): Promise<void> { await updateDoc(doc(db, 'questionSets', setId), { status, updatedAt: serverTimestamp() }) }
export async function deleteQuestionSet(setId: string): Promise<void> { await deleteDoc(doc(db, 'questionSets', setId)) }

export async function listMyPracticeAttempts(userId: string): Promise<PracticeAttempt[]> {
  const snapshot = await getDocs(query(collection(db, 'practiceAttempts'), where('userId', '==', userId)))
  return snapshot.docs.map(item => mapAttempt(item.id, item.data())).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
}
