import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { getFirebaseApp } from '../lib/firebase/config'
import { getFirebaseAuth } from '../features/auth/firebaseAuth'
import { getPublicSiteUrl, isTrustedSiteUrl } from '../lib/siteUrl'

const auth = getFirebaseAuth(getFirebaseApp())

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A11.7 11.7 0 0 1 12 4.9c5.1 0 8.6 4.8 9.7 7.1-.5 1-1.4 2.4-2.7 3.6M6.2 6.2C3.9 7.9 2.5 10.1 2.3 12c.8 1.5 2.7 4.5 6.5 6.3 1 .5 2.1.8 3.2.8 1.3 0 2.5-.3 3.6-.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6.8 9.5-6.8S21.5 12 21.5 12 18 18.8 12 18.8 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
  )
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export function AuthActionPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const mode = params.get('mode')
  const oobCode = params.get('oobCode')
  const continueUrl = params.get('continueUrl')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function verify() {
      if (mode !== 'resetPassword' || !oobCode) {
        setError('Ce lien de réinitialisation est invalide ou incomplet.')
        setLoading(false)
        return
      }
      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode)
        if (!cancelled) setEmail(verifiedEmail)
      } catch {
        if (!cancelled) setError('Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void verify()
    return () => { cancelled = true }
  }, [mode, oobCode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!oobCode) return
    if (password.length < 6) {
      setError('Votre mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setSuccess(true)
    } catch (err) {
      const code = String((err as { code?: string })?.code ?? '')
      setError(code.includes('expired') || code.includes('invalid-action-code')
        ? 'Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation.'
        : 'Impossible de modifier le mot de passe pour le moment. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  function goToLogin() {
    const fallback = `${getPublicSiteUrl()}/?auth=login`
    // continueUrl comes from the query string: only follow it if it stays on our own domain.
    window.location.assign(continueUrl && isTrustedSiteUrl(continueUrl) ? continueUrl : fallback)
  }

  return (
    <main className="cav-auth-action-page">
      <div className="cav-auth-action-orb cav-auth-action-orb-one" />
      <div className="cav-auth-action-orb cav-auth-action-orb-two" />

      <section className="cav-auth-action-card" aria-labelledby="reset-title">
        <div className="cav-auth-action-logo-wrap">
          <img src="/assets/cav-logo.png" alt="CAV Madagascar" className="cav-auth-action-logo" />
        </div>

        {loading ? (
          <div className="cav-auth-action-state">
            <div className="cav-auth-action-spinner" aria-hidden="true" />
            <h1>Vérification du lien…</h1>
            <p>Nous vérifions votre demande de réinitialisation.</p>
          </div>
        ) : success ? (
          <div className="cav-auth-action-state">
            <div className="cav-auth-action-success-icon" aria-hidden="true">✓</div>
            <span className="cav-auth-action-kicker">MOT DE PASSE MIS À JOUR</span>
            <h1>Votre mot de passe a été modifié.</h1>
            <p>Vous pouvez maintenant vous connecter à votre espace CAV Madagascar avec votre nouveau mot de passe.</p>
            <button className="cav-auth-action-primary" onClick={goToLogin} type="button">
              Se connecter <ArrowIcon />
            </button>
          </div>
        ) : error ? (
          <div className="cav-auth-action-state">
            <div className="cav-auth-action-error-icon" aria-hidden="true">!</div>
            <span className="cav-auth-action-kicker">LIEN INDISPONIBLE</span>
            <h1>Impossible de réinitialiser le mot de passe.</h1>
            <div className="cav-auth-action-alert">{error}</div>
            <button className="cav-auth-action-primary" onClick={goToLogin} type="button">
              Retour à la connexion <ArrowIcon />
            </button>
          </div>
        ) : (
          <div>
            <span className="cav-auth-action-kicker">SÉCURITÉ DU COMPTE</span>
            <h1 id="reset-title">Réinitialisez votre mot de passe</h1>
            <p className="cav-auth-action-intro">Choisissez un nouveau mot de passe pour sécuriser votre compte CAV Madagascar.</p>

            <div className="cav-auth-action-email">
              <span>Compte</span>
              <strong>{email}</strong>
            </div>

            <form onSubmit={handleSubmit} className="cav-auth-action-form">
              <label>
                Nouveau mot de passe
                <div className="cav-auth-action-input-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}><EyeIcon hidden={!showPassword} /></button>
                </div>
              </label>
              <label>
                Confirmer le nouveau mot de passe
                <div className="cav-auth-action-input-wrap">
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}><EyeIcon hidden={!showConfirm} /></button>
                </div>
              </label>

              {error && <div className="cav-auth-action-alert" role="alert">{error}</div>}

              <button className="cav-auth-action-primary" disabled={submitting} type="submit">
                {submitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
                {!submitting && <ArrowIcon />}
              </button>
            </form>

            <p className="cav-auth-action-note">Pour votre sécurité, choisissez un mot de passe personnel que vous n’utilisez pas sur un autre site.</p>
          </div>
        )}

        <div className="cav-auth-action-footer">© 2026 CAV Madagascar · Préparation aux concours</div>
      </section>
    </main>
  )
}
