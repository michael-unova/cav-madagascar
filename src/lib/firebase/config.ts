import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { browserAuthDomainEnv, resolveAuthDomain } from './authDomain'

// On the custom domain, falls back to <projectId>.firebaseapp.com when cav.mg does not
// serve Firebase's /__/auth pages (see ./authDomain.ts). Resolved once, before the app starts.
const authDomain = await resolveAuthDomain(
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  browserAuthDomainEnv(),
)

/**
 * Firebase client configuration.
 *
 * Values come exclusively from environment variables (see .env.example),
 * never hard-coded. The Firebase web config is not a secret in itself, but
 * it must still be injected through the build environment rather than
 * committed to source control, so that each deployment target (local,
 * staging, production) can point at its own Firebase project.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined

/**
 * Returns the singleton Firebase app instance, creating it on first use.
 * Lazy initialization keeps the app importable (and the project buildable)
 * even in environments where Firebase env vars are not yet configured.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  }
  return app
}
