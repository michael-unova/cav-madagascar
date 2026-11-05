export type CoursePaperStatus = 'draft' | 'published'

/**
 * A "Sujet type": a mock exam paper written by an admin in the rich lesson
 * editor, attached to one concours. It is a document, not a set of picked questions.
 */
export interface CoursePaper {
  id: string
  courseId: string
  /** The épreuve this Sujet type belongs to. Empty for papers created before épreuves existed. */
  groupId: string
  title: string
  description: string
  /** Optional time limit in minutes. */
  timeLimitMinutes: number | null
  /** Optional pass mark, as a percentage (0 to 100). */
  passMark: number | null
  status: CoursePaperStatus
  order: number
  /** Sanitized lesson HTML. Only returned to managers and to enrolled students on demand. */
  html: string
  createdBy: string
  updatedBy: string
  createdAt?: Date
  updatedAt?: Date
}

/**
 * An "épreuve" (for example EPREUVE MATHS or EPREUVE FRS): only a named group of
 * Sujets types inside one concours. It has no document of its own.
 */
export interface CoursePaperGroup {
  id: string
  courseId: string
  title: string
  status: CoursePaperStatus
  order: number
  createdBy: string
  updatedBy: string
  createdAt?: Date
  updatedAt?: Date
}

/** What a student sees in the list: everything except the document itself. */
export type CoursePaperSummary = Omit<CoursePaper, 'html' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>

export const DEFAULT_COURSE_PAPER_TITLE = 'Sujet type'

/** Student side: a published épreuve with its published Sujets types. */
export interface CoursePaperGroupSummary {
  id: string
  title: string
  order: number
  papers: CoursePaperSummary[]
}
