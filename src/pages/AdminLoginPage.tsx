import type { FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { getAuthErrorMessage, loginUser, logoutUser } from '../features/auth'
import { getAdminRole } from '../features/admin'

export function AdminLoginPage() {
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
      const user = await loginUser(email, password)
      const role = await getAdminRole(user.uid)
      if (!role) {
        await logoutUser()
        setError('Ce compte n’a pas accès à l’administration.')
        return
      }
      const from = (location.state as { from?: string } | null)?.from
      navigate(from || '/admin', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <p className="eyebrow">Administration CAV</p>
        <h1>Connexion administrateur</h1>
        <p className="auth-intro">Accédez à l’espace de gestion de la plateforme.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Adresse e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <button className="ui-button ui-button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Accéder à l’administration'}
          </button>
        </form>
        <p className="auth-switch"><Link to="/">← Retour au site</Link></p>
      </Card>
    </Container>
  )
}
