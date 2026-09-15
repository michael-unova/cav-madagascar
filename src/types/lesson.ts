export interface Lesson {
  id: string
  courseId: string
  title: string
  description?: string
  videoUrl?: string
  order: number
  createdAt: string
}
