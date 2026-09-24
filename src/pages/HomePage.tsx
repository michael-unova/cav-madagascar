import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <Container className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Préparation aux concours à Madagascar</p>
            <h1>Préparez votre concours avec une méthode claire et structurée.</h1>
            <p className="hero-description">
              CAV Madagascar rassemble cours, entraînements, questions et simulations
              d’examen dans une seule plateforme.
            </p>
            <div className="hero-actions">
              <Link className="ui-button ui-button-primary" to="/courses">Découvrir les concours</Link>
              <Link className="ui-button ui-button-secondary" to="/register">Créer un compte</Link>
            </div>
          </div>

          <Card className="hero-card">
            <p className="eyebrow">Votre préparation</p>
            <h2>Apprendre. S’entraîner. Simuler.</h2>
            <ul className="feature-list">
              <li>Des cours organisés par concours et matière</li>
              <li>Des exercices et questions pour progresser</li>
              <li>Des simulations pour vous préparer à l’épreuve</li>
            </ul>
          </Card>
        </Container>
      </section>

      <section className="section">
        <Container>
          <div className="section-heading">
            <p className="eyebrow">La plateforme</p>
            <h2>Tout ce qu’il faut pour préparer votre concours</h2>
          </div>
          <div className="feature-grid">
            <Card><h3>Cours structurés</h3><p>Retrouvez vos contenus organisés par concours et par matière.</p></Card>
            <Card><h3>Entraînement</h3><p>Pratiquez avec des questions, exercices et quiz adaptés à votre préparation.</p></Card>
            <Card><h3>Suivi de progression</h3><p>Suivez votre avancement et reprenez votre préparation là où vous vous êtes arrêté.</p></Card>
          </div>
        </Container>
      </section>
    </>
  )
}
