/**
 * Chooses the Firebase `authDomain` at startup.
 *
 * Production uses the custom domain (cav.mg) so Google sign-in shows the official
 * address. That only works while cav.mg really serves Firebase's helper pages
 * (/__/auth/*, see docs/CUSTOM-AUTH-DOMAIN.md). If it does not (for example the
 * proxy is not deployed yet), Cloudflare answers with the website's home page and
 * the Google sign-in popup would show the home page instead of the sign-in.
 *
 * So when the app runs on the custom domain we first check that
 * /__/firebase/init.json is genuine Firebase JSON. If it is not, we fall back to
 * Firebase's own domain (<projectId>.firebaseapp.com), which always works.
 * On any other host (localhost, previews, the Android app) the configured value is used as is.
 */

const CACHE_KEY = 'cav:auth-domain-check'
const OK_TTL_MS = 60 * 60 * 1000 // a working proxy is re-checked hourly
const FAIL_TTL_MS = 60 * 1000 // a broken proxy is re-checked after a minute
const PROBE_TIMEOUT_MS = 3000

export interface AuthDomainEnv {
  hostname: string
  fetchFn: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  now?: () => number
}

interface CachedCheck {
  domain: string
  at: number
  ok: boolean
}

export async function isProxyServingFirebase(fetchFn: typeof fetch): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetchFn('/__/firebase/init.json', { cache: 'no-store', signal: controller.signal })
      if (!res.ok) return false
      if (!(res.headers.get('content-type') ?? '').includes('json')) return false
      const body = (await res.json()) as { apiKey?: unknown } | null
      return typeof body?.apiKey === 'string' && body.apiKey.length > 0
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

export async function resolveAuthDomain(
  configured: string | undefined,
  projectId: string | undefined,
  env: AuthDomainEnv,
): Promise<string | undefined> {
  if (!configured || !projectId) return configured
  // Only the custom domain depends on the proxy. Anywhere else, use the configured value.
  if (env.hostname !== configured) return configured

  const fallback = `${projectId}.firebaseapp.com`
  if (fallback === configured) return configured

  const now = env.now ?? Date.now
  try {
    const raw = env.storage?.getItem(CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw) as CachedCheck
      const ttl = cached.ok ? OK_TTL_MS : FAIL_TTL_MS
      if (cached.domain === configured && now() - cached.at < ttl) return cached.ok ? configured : fallback
    }
  } catch {
    // ignore unreadable cache
  }

  const ok = await isProxyServingFirebase(env.fetchFn)
  try {
    env.storage?.setItem(CACHE_KEY, JSON.stringify({ domain: configured, at: now(), ok } satisfies CachedCheck))
  } catch {
    // storage unavailable (private mode): fine, just re-check next time
  }
  return ok ? configured : fallback
}

export function browserAuthDomainEnv(): AuthDomainEnv {
  let storage: Storage | undefined
  try {
    storage = window.sessionStorage
  } catch {
    storage = undefined
  }
  return { hostname: window.location.hostname, fetchFn: window.fetch.bind(window), storage }
}
