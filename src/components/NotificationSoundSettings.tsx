import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../features/auth'
import { getFirebaseFirestore } from '../lib/firebase/firestore'

const STORAGE_KEY = 'cav-notification-sounds-enabled-v1'
const SOUND_EVENTS = new Set(['message', 'contact_message', 'question', 'student_question', 'payment', 'payment_confirmed', 'payment_approved', 'broadcast', 'announcement', 'annonce'])

function playSoftNotificationSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  try {
    const context = new AudioContextClass()
    void context.resume().then(() => {
      const now = context.currentTime
      const master = context.createGain()
      master.gain.setValueAtTime(0.0001, now)
      master.gain.exponentialRampToValueAtTime(0.12, now + 0.025)
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
      master.connect(context.destination)
      ;[880, 1174.66].forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.09)
        gain.gain.setValueAtTime(0.0001, now + index * 0.09)
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.55 : 0.35, now + index * 0.09 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.2)
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start(now + index * 0.09)
        oscillator.stop(now + index * 0.09 + 0.22)
      })
      window.setTimeout(() => { void context.close().catch(() => undefined) }, 700)
    }).catch(() => undefined)
  } catch {
    // Audio is optional; browser autoplay or device restrictions must not break the app.
  }
}

function isSupportedNotification(data: Record<string, unknown>) {
  const values = [data.type, data.category, data.title].map(value => String(value ?? '').toLocaleLowerCase('fr'))
  return values.some(value => SOUND_EVENTS.has(value) || /message|question|paiement|payment|annonce|broadcast/.test(value))
}

export function NotificationSoundSettings() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })
  const [showSettings, setShowSettings] = useState(false)
  const initializedForUser = useRef<string | null>(null)
  const knownIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      initializedForUser.current = null
      knownIds.current = new Set()
      return
    }
    const db = getFirebaseFirestore()
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid))
    initializedForUser.current = null
    knownIds.current = new Set()
    return onSnapshot(q, snapshot => {
      if (initializedForUser.current !== user.uid) {
        snapshot.docs.forEach(item => knownIds.current.add(item.id))
        initializedForUser.current = user.uid
        return
      }
      let shouldPlay = false
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added' || knownIds.current.has(change.doc.id)) return
        knownIds.current.add(change.doc.id)
        if (isSupportedNotification(change.doc.data())) shouldPlay = true
      })
      if (enabled && shouldPlay) playSoftNotificationSound()
    }, error => console.warn('Notifications sonores indisponibles', error))
  }, [user, enabled])

  const setSoundEnabled = useCallback((next: boolean) => {
    setEnabled(next)
    try { window.localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* Storage may be unavailable in private mode. */ }
    if (next) playSoftNotificationSound()
  }, [])

  if (!user) return null

  return <div className="cav-notification-sound" aria-label="Réglages du son des notifications">
    {showSettings && <div className="cav-notification-sound-panel" role="dialog" aria-label="Réglages des notifications sonores">
      <strong>Son des notifications</strong>
      <p>Un son discret pour les nouveaux messages, questions, paiements et annonces.</p>
      <button type="button" className="cav-sound-primary" onClick={() => setSoundEnabled(!enabled)}>{enabled ? 'Désactiver le son' : 'Activer les sons'}</button>
      <button type="button" className="cav-sound-secondary" onClick={playSoftNotificationSound}>Tester le son</button>
      <small>Le navigateur peut demander une interaction avant d’autoriser le son.</small>
    </div>}
    <button type="button" className={`cav-notification-sound-toggle${enabled ? ' is-enabled' : ''}`} aria-expanded={showSettings} aria-label="Réglages du son des notifications" onClick={() => setShowSettings(value => !value)}>
      <span aria-hidden="true">{enabled ? '🔔' : '🔕'}</span><span>{enabled ? 'Son activé' : 'Activer le son'}</span>
    </button>
  </div>
}
