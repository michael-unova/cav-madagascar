export type ContentNodeType = 'topic' | 'chapter' | 'section' | 'subsection'
export type ContentStatus = 'draft' | 'published' | 'archived'
export type ContentNumberingStyle = 'alpha' | 'numeric' | 'hierarchical' | 'roman'
export type ContentBlockType = 'text' | 'video' | 'image' | 'file' | 'quiz' | 'exercise' | 'question'

export interface ContentNode {
  id: string
  courseSubjectId?: string
  subjectId?: string
  parentId?: string
  type: ContentNodeType
  title: string
  description?: string
  imageUrl?: string
  imagePosition?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  order: number
  /** Numbering format shared by sibling nodes at the same curriculum level. */
  numberingStyle?: ContentNumberingStyle
  /** For topics: 'archived' means hidden from students on purpose (its lessons are hidden with it). */
  status: ContentStatus
  /** Set on lessons that were hidden because their topic was hidden, so publishing the topic restores them. */
  hiddenWithTopic?: boolean
  createdBy: string
  updatedBy: string
  /** Stable identifier shared by every course association using the same reusable subject content. */
  sharedKey?: string
}

export interface ContentBlock {
  id: string
  nodeId: string
  type: ContentBlockType
  order: number
  content: Record<string, unknown>
  media?: { url?: string; thumbnailUrl?: string; duration?: number }
  settings?: Record<string, unknown>
  status: ContentStatus
  createdBy: string
  updatedBy: string
  /** Stable identifier shared by every course association using the same reusable subject content. */
  sharedKey?: string
}
