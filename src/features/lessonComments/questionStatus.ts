import type { LessonComment } from '../../types/lessonComment'

export type QuestionStatus = 'new' | 'seen' | 'treated'

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = { new: 'Nouveau', seen: 'Vu', treated: 'Traité' }

export interface QuestionStatusInfo {
  status: QuestionStatus
  /** Names of the admins who opened the question, oldest first. */
  seenNames: string[]
}

/**
 * Status of every root question.
 * - Nouveau: some student message in the thread is still unread by admins.
 * - Traité: marked as treated and no student message arrived after that.
 * - Vu: read, but not treated (also covers questions read before statuses existed).
 */
export function buildQuestionStatuses(items: LessonComment[]): Record<string, QuestionStatusInfo> {
  const children = new Map<string, LessonComment[]>()
  for (const item of items) {
    if (!item.parentCommentId) continue
    const list = children.get(item.parentCommentId)
    if (list) list.push(item)
    else children.set(item.parentCommentId, [item])
  }

  const result: Record<string, QuestionStatusInfo> = {}
  for (const root of items) {
    if (root.parentCommentId) continue
    let hasUnread = false
    let latestStudentMs = 0
    const visited = new Set<string>()
    const stack: LessonComment[] = [root]
    while (stack.length) {
      const current = stack.pop() as LessonComment
      if (visited.has(current.id)) continue
      visited.add(current.id)
      if (current.authorRole === 'student') {
        if (current.unreadForAdmin) hasUnread = true
        latestStudentMs = Math.max(latestStudentMs, current.createdAt?.toMillis?.() ?? 0)
      }
      stack.push(...(children.get(current.id) ?? []))
    }

    const treatedMs = root.treatedAt?.toMillis?.() ?? Number.POSITIVE_INFINITY
    const status: QuestionStatus = hasUnread ? 'new' : root.treated && latestStudentMs <= treatedMs ? 'treated' : 'seen'
    const seenNames = Object.values(root.seenBy ?? {})
      .sort((a, b) => (a.at?.toMillis?.() ?? Number.MAX_SAFE_INTEGER) - (b.at?.toMillis?.() ?? Number.MAX_SAFE_INTEGER))
      .map(entry => entry.name)
    result[root.id] = { status, seenNames }
  }
  return result
}
