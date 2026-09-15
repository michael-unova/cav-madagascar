/**
 * Converts a Firestore timestamp field into an ISO string.
 *
 * Documents written with `serverTimestamp()` briefly expose a null value in
 * the local snapshot before the server round-trip completes, so a fallback
 * is always required rather than optional.
 */
export function toIsoString(value: unknown, fallback: string = new Date().toISOString()): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate: () => Date }
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString()
    }
  }

  if (typeof value === 'string') {
    return value
  }

  return fallback
}
