import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { NotificationSoundContext, type NotificationSoundValue } from './soundContext'
import { isAudioSupported, playNotificationTone, unlockAudio, type SoundKind } from './soundEngine'
import { readSoundPreference, writeSoundPreference } from './soundPreference'
import { useNotificationSoundListeners, type SoundAudience } from './useNotificationSoundListeners'

const MIN_GAP_MS = 600 // never stack several sounds on top of each other
const MAX_REMEMBERED = 500
const TOAST_MS = 3200

/**
 * Mounted once, inside AuthProvider. Owns the sound preference, the Firestore
 * listeners that trigger sounds, and exposes them through context so the
 * « Paramètres » page can let users switch sounds on or off.
 */
export function NotificationSoundProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const uid = user?.uid ?? null
  const role = typeof profile?.role === 'string' ? profile.role : null
  const status = typeof profile?.status === 'string' ? profile.status : null

  const audience: SoundAudience | null =
    status !== 'active' ? null : role === 'super_admin' || role === 'content_manager' ? 'manager' : role === 'student' ? 'student' : null

  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const enabled = uid ? (prefs[uid] ?? readSoundPreference(uid)) : false
  const [toast, setToast] = useState<string | null>(null)

  const toastTimer = useRef<number | undefined>(undefined)
  const played = useRef<Set<string>>(new Set())
  const lastPlayedAt = useRef(0)
  const enabledRef = useRef(enabled)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  // Different account => forget what was announced for the previous one.
  useEffect(() => { played.current.clear() }, [uid])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  // Stable callback: identical notification keys never play twice, whatever
  // re-renders or listener re-initialisations happen.
  const notify = useCallback((key: string, kind: SoundKind) => {
    if (!enabledRef.current) return
    if (played.current.has(key)) return
    played.current.add(key)
    if (played.current.size > MAX_REMEMBERED) {
      const oldest = played.current.values().next().value
      if (oldest !== undefined) played.current.delete(oldest)
    }
    const now = Date.now()
    if (now - lastPlayedAt.current < MIN_GAP_MS) return
    lastPlayedAt.current = now
    playNotificationTone(kind)
  }, [])

  useNotificationSoundListeners(uid, audience, enabled, notify)

  // After a reload the preference is restored but the browser has locked audio
  // again: unlock it on the first interaction anywhere in the page.
  useEffect(() => {
    if (!uid || !enabled) return
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
    const unlock = () => {
      void unlockAudio()
      events.forEach(name => window.removeEventListener(name, unlock))
    }
    events.forEach(name => window.addEventListener(name, unlock, { passive: true }))
    return () => events.forEach(name => window.removeEventListener(name, unlock))
  }, [uid, enabled])

  const setEnabled = useCallback((next: boolean) => {
    if (!uid) return
    writeSoundPreference(uid, next)
    setPrefs(current => ({ ...current, [uid]: next }))
  }, [uid])

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false)
      showToast('Son désactivé. Vous ne recevrez plus de signal sonore.')
      return
    }
    if (!isAudioSupported()) {
      showToast('Votre navigateur ne permet pas de jouer des sons.')
      return
    }
    // Runs inside the click handler, so the browser allows audio from now on.
    const unlocked = await unlockAudio()
    if (!unlocked) {
      showToast('Le navigateur bloque le son. Vérifiez le volume ou les autorisations du site.')
      return
    }
    setEnabled(true)
    playNotificationTone('test')
    showToast('Son activé. Un signal sonore vous préviendra des nouveautés.')
  }, [enabled, setEnabled, showToast])

  const test = useCallback(async () => {
    const unlocked = await unlockAudio()
    if (!unlocked) {
      showToast('Impossible de jouer le son. Vérifiez le volume de votre appareil.')
      return
    }
    playNotificationTone('test')
    showToast('Son de test joué. Si vous ne l’entendez pas, vérifiez le volume.')
  }, [showToast])

  const value = useMemo<NotificationSoundValue>(
    () => ({ enabled, message: toast, toggle: () => void toggle(), test: () => void test() }),
    [enabled, toast, toggle, test],
  )

  return <NotificationSoundContext.Provider value={value}>{children}</NotificationSoundContext.Provider>
}
