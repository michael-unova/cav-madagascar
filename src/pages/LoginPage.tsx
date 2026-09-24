import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { getAuthErrorMessage, loginUser } from '../features/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre e-mail et votre mot de passe.')
      return
    }

    setSubmitting(true)
    try {
      await loginUser(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from || '/dashboard', { replace: true })
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
        <h1>Se connecter</h1>
        <p className="auth-intro">Accédez à votre espace de préparation.</p>

        {error && <div className="form-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Adresse e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <button className="ui-button ui-button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <Link className="auth-link" to="/forgot-password">Mot de passe oublié ?</Link>
        <p className="auth-switch">Vous n’avez pas encore de compte ? <Link to="/register">Créer un compte</Link></p>
      </Card>
    </Container>
  )
}
