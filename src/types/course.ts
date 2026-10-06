export type CourseStatus = 'draft' | 'published' | 'archived'
export type CourseCardColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal' | 'indigo' | 'pink' | 'amber' | 'cyan' | 'slate' | 'rose'

export interface CourseGroup {
  id: string
  title: string
  description: string
  cardColor: CourseCardColor
  status: CourseStatus
  createdBy: string
  updatedBy: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Course {
  id: string
  title: string
  slug: string
  description: string
  thumbnailUrl?: string
  groupId?: string | null
  cardColor: CourseCardColor
  price: number
  accessDurationDays: number
  currency: 'MGA'
  status: CourseStatus
  createdBy: string
  updatedBy: string
  createdAt?: Date
  updatedAt?: Date
  publishedAt?: Date
}

export interface CourseSubject {
  id: string
  courseId: string
  subjectId: string
  title: string
  matricule?: string
  niveau?: string
  description?: string
  order: number
  status: CourseStatus
}
