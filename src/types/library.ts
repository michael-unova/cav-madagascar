export type LibraryBookType = 'pdf' | 'link'
export type LibraryVisibility = 'public' | 'enrolled'

export interface LibraryBook {
  id: string
  title: string
  author: string
  description: string
  category: string
  type: LibraryBookType
  coverUrl: string
  resourceUrl: string
  keywords: string[]
  visibility: LibraryVisibility
  courseIds?: string[]
  courseId?: string
  status: 'draft' | 'published'
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface CreateLibraryBookInput {
  title: string
  author: string
  description: string
  category: string
  type: LibraryBookType
  coverUrl: string
  resourceUrl: string
  keywords: string[]
  visibility: LibraryVisibility
  courseIds?: string[]
  courseId?: string
  userId: string
}
