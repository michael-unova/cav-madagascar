import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp } from './config'

let storage: FirebaseStorage | undefined

/**
 * Returns the singleton Firebase Storage instance, mirroring
 * `getFirebaseFirestore()` and `getFirebaseAuth()`. First used in
 * Milestone 4 for lesson videos and learning materials.
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp())
  }
  return storage
}
