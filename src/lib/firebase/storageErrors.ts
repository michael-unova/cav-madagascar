import { FirebaseError } from 'firebase/app'

/**
 * Maps Firebase Storage error codes to short, user-facing French messages,
 * mirroring `features/auth/authErrors.ts` and `firestoreErrors.ts`, so raw
 * Storage SDK error text is never shown in the interface.
 */
export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'storage/unauthorized':
        return "Vous n'avez pas les droits nécessaires pour effectuer cette action."
      case 'storage/canceled':
        return 'Le transfert a été annulé.'
      case 'storage/quota-exceeded':
        return "L'espace de stockage disponible est insuffisant. Contactez un administrateur."
      case 'storage/invalid-checksum':
      case 'storage/retry-limit-exceeded':
        return 'Le transfert a échoué. Vérifiez votre connexion, puis réessayez.'
      case 'storage/object-not-found':
        return "Le fichier demandé est introuvable. Il a peut-être été supprimé."
      case 'storage/unauthenticated':
        return 'Votre session a expiré. Veuillez vous reconnecter.'
      default:
        return "Le fichier n'a pas pu être transféré. Veuillez réessayer."
    }
  }

  return "Le fichier n'a pas pu être transféré. Veuillez réessayer."
}
