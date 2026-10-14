/**
 * Canonical public origin of the web app (no trailing slash).
 *
 * Used for URLs that leave the app, such as the Firebase password-reset
 * `continueUrl`, so they always point at the official domain (cav.mg) instead
 * of whatever origin the app happens to run on (e.g. the Capacitor WebView at
 * https://localhost or a *.pages.dev preview). Override with VITE_PUBLIC_SITE_URL.
 * During local development (vite dev server) the current origin is used.
 */
const DEFAULT_PUBLIC_SITE_URL = 'https://cav.mg'

export function getPublicSiteUrl(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') return window.location.origin
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  return (configured || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, '')
}

/** True when `url` is an absolute http(s) URL on the public site or the current origin. */
export function isTrustedSiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const allowed = new Set([new URL(getPublicSiteUrl()).origin])
    if (typeof window !== 'undefined') allowed.add(window.location.origin)
    return allowed.has(parsed.origin)
  } catch {
    return false
  }
}
