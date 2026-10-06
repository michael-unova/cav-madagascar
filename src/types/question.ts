export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'numeric' | 'written'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type QuestionSetType = 'question_bank' | 'important_questions' | 'practice' | 'exercise' | 'quiz'

export interface QuestionOption {
  id: string
  label: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  questionContent: Record<string, unknown>
  options?: QuestionOption[]
  correctAnswer?: unknown
  explanation?: string
  difficulty: QuestionDifficulty
  points: number
  courseId?: string
  courseSubjectId?: string
  subjectId: string
  contentNodeId?: string
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  updatedAt?: Date
}

export interface PracticeQuestionSnapshot {
  id: string
  type: QuestionType
  questionContent: Record<string, unknown>
  options?: QuestionOption[]
  explanation?: string
  points: number
}

export interface QuestionSetSettings {
  showScore: boolean
  showCorrections: boolean
  showExplanations: boolean
  showPoints: boolean
  allowRetry: boolean
  passingScore?: number
}

export interface QuestionSet {
  id: string
  title: string
  description: string
  questionIds: string[]
  questions: PracticeQuestionSnapshot[]
  courseId?: string
  courseSubjectId?: string
  subjectId: string
  type: QuestionSetType
  settings?: QuestionSetSettings
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  updatedAt?: Date
}

export interface PracticeAnswer {
  questionId: string
  answer: unknown
}

export interface PracticeAttempt {
  id: string
  userId: string
  courseId: string
  questionSetId: string
  answers: PracticeAnswer[]
  earnedPoints: number
  totalPoints: number
  percentage: number
  pendingManualCount: number
  submittedAt?: Date
}
