import type { DocumentData } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

export type ManageAction = 'suspend' | 'delete'

export function isAuthUserNotFound(error: unknown) {
  return (error as { code?: string } | null)?.code === 'auth/user-not-found'
}

/**
 * Who may suspend/delete whom:
 * - super_admin accounts are never touched through these actions;
 * - students can be managed by any admin (super_admin or content_manager);
 * - other staff (content_manager) can only be managed by a super_admin.
 */
export function assertCanManageTarget(actor: DocumentData, target: DocumentData, action: ManageAction) {
  if (target.role === 'super_admin') {
    throw new HttpsError('permission-denied', 'Un compte super administrateur ne peut pas être modifié ici.')
  }
  if (target.role !== 'student' && actor.role !== 'super_admin') {
    throw new HttpsError(
      'permission-denied',
      `Seul un super administrateur peut ${action === 'delete' ? 'supprimer' : 'suspendre'} un gestionnaire.`,
    )
  }
}
