import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { getAuthErrorMessage, resetPassword } from '../features/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!email.trim()) {
      setError('Veuillez renseigner votre adresse e-mail.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(email)
      setMessage('Si un compte correspond à cette adresse, un e-mail de réinitialisation a été envoyé.')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <p className="eyebrow">Compte CAV</p>
        <h1>Mot de passe oublié</h1>
        <p className="auth-intro">Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.</p>

        {error && <div className="form-error" role="alert">{error}</div>}
        {message && <div className="form-success" role="status">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Adresse e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button className="ui-button ui-button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>

        <p className="auth-switch"><Link to="/login">← Retour à la connexion</Link></p>
      </Card>
    </Container>
  )
}
