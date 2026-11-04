export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'numeric' | 'written'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
/** `exam_paper` is a "Sujet type": a mock exam of one concours that combines questions from all its matières. */
export type QuestionSetType = 'question_bank' | 'important_questions' | 'practice' | 'exercise' | 'quiz' | 'exam_paper'

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
  /** Exam papers only: the matière the question belongs to, so the paper can be shown and scored per matière. */
  subjectId?: string
  subjectTitle?: string
}

export interface QuestionSetSettings {
  showScore: boolean
  showCorrections: boolean
  showExplanations: boolean
  showPoints: boolean
  allowRetry: boolean
  passingScore?: number
  /** Exam papers only: time limit in minutes. Absent means no time limit. */
  durationMinutes?: number
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
  /** Chapter (topic node) this quiz or exercise is placed in. Optional: older sets have none. */
  contentNodeId?: string
  /** Student app only: shared key of the chapter, so the placement still matches course-linked copies of the chapter. */
  contentNodeSharedKey?: string
  /** Position inside the chapter's unified content list (shared numeric space with lessons and tests). */
  contentOrder?: number
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
  /** Exam papers only: the score obtained in each matière. */
  subjectResults?: SubjectResult[]
  submittedAt?: Date
}

export interface SubjectResult {
  subjectId: string
  title: string
  earnedPoints: number
  totalPoints: number
  percentage: number
}
