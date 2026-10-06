import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'

export function AccountSuspendedPage() {
  return <Container className="auth-container"><Card className="auth-card"><p className="eyebrow">Compte</p><h1>Compte suspendu</h1><p>Votre compte n’a actuellement pas accès à la plateforme. Si vous pensez qu’il s’agit d’une erreur, contactez l’administration de CAV Madagascar.</p><Link className="ui-button ui-button-primary" to="/">Retour à l’accueil</Link></Card></Container>
}
