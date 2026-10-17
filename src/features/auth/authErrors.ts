export function getAuthErrorMessage(error: unknown): string {
  const code = error instanceof Error && 'code' in error
    ? String((error as Error & { code?: string }).code)
    : ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà utilisée.'
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.'
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.'
    case 'auth/account-suspended':
      return 'Ce compte est suspendu. Contactez l’administration.'
    case 'functions/resource-exhausted':
      return 'Trop de demandes. Réessayez dans quelques minutes.'
    case 'functions/invalid-argument':
      return 'Adresse e-mail invalide.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez réessayer plus tard.'
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion internet.'
    case 'auth/popup-closed-by-user':
      return 'La fenêtre Google a été fermée. Vous pouvez réessayer.'
    case 'auth/popup-blocked':
      return 'Votre navigateur a bloqué la fenêtre Google. Autorisez les fenêtres pop-up puis réessayez.'
    case 'auth/cancelled-popup-request':
      return 'Une autre fenêtre de connexion est déjà ouverte. Fermez-la puis réessayez.'
    case 'auth/unauthorized-domain':
      return 'Ce site n’est pas autorisé pour la connexion Google. Contactez l’administration.'
    case 'auth/operation-not-supported-in-this-environment':
      return 'La connexion Google n’est pas disponible dans ce navigateur. Utilisez votre e-mail et mot de passe.'
    case 'auth/internal-error':
      return 'Erreur interne de connexion Google. Veuillez réessayer dans un instant.'
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Votre profil n’a pas pu être créé (permissions). Contactez l’administration.'
    case 'auth/operation-not-allowed':
      return 'La connexion Google n’est pas encore activée pour CAV.'
    default:
      return 'Une erreur est survenue. Veuillez réessayer.'
  }
}
