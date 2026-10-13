import { useEffect, useRef, useState } from 'react'
import { SESSION_REPLACED_EVENT, SESSION_REPLACED_KEY } from '../features/auth/sessionNotice'

function wasReplaced() {
  try { return window.sessionStorage.getItem(SESSION_REPLACED_KEY) === '1' } catch { return false }
}

function clearFlag() {
  try { window.sessionStorage.removeItem(SESSION_REPLACED_KEY) } catch { /* storage unavailable */ }
}

export function SessionReplacedNotice() {
  const [open, setOpen] = useState(wasReplaced)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(SESSION_REPLACED_EVENT, show)
    return () => window.removeEventListener(SESSION_REPLACED_EVENT, show)
  }, [])

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    clearFlag()
    setOpen(false)
  }

  function signInAgain() {
    clearFlag()
    window.location.assign('/?auth=login')
  }

  if (!open) return null

  return <div className="cav-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="cav-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cav-session-title" aria-describedby="cav-session-description">
      <div className="cav-confirm-icon cav-confirm-icon-info" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4.5" width="12.5" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6.5 17.5h5.5M9.25 13.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="16.8" y="9" width="4.2" height="9.5" rx="1.3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
      <span className="cav-confirm-eyebrow cav-confirm-eyebrow-info">SÉCURITÉ DU COMPTE</span>
      <h2 id="cav-session-title">Session ouverte sur un autre appareil</h2>
      <p id="cav-session-description">
        Votre compte vient d’être connecté sur un autre appareil, vous avez donc été déconnecté de celui-ci.
        Un compte CAV ne peut être utilisé que sur <strong>un seul appareil à la fois</strong>.
        <span className="cav-confirm-hint">Si ce n’était pas vous, changez votre mot de passe après vous être reconnecté.</span>
      </p>
      <div className="cav-confirm-actions">
        <button type="button" className="cav-confirm-cancel" onClick={close}>Fermer</button>
        <button type="button" ref={primaryRef} className="cav-confirm-primary" onClick={signInAgain}>Se reconnecter</button>
      </div>
    </section>
  </div>
}
