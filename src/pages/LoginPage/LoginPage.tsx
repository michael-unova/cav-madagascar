import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card/Card'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { signIn } from '../../features/auth/authService'
import { getAuthErrorMessage } from '../../features/auth/authErrors'
import { paths } from '../../routes/paths'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await signIn(email, password)
      // DashboardRedirect resolves the correct role-specific dashboard, so
      // it is a safe default when the visitor did not come from a
      // specific protected page.
      navigate(from ?? paths.dashboard, { replace: true })
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <Card padding="lg" className={styles.card}>
        <h1 className={styles.title}>Se connecter</h1>
        <p className={styles.subtitle}>Accédez à vos classes, vos cours et votre progression.</p>

        {errorMessage && (
          <ErrorState
            title="Connexion impossible"
            description={errorMessage}
          />
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Adresse e-mail"
            type="email"
            icon="icon-mail"
            placeholder="vous@exemple.com"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Mot de passe"
            type="password"
            icon="icon-lock"
            placeholder="********"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
          </Button>
        </form>

        <p className={styles.footerText}>
          Pas encore de compte ?{' '}
          <Link to={paths.register} className={styles.link}>
            Créer un compte
          </Link>
        </p>
      </Card>
    </div>
  )
}
