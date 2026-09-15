import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseApp } from './config'

let firestore: Firestore | undefined

/**
 * Returns the singleton Firestore instance.
 *
 * This is a foundation only: collection access, queries, and security-rule
 * backed reads/writes are implemented starting with Milestone 2 and the
 * milestones that introduce classes, courses, and lessons.
 */
export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp())
  }
  return firestore
}
