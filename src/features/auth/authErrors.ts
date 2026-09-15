import { FirebaseError } from 'firebase/app'

/**
 * Maps Firebase Authentication error codes to short, user-facing French
 * messages. Unknown or unexpected errors fall back to a generic message
 * rather than leaking raw Firebase error text into the interface.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Adresse e-mail ou mot de passe incorrect.'
      case 'auth/invalid-email':
        return "L'adresse e-mail saisie n'est pas valide."
      case 'auth/email-already-in-use':
        return 'Un compte existe déjà avec cette adresse e-mail.'
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 8 caractères.'
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez réessayer dans quelques instants.'
      case 'auth/network-request-failed':
        return 'Problème de connexion. Vérifiez votre réseau et réessayez.'
      default:
        return 'Une erreur est survenue. Veuillez réessayer.'
    }
  }

  return 'Une erreur est survenue. Veuillez réessayer.'
}
