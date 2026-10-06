export type PsychotechnicalDomain = 'logic' | 'numerical' | 'spatial' | 'attention' | 'memory' | 'reaction'
export type PsychotechnicalQuestionType = 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer'

export interface PsychotechnicalOption { id: string; text: string }

export interface PsychotechnicalQuestion {
  id: string
  domain: PsychotechnicalDomain
  type: PsychotechnicalQuestionType
  prompt: string
  imageUrl?: string
  options?: PsychotechnicalOption[]
  correctAnswer: unknown
  explanation?: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  updatedAt?: Date
}

export interface PsychotechnicalQuestionSnapshot {
  id: string
  domain: PsychotechnicalDomain
  type: PsychotechnicalQuestionType
  prompt: string
  imageUrl?: string
  options?: PsychotechnicalOption[]
  explanation?: string
  points: number
}

export interface PsychotechnicalDistribution {
  domain: PsychotechnicalDomain
  count: number
}

export interface PsychotechnicalTestSettings {
  durationMinutes: number
  questionCount: number
  randomizeQuestions: boolean
  randomizeOptions: boolean
  showCorrections: boolean
}

export interface PsychotechnicalTest {
  id: string
  title: string
  description: string
  courseIds: string[]
  distributions: PsychotechnicalDistribution[]
  questionIds: string[]
  questions: PsychotechnicalQuestionSnapshot[]
  settings: PsychotechnicalTestSettings
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  updatedAt?: Date
}

export interface PsychotechnicalAttempt {
  id: string
  userId: string
  testId: string
  courseId: string
  answers: Array<{ questionId: string; answer: unknown }>
  earnedPoints: number
  totalPoints: number
  percentage: number
  domainResults: Record<string, { earned: number; total: number; percentage: number }>
  durationSeconds: number
  submittedAt?: Date
}

export const PSYCHOTECHNICAL_DOMAIN_LABELS: Record<PsychotechnicalDomain, string> = {
  logic: 'Logique', numerical: 'Numérique', spatial: 'Spatial', attention: 'Attention', memory: 'Mémoire', reaction: 'Vitesse / réaction',
}
