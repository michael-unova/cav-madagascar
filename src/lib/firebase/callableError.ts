/**
 * Turns a Firebase callable-function error into a message safe to show an admin.
 * Our functions throw HttpsError with a French sentence; transport/internal
 * failures only carry a bare code such as "internal" or "NOT_FOUND", which we
 * replace with the caller's fallback.
 */
export function callableErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''
  const code = String((error as { code?: string } | null)?.code ?? '')
  if (code === 'functions/unauthenticated') return 'Votre session a expiré. Reconnectez-vous puis réessayez.'
  if (message.includes(' ')) return message
  return fallback
}
