import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card/Card'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { paths } from '../../routes/paths'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Firebase Authentication sign-in is implemented in Milestone 2.
  // This handler is a UI foundation placeholder only.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <div className={styles.page}>
      <Card padding="lg" className={styles.card}>
        <h1 className={styles.title}>Se connecter</h1>
        <p className={styles.subtitle}>Accédez à vos classes, vos cours et votre progression.</p>

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
          <Button type="submit" fullWidth>
            Se connecter
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
