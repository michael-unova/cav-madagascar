import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card/Card'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { cn } from '../../utils/cn'
import { paths } from '../../routes/paths'
import styles from './RegisterPage.module.css'

type RegisterRole = 'student' | 'teacher'

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<RegisterRole>('student')

  // Firebase Authentication account creation is implemented in Milestone 2.
  // This handler is a UI foundation placeholder only.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <div className={styles.page}>
      <Card padding="lg" className={styles.card}>
        <h1 className={styles.title}>Créer un compte</h1>
        <p className={styles.subtitle}>Rejoignez Nova Études pour enseigner ou pour apprendre.</p>

        <div className={styles.roleToggle} role="radiogroup" aria-label="Je suis">
          <button
            type="button"
            role="radio"
            aria-checked={role === 'student'}
            className={cn(styles.roleOption, role === 'student' && styles.roleOptionActive)}
            onClick={() => setRole('student')}
          >
            Étudiant
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={role === 'teacher'}
            className={cn(styles.roleOption, role === 'teacher' && styles.roleOptionActive)}
            onClick={() => setRole('teacher')}
          >
            Enseignant
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Nom complet"
            type="text"
            icon="icon-user"
            placeholder="Prénom et nom"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
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
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" fullWidth>
            Créer mon compte
          </Button>
        </form>

        <p className={styles.footerText}>
          Déjà inscrit ?{' '}
          <Link to={paths.login} className={styles.link}>
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  )
}
