import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp } from './config'

let storage: FirebaseStorage | undefined

/**
 * Returns the singleton Firebase Storage instance.
 *
 * Feature-specific storage paths and access rules are defined
 * separately by the CAV application.
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp())
  }
  return storage
}
