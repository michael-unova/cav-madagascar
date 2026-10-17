// The branded loading screen is for the first visit only. If this browser opened CAV in the
// last 30 minutes (for example a menu link opened in a new tab), a small spinner is used instead.
// The key is also read by the inline script in index.html (quiet first paint): keep them in sync.
const KEY = 'cav_last_visit_at'
const QUIET_MS = 30 * 60 * 1000

export function isRecentVisit(now = Date.now()): boolean {
  try {
    const last = Number(window.localStorage.getItem(KEY))
    return Number.isFinite(last) && last > 0 && now - last < QUIET_MS
  } catch {
    return false
  }
}

export function markVisit(now = Date.now()) {
  try {
    window.localStorage.setItem(KEY, String(now))
  } catch {
    // storage unavailable: the full loading screen simply shows each time
  }
}
