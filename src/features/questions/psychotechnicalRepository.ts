import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { PsychotechnicalAttempt, PsychotechnicalDomain, PsychotechnicalQuestion, PsychotechnicalQuestionSnapshot, PsychotechnicalTest, PsychotechnicalTestSettings } from '../../types/psychotechnical'

const db = getFirebaseFirestore()
const domains: PsychotechnicalDomain[] = ['logic', 'numerical', 'spatial', 'attention', 'memory', 'reaction']
const toDate = (v: unknown) => v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : undefined
const mapQuestion = (id: string, d: Record<string, unknown>): PsychotechnicalQuestion => ({
  id, domain: domains.includes(d.domain as PsychotechnicalDomain) ? d.domain as PsychotechnicalDomain : 'logic',
  type: (d.type ?? 'multiple_choice') as PsychotechnicalQuestion['type'], prompt: String(d.prompt ?? ''),
  imageUrl: typeof d.imageUrl === 'string' ? d.imageUrl : undefined,
  options: Array.isArray(d.options) ? d.options as PsychotechnicalQuestion['options'] : undefined,
  correctAnswer: d.correctAnswer, explanation: typeof d.explanation === 'string' ? d.explanation : undefined,
  difficulty: (d.difficulty ?? 'medium') as PsychotechnicalQuestion['difficulty'], points: Number(d.points ?? 1),
  status: (d.status ?? 'draft') as PsychotechnicalQuestion['status'], createdBy: String(d.createdBy ?? ''), updatedAt: toDate(d.updatedAt),
})
const mapTest = (id: string, d: Record<string, unknown>): PsychotechnicalTest => ({
  id, title: String(d.title ?? ''), description: String(d.description ?? ''), courseIds: Array.isArray(d.courseIds) ? d.courseIds.map(String) : [],
  distributions: Array.isArray(d.distributions) ? d.distributions as PsychotechnicalTest['distributions'] : [], questionIds: Array.isArray(d.questionIds) ? d.questionIds.map(String) : [],
  questions: Array.isArray(d.questions) ? d.questions as PsychotechnicalQuestionSnapshot[] : [],
  settings: (d.settings ?? { durationMinutes: 30, questionCount: 20, randomizeQuestions: true, randomizeOptions: true, showCorrections: true }) as PsychotechnicalTestSettings,
  status: (d.status ?? 'draft') as PsychotechnicalTest['status'], createdBy: String(d.createdBy ?? ''), updatedAt: toDate(d.updatedAt),
})

export async function listPsychotechnicalQuestions(domain?: PsychotechnicalDomain) {
  const snap = await getDocs(query(collection(db, 'psychotechnicalQuestions'), ...(domain ? [where('domain', '==', domain)] : [])))
  return snap.docs.map(d => mapQuestion(d.id, d.data())).sort((a, b) => a.prompt.localeCompare(b.prompt, 'fr'))
}
export async function createPsychotechnicalQuestion(input: Omit<PsychotechnicalQuestion, 'id'|'status'|'createdBy'|'updatedAt'> & { userId: string }) {
  const { userId, ...data } = input
  return addDoc(collection(db, 'psychotechnicalQuestions'), { ...data, status: 'draft', createdBy: userId, updatedAt: serverTimestamp() })
}
export async function updatePsychotechnicalQuestion(id: string, input: Partial<Omit<PsychotechnicalQuestion, 'id'|'createdBy'>>) { await updateDoc(doc(db, 'psychotechnicalQuestions', id), { ...input, updatedAt: serverTimestamp() }) }
export async function deletePsychotechnicalQuestion(id: string) { await deleteDoc(doc(db, 'psychotechnicalQuestions', id)) }

export async function listAdminPsychotechnicalTests() {
  const snap = await getDocs(collection(db, 'psychotechnicalTests'))
  return snap.docs.map(d => mapTest(d.id, d.data())).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}
export async function listPublishedPsychotechnicalTestsForCourse(courseId: string) {
  const snap = await getDocs(query(collection(db, 'psychotechnicalTests'), where('courseIds', 'array-contains', courseId), where('status', '==', 'published')))
  return snap.docs.map(d => mapTest(d.id, d.data())).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}
export async function getPsychotechnicalTest(id: string) { const snap = await getDoc(doc(db, 'psychotechnicalTests', id)); return snap.exists() ? mapTest(snap.id, snap.data()) : null }
export async function createPsychotechnicalTest(input: { title: string; description: string; courseIds: string[]; distributions: PsychotechnicalTest['distributions']; questionIds: string[]; settings: PsychotechnicalTestSettings; userId: string }) {
  const questions = await Promise.all(input.questionIds.map(id => getDoc(doc(db, 'psychotechnicalQuestions', id))))
  const snapshots = questions.filter(s => s.exists() && s.data()?.status === 'published').map(s => { const q = mapQuestion(s.id, s.data()!); return ({ id:q.id, domain:q.domain, type:q.type, prompt:q.prompt, ...(q.imageUrl ? {imageUrl:q.imageUrl}:{ }), ...(q.options ? {options:q.options}:{}), ...(q.explanation ? {explanation:q.explanation}:{}), points:q.points }) })
  if (!snapshots.length) throw new Error('Ajoutez au moins une question psychotechnique publiée.')
  const ref = await addDoc(collection(db, 'psychotechnicalTests'), { title:input.title.trim(), description:input.description.trim(), courseIds:input.courseIds, distributions:input.distributions, questionIds:snapshots.map(q=>q.id), questions:snapshots, settings:input.settings, status:'draft', createdBy:input.userId, updatedAt:serverTimestamp() })
  return ref.id
}
export async function updatePsychotechnicalTestStatus(id: string, status: PsychotechnicalTest['status']) { await updateDoc(doc(db, 'psychotechnicalTests', id), { status, updatedAt:serverTimestamp() }) }
export async function deletePsychotechnicalTest(id: string) { await deleteDoc(doc(db, 'psychotechnicalTests', id)) }

export async function listMyPsychotechnicalAttempts(userId: string) {
  const snap = await getDocs(query(collection(db, 'psychotechnicalAttempts'), where('userId', '==', userId)))
  return snap.docs.map(d => ({ id:d.id, ...d.data(), submittedAt:toDate(d.data().submittedAt) } as unknown as PsychotechnicalAttempt)).sort((a,b)=>(b.submittedAt?.getTime()??0)-(a.submittedAt?.getTime()??0))
}
