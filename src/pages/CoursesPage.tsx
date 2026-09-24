import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { PageHeader } from '../components/ui/PageHeader'
import { listPublishedCourses } from '../features/courses'
import type { Course } from '../types/course'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    listPublishedCourses()
      .then((items) => {
        if (active) setCourses(items)
      })
      .catch(() => {
        if (active) setError('Impossible de charger les concours pour le moment.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <Container className="page-container">
      <PageHeader
        eyebrow="Catalogue"
        title="Concours disponibles"
        description="Découvrez les préparations actuellement publiées sur CAV Madagascar."
      />

      {loading && <div className="catalogue-state">Chargement des concours...</div>}

      {!loading && error && <div className="form-error" role="alert">{error}</div>}

      {!loading && !error && courses.length === 0 && (
        <Card className="catalogue-empty">
          <h2>Aucun concours disponible pour le moment</h2>
          <p>Les prochaines préparations seront publiées prochainement.</p>
        </Card>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="course-grid">
          {courses.map((course) => (
            <Card key={course.id} className="course-card">
              {course.thumbnailUrl && (
                <img className="course-thumbnail" src={course.thumbnailUrl} alt="" />
              )}
              <span className="course-badge">Préparation</span>
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              <div className="course-card-footer">
                <strong>{course.price.toLocaleString('fr-FR')} {course.currency}</strong>
                <Link className="text-link" to={`/courses/${course.slug}`}>
                  Découvrir →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Container>
  )
}
