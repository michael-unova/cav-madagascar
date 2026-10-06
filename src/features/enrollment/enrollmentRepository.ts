import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from '../../lib/firebase/functions'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { Enrollment, Payment, PaymentMethod } from '../../types/enrollment'

const db = getFirebaseFirestore()
const date = (v: unknown) => v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : undefined

export async function submitPayment(input: { userId: string; courseId: string; amount: number; reference: string; method: PaymentMethod }) {
  return addDoc(collection(db, 'payments'), { ...input, reference: input.reference.trim(), currency: 'MGA', status: 'pending', submittedAt: serverTimestamp() })
}

export async function listMyEnrollments(userId: string): Promise<Enrollment[]> {
  // Keep this query on the single userId field. Sorting client-side avoids a
  // composite-index dependency that can otherwise make the whole student
  // dashboard look empty when the index has not been deployed yet.
  const s = await getDocs(query(collection(db, 'enrollments'), where('userId', '==', userId)))
  return s.docs
    .map(d => ({ id: d.id, userId: String(d.data().userId), courseId: String(d.data().courseId), paymentId: String(d.data().paymentId), status: (d.data().status ?? 'pending') as Enrollment['status'], enrolledAt: date(d.data().enrolledAt), expiresAt: date(d.data().expiresAt), approvedBy: typeof d.data().approvedBy === 'string' ? d.data().approvedBy : undefined, approvedAt: date(d.data().approvedAt) }))
    .sort((a, b) => (b.enrolledAt?.getTime() ?? 0) - (a.enrolledAt?.getTime() ?? 0))
}


export async function hasPendingPayment(userId: string, courseId: string): Promise<boolean> {
  const snapshot = await getDocs(query(collection(db, 'payments'), where('userId', '==', userId), where('courseId', '==', courseId), where('status', '==', 'pending')))
  return !snapshot.empty
}

export async function listPendingPayments(): Promise<Payment[]> {
  const s = await getDocs(query(collection(db, 'payments'), where('status', '==', 'pending'), orderBy('submittedAt', 'desc')))
  return s.docs.map(d => ({ id: d.id, userId: String(d.data().userId), courseId: String(d.data().courseId), amount: Number(d.data().amount ?? 0), currency: 'MGA', method: (d.data().method ?? 'mvola') as PaymentMethod, reference: String(d.data().reference ?? ''), status: 'pending', submittedAt: date(d.data().submittedAt) }))
}

export async function listAllPayments(): Promise<Payment[]> {
  const s = await getDocs(collection(db, 'payments'))
  return s.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      userId: String(data.userId ?? ''),
      courseId: String(data.courseId ?? ''),
      amount: Number(data.amount ?? 0),
      currency: 'MGA' as const,
      method: (data.method ?? 'mvola') as PaymentMethod,
      reference: String(data.reference ?? ''),
      status: (data.status ?? 'pending') as Payment['status'],
      submittedAt: date(data.submittedAt),
      verifiedBy: typeof data.verifiedBy === 'string' ? data.verifiedBy : undefined,
      verifiedAt: date(data.verifiedAt),
      rejectionReason: typeof data.rejectionReason === 'string' ? data.rejectionReason : undefined,
    }
  }).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
}

export async function reviewPayment(input: { paymentId: string; approved: boolean; rejectionReason?: string }) {
  const review = httpsCallable<
    { paymentId: string; approved: boolean; rejectionReason?: string },
    { success: boolean; paymentId: string; enrollmentId: string | null; status: Payment['status'] }
  >(getFirebaseFunctions(), 'reviewPayment')
  return review(input)
}

export async function getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
  const id = `${userId}_${courseId}`
  const snapshot = await getDoc(doc(db, 'enrollments', id))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return { id: snapshot.id, userId: String(data.userId), courseId: String(data.courseId), paymentId: String(data.paymentId), status: (data.status ?? 'pending') as Enrollment['status'], enrolledAt: date(data.enrolledAt), expiresAt: date(data.expiresAt), approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : undefined, approvedAt: date(data.approvedAt) }
}
