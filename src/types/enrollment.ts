export type PaymentStatus = 'pending' | 'verified' | 'rejected'
export type EnrollmentStatus = 'pending' | 'active' | 'expired' | 'revoked'

export type PaymentMethod = 'mvola' | 'orange_money' | 'airtel_money'

export interface Payment {
  id: string
  userId: string
  courseId: string
  amount: number
  currency: 'MGA'
  method: PaymentMethod
  reference: string
  status: PaymentStatus
  submittedAt?: Date
  verifiedBy?: string
  verifiedAt?: Date
  rejectionReason?: string
}

export interface Enrollment {
  id: string
  userId: string
  courseId: string
  paymentId: string
  status: EnrollmentStatus
  enrolledAt?: Date
  expiresAt?: Date
  approvedBy?: string
  approvedAt?: Date
}
