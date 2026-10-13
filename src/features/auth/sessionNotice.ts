export const SESSION_REPLACED_EVENT = 'cav:session-replaced'
export const SESSION_REPLACED_KEY = 'cav_session_replaced'

export function announceSessionReplaced() {
  try { window.sessionStorage.setItem(SESSION_REPLACED_KEY, '1') } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(SESSION_REPLACED_EVENT))
}
