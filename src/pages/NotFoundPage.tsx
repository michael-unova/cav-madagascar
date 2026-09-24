import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'

export function NotFoundPage() {
  return (
    <Container className="not-found">
      <p className="eyebrow">404</p>
      <h1>Page introuvable</h1>
      <p>La page demandée n’existe pas.</p>
      <Link className="ui-button ui-button-primary" to="/">Retour à l’accueil</Link>
    </Container>
  )
}
