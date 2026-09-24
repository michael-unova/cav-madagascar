import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth, logoutUser } from '../features/auth'

export function DashboardPage() {
  const { user, profile } = useAuth()
  const displayName = typeof profile?.displayName === 'string'
    ? profile.displayName
    : user?.displayName || 'Étudiant'

  return (
    <Container className="page-container">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Espace étudiant</p>
          <h1>Bonjour, {displayName}</h1>
          <p className="page-description">Votre espace personnel sera enrichi avec les cours, votre progression et vos entraînements.</p>
        </div>
        <button
          className="ui-button ui-button-secondary"
          onClick={() => void logoutUser()}
        >
          Se déconnecter
        </button>
      </div>

      <div className="feature-grid">
        <Card>
          <h3>Mes préparations</h3>
          <p>Vos concours et inscriptions apparaîtront ici.</p>
          <Link className="text-link" to="/courses">Découvrir les concours →</Link>
        </Card>
        <Card>
          <h3>Ma progression</h3>
          <p>Le suivi de vos cours et entraînements sera disponible dans une prochaine phase.</p>
        </Card>
        <Card>
          <h3>Mon compte</h3>
          <p>{user?.email}</p>
        </Card>
      </div>
    </Container>
  )
}
