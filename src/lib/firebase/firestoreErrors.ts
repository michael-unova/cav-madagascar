/**
 * Maps Firestore error codes to French, user-facing messages, mirroring
 * `features/auth/authErrors.ts` so raw SDK text is never shown in the
 * interface.
 */
const messages: Record<string, string> = {
  'permission-denied': "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
  unauthenticated: 'Votre session a expiré. Veuillez vous reconnecter.',
  unavailable: 'Le service est momentanément indisponible. Vérifiez votre connexion, puis réessayez.',
  'deadline-exceeded': 'La demande a pris trop de temps. Veuillez réessayer.',
  'not-found': "L'élément demandé est introuvable.",
  'already-exists': 'Cet élément existe déjà.',
  cancelled: 'La demande a été interrompue. Veuillez réessayer.',
  'resource-exhausted': 'Trop de demandes ont été envoyées. Patientez un instant, puis réessayez.',
}

const DEFAULT_MESSAGE = "L'opération n'a pas pu aboutir. Veuillez réessayer."

export function getFirestoreErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code).replace(/^firestore\//, '')
    if (code in messages) {
      return messages[code]
    }
  }

  return fallback
}
