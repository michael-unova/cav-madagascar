import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'

type Props = { mode: 'login' | 'register' }

export function AuthPlaceholderPage({ mode }: Props) {
  const register = mode === 'register'
  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <p className="eyebrow">CAV Madagascar</p>
        <h1>{register ? 'Créer un compte' : 'Se connecter'}</h1>
        <p>
          {register
            ? 'La création de compte sera activée pendant la phase Authentification.'
            : 'La connexion sera activée pendant la phase Authentification.'}
        </p>
        <Link className="ui-button ui-button-primary" to={register ? '/login' : '/register'}>
          {register ? 'Continuer vers la connexion' : 'Créer un compte'}
        </Link>
      </Card>
    </Container>
  )
}
