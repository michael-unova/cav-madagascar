/**
 * Cloudflare Pages worker: serves Firebase Auth's helper pages from cav.mg.
 *
 * The app uses authDomain = cav.mg, so Google sign-in opens
 * https://cav.mg/__/auth/handler. Cloudflare Pages has no such file and would answer
 * with the website's catch-all page (index.html) instead of Google's sign-in, which
 * is what users saw in the popup. This worker forwards those paths to the
 * Firebase-hosted originals. It ships with every Pages deployment, so it does not
 * depend on a separately deployed Worker.
 *
 * public/_routes.json limits it to /__/* ; everything else is served as static
 * files exactly as before. Keep the proxy logic in sync with
 * cloudflare/firebase-auth-proxy/src/index.js (kept as an alternative deployment).
 */

const UPSTREAM_HOST = 'cav-madagascar-b4beb.firebaseapp.com'

const ALLOWED_PATHS = [/^\/__\/auth\//, /^\/__\/firebase\/init\.json$/]
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isProxiedPath(pathname) {
  return ALLOWED_PATHS.some((re) => re.test(pathname))
}

export async function proxyToFirebase(request, upstreamHost = UPSTREAM_HOST) {
  const url = new URL(request.url)

  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } })
  }

  const upstreamUrl = new URL(url.pathname + url.search, `https://${upstreamHost}`)

  const headers = new Headers(request.headers)
  headers.delete('cookie') // never leak cav.mg cookies to the upstream
  headers.set('x-forwarded-host', url.host)

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(upstreamResponse.headers)
  responseHeaders.delete('set-cookie')

  // Keep any redirect on cav.mg instead of exposing the firebaseapp.com host.
  const location = responseHeaders.get('location')
  if (location) {
    try {
      const target = new URL(location, upstreamUrl)
      if (target.host === upstreamHost) {
        target.protocol = url.protocol
        target.host = url.host
        responseHeaders.set('location', target.toString())
      }
    } catch {
      // leave malformed Location untouched
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (isProxiedPath(pathname)) return proxyToFirebase(request)
    // Anything else: serve the static site (and its SPA fallback) as usual.
    return env.ASSETS.fetch(request)
  },
}
