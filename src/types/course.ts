export type CourseStatus = 'draft' | 'published' | 'archived'

export interface Course {
  id: string
  title: string
  slug: string
  description: string
  thumbnailUrl?: string
  price: number
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
  description?: string
  order: number
  status: CourseStatus
}
