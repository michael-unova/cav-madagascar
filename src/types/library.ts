export type LibraryBookType = 'pdf' | 'link'

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
  userId: string
}
