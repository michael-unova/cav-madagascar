import { getFunctions } from 'firebase/functions'
import { getFirebaseApp } from './config'

let functionsInstance: ReturnType<typeof getFunctions> | undefined

export function getFirebaseFunctions() {
  if (!functionsInstance) functionsInstance = getFunctions(getFirebaseApp(), 'africa-south1')
  return functionsInstance
}
