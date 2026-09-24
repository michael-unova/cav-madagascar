import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const examples = [
  { title: 'Inspecteur de police', description: 'Préparation structurée aux différentes épreuves du concours.' },
  { title: 'Commissaire', description: 'Un parcours de préparation organisé par matières et contenus.' },
  { title: 'Comptabilité', description: 'Cours et entraînements pour renforcer vos connaissances.' },
]

export function CoursesPage() {
  return (
    <Container className="page-container">
      <PageHeader
        eyebrow="Catalogue"
        title="Concours disponibles"
        description="Découvrez les préparations proposées par CAV Madagascar."
      />
      <div className="course-grid">
        {examples.map((course) => (
          <Card key={course.title} className="course-card">
            <span className="course-badge">Préparation</span>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
            <Link className="text-link" to="/register">Voir la préparation →</Link>
          </Card>
        ))}
      </div>
      <p className="catalogue-note">
        Le catalogue sera entièrement administrable depuis la plateforme dans les prochaines phases.
      </p>
    </Container>
  )
}
