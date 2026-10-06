export type SubjectStatus = 'draft' | 'published' | 'archived'

export interface Subject {
  id: string
  name: string
  matricule: string
  niveau: string
  description: string
  status: SubjectStatus
  createdBy: string
  updatedBy: string
  createdAt?: Date
  updatedAt?: Date
}
