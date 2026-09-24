import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { getPublishedCourseBySlug, listPublishedCourseSubjects } from '../features/courses'
import type { Course, CourseSubject } from '../types/course'

export function CourseDetailsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [subjects, setSubjects] = useState<CourseSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return

    let active = true

    async function load() {
      try {
        const found = await getPublishedCourseBySlug(slug!)

        if (!found) {
          if (active) setError('Concours introuvable.')
          return
        }

        const courseSubjects = await listPublishedCourseSubjects(found.id)

        if (active) {
          setCourse(found)
          setSubjects(courseSubjects)
        }
      } catch {
        if (active) setError('Impossible de charger cette préparation pour le moment.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return <Container className="page-container"><div className="catalogue-state">Chargement...</div></Container>
  }

  if (error || !course) {
    return (
      <Container className="page-container">
        <Card className="catalogue-empty">
          <h1>{error || 'Concours introuvable.'}</h1>
          <Link className="ui-button ui-button-primary" to="/courses">Retour au catalogue</Link>
        </Card>
      </Container>
    )
  }

  return (
    <Container className="page-container">
      <Link className="back-link" to="/courses">← Retour aux concours</Link>

      <section className="course-detail-hero">
        <div>
          <p className="eyebrow">Préparation au concours</p>
          <h1>{course.title}</h1>
          <p className="course-detail-description">{course.description}</p>
          <div className="course-detail-meta">
            <strong>{course.price.toLocaleString('fr-FR')} {course.currency}</strong>
            <span>Accès après validation de l'inscription</span>
          </div>
        </div>
        {course.thumbnailUrl && (
          <img className="course-detail-image" src={course.thumbnailUrl} alt="" />
        )}
      </section>

      <section className="course-subject-section">
        <div className="section-heading">
          <p className="eyebrow">Programme</p>
          <h2>Matières de la préparation</h2>
        </div>

        {subjects.length === 0 ? (
          <Card className="catalogue-empty">
            <p>Le programme détaillé sera publié prochainement.</p>
          </Card>
        ) : (
          <div className="subject-list">
            {subjects.map((subject, index) => (
              <Card key={subject.id} className="subject-card">
                <span className="subject-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{subject.title}</h3>
                  {subject.description && <p>{subject.description}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="enrollment-cta">
        <Card>
          <div>
            <p className="eyebrow">Prêt à commencer ?</p>
            <h2>Inscrivez-vous à cette préparation</h2>
            <p>La procédure d'inscription et de paiement sera disponible dans la prochaine phase.</p>
          </div>
          <Link className="ui-button ui-button-primary" to="/register">Créer un compte</Link>
        </Card>
      </section>
    </Container>
  )
}


