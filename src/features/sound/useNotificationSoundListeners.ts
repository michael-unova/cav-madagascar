import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useEffect } from 'react'
import { getFirebaseFirestore } from '../../lib/firebase/firestore'
import type { SoundKind } from './soundEngine'

export type SoundAudience = 'manager' | 'student'

type Notify = (key: string, kind: SoundKind) => void

// Documents older than this (relative to when the listener started) are never
// announced, even if Firestore reports them as "added" (e.g. a doc that just
// matched the query again).
const FRESH_WINDOW_MS = 2 * 60 * 1000

function isFresh(data: DocumentData, field: string, startedAt: number): boolean {
  const value = data[field] as { toMillis?: () => number } | null | undefined
  if (!value || typeof value.toMillis !== 'function') return true // pending server timestamp = brand new
  return value.toMillis() >= startedAt - FRESH_WINDOW_MS
}

function notificationKind(type: unknown): SoundKind {
  const t = String(type ?? '')
  if (t === 'broadcast') return 'announcement'
  if (t.startsWith('payment')) return 'payment'
  return 'message'
}

/**
 * Subscribes to the existing Firestore collections and calls notify() for
 * documents that arrive AFTER the listener is ready. The first snapshot (the
 * backlog) is never announced. All listeners are removed on cleanup (sign-out,
 * account switch, sound disabled, unmount).
 */
export function useNotificationSoundListeners(
  uid: string | null,
  audience: SoundAudience | null,
  active: boolean,
  notify: Notify,
) {
  useEffect(() => {
    if (!uid || !audience || !active) return
    const db = getFirebaseFirestore()
    const startedAt = Date.now()
    const unsubs: Array<() => void> = []

    function watchAdded(
      q: Query<DocumentData>,
      label: string,
      handle: (doc: QueryDocumentSnapshot<DocumentData>) => { kind: SoundKind } | null,
    ) {
      let ready = false
      unsubs.push(onSnapshot(q, snapshot => {
        if (!ready) {
          // Ignore the backlog; a cache-only first snapshot is followed by the server one.
          if (!snapshot.metadata.fromCache) ready = true
          return
        }
        snapshot.docChanges().forEach(change => {
          if (change.type !== 'added') return
          if (change.doc.metadata.hasPendingWrites) return // our own write
          const result = handle(change.doc)
          if (result) notify(`${uid}:${label}:${change.doc.id}`, result.kind)
        })
      }, error => console.error(`Sound listener (${label}) failed:`, error)))
    }

    if (audience === 'manager') {
      watchAdded(query(collection(db, 'contactMessages'), where('status', '==', 'unread')), 'contactMessage', doc =>
        isFresh(doc.data(), 'createdAt', startedAt) ? { kind: 'message' } : null)

      watchAdded(
        query(collection(db, 'lessonComments'), where('unreadForAdmin', '==', true), where('authorRole', '==', 'student')),
        'studentQuestion',
        doc => {
          const data = doc.data()
          if (data.userId === uid) return null
          return isFresh(data, 'createdAt', startedAt) ? { kind: 'question' } : null
        },
      )

      watchAdded(query(collection(db, 'payments'), where('status', '==', 'pending')), 'paymentPending', doc =>
        isFresh(doc.data(), 'submittedAt', startedAt) ? { kind: 'payment' } : null)
    } else {
      // Student: replies, payment confirmations and official announcements all
      // arrive through the existing `notifications` collection.
      watchAdded(query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false)), 'notification', doc => {
        const data = doc.data()
        if (data.actorUserId === uid) return null
        return isFresh(data, 'createdAt', startedAt) ? { kind: notificationKind(data.type) } : null
      })

      // Rejected payments do not create a notification document, so watch the
      // student's own payments for a pending -> rejected transition.
      const statuses = new Map<string, string>()
      let ready = false
      unsubs.push(onSnapshot(query(collection(db, 'payments'), where('userId', '==', uid)), snapshot => {
        if (!ready) {
          snapshot.docs.forEach(d => statuses.set(d.id, String(d.data().status ?? '')))
          if (!snapshot.metadata.fromCache) ready = true
          return
        }
        snapshot.docChanges().forEach(change => {
          const status = String(change.doc.data().status ?? '')
          const previous = statuses.get(change.doc.id)
          statuses.set(change.doc.id, status)
          if (change.type === 'removed' || change.doc.metadata.hasPendingWrites) return
          if (previous === 'pending' && status === 'rejected') notify(`${uid}:paymentRejected:${change.doc.id}`, 'payment')
        })
      }, error => console.error('Sound listener (payments) failed:', error)))
    }

    return () => unsubs.forEach(unsubscribe => unsubscribe())
  }, [uid, audience, active, notify])
}
