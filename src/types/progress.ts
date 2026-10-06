export interface LearningProgress {
  id: string
  userId: string
  courseId: string
  courseSubjectId?: string
  nodeId: string
  blockId?: string
  completed: boolean
  videoTimestampSeconds?: number
  lastViewedAt?: Date
  updatedAt?: Date
}

export interface Bookmark {
  id: string
  userId: string
  courseId: string
  nodeId?: string
  blockId?: string
  createdAt?: Date
}

export interface UserNote {
  id: string
  userId: string
  courseId: string
  nodeId?: string
  blockId?: string
  content: string
  updatedAt?: Date
}
