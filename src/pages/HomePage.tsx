import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { listPublishedCourses } from '../features/courses'

export function HomePage() {
  const [preparationCount, setPreparationCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    listPublishedCourses()
      .then((courses) => { if (active) setPreparationCount(courses.length) })
      .catch(() => { if (active) setPreparationCount(null) })
    return () => { active = false }
  }, [])

  return <div className="redesign-public-home cav-public-home">
    <section className="cav-welcome-hero">
      <div className="cav-hero-decoration cav-hero-decoration-one" aria-hidden="true" />
      <div className="cav-hero-decoration cav-hero-decoration-two" aria-hidden="true" />
      <Container className="cav-welcome-inner">
        <div className="cav-welcome-copy">
          <p className="cav-welcome-eyebrow">Préparation aux concours</p>
          <h1>Préparez votre concours avec <em>CAV.</em></h1>
          <p className="cav-welcome-description">Une plateforme pensée pour vous accompagner de la première leçon jusqu’au jour du concours, avec des cours structurés, des entraînements et un suivi de progression.</p>
          <div className="cav-welcome-actions">
            <Link className="cav-welcome-primary" to="/courses">Découvrir les concours <span aria-hidden="true">→</span></Link>
            <Link className="cav-welcome-secondary" to="/about">Comment ça marche</Link>
          </div>
          <ul className="cav-welcome-benefits" aria-label="Avantages de CAV">
            <li>Cours structurés</li><li>Entraînements</li><li>Progression suivie</li>
          </ul>
        </div>
        <div className="cav-welcome-photo-wrap">
          <div className="cav-welcome-photo-backdrop" aria-hidden="true" />
          <img className="cav-welcome-photo" src="/assets/cav-home-student.jpg" alt="Une étudiante se concentre sur ses révisions avec CAV Madagascar" />
          <div className="cav-preparation-pill" aria-live="polite">
            <span className="cav-preparation-icon" aria-hidden="true">▤</span>
            <span>{preparationCount === null ? 'Découvrez nos préparations' : `${preparationCount} préparation${preparationCount > 1 ? 's' : ''} disponible${preparationCount > 1 ? 's' : ''}`}</span>
          </div>
        </div>
      </Container>
    </section>

    <section className="redesign-public-section cav-welcome-catalogue" id="concours">
      <Container>
        <div className="cav-catalogue-intro">
          <p className="cav-welcome-eyebrow">Nos préparations</p>
          <h2>Choisissez votre concours</h2>
          <p>Accédez aux préparations des concours officiels et avancez à votre rythme.</p>
        </div>
        <div className="redesign-feature-grid cav-welcome-feature-grid">
          <Card><span className="redesign-feature-icon" aria-hidden="true">▤</span><h3>Cours structurés</h3><p>Des matières et des leçons organisées pour vous aider à avancer étape par étape.</p></Card>
          <Card><span className="redesign-feature-icon" aria-hidden="true">✓</span><h3>Entraînez-vous</h3><p>Renforcez vos acquis avec des exercices et des tests d’entraînement.</p></Card>
          <Card><span className="redesign-feature-icon" aria-hidden="true">◷</span><h3>Suivez vos progrès</h3><p>Retrouvez votre parcours et poursuivez vos révisions à votre rythme.</p></Card>
        </div>
        <div className="cav-catalogue-action"><Link className="cav-welcome-secondary" to="/courses">Voir toutes les préparations <span aria-hidden="true">→</span></Link></div>
      </Container>
    </section>
  </div>
}
