/**
 * Firebase Auth helper proxy for cav.mg
 *
 * Firebase Auth serves its sign-in helper pages (/__/auth/handler, /__/auth/iframe,
 * /__/auth/*.js) from the project's `authDomain`. By default that is
 * cav-madagascar-b4beb.firebaseapp.com, which is what users see in the Google
 * sign-in popup. Setting authDomain to cav.mg only works if cav.mg serves those
 * same paths, so this Worker (bound to cav.mg/__/auth/* and cav.mg/__/firebase/*)
 * forwards them to the Firebase-hosted originals.
 *
 * Everything else on cav.mg (the Cloudflare Pages site, email DNS) is untouched:
 * the Worker only runs on the routes listed in wrangler.toml.
 */

const DEFAULT_UPSTREAM = 'cav-madagascar-b4beb.firebaseapp.com'

const ALLOWED_PATHS = [/^\/__\/auth\//, /^\/__\/firebase\/init\.json$/]
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isProxiedPath(pathname) {
  return ALLOWED_PATHS.some(re => re.test(pathname))
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url)

  if (!isProxiedPath(url.pathname)) {
    // Not ours: let the request continue to the normal origin (Cloudflare Pages).
    return fetch(request)
  }
  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } })
  }

  const upstreamHost = env.UPSTREAM_HOST || DEFAULT_UPSTREAM
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
  fetch: (request, env) => handleRequest(request, env),
}
