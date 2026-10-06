import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'

export function AdminUnauthorizedPage() {
  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <p className="eyebrow">Administration</p>
        <h1>Accès refusé</h1>
        <p>Ce compte ne possède pas les droits nécessaires pour accéder à l’administration.</p>
        <Link className="ui-button ui-button-primary" to="/">Retour au site</Link>
      </Card>
    </Container>
  )
}
