import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseApp } from './config'

let firestore: Firestore | undefined

/**
 * Returns the singleton Firestore instance.
 *
 * Feature-specific collections, queries, and authorization are defined
 * separately by the CAV application.
 */
export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp())
  }
  return firestore
}
