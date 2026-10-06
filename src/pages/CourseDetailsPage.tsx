import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { courseIllustration } from '../components/CourseIllustration'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { getPublishedCourseBySlug, listPublishedCourseSubjects } from '../features/courses'
import { getEnrollment } from '../features/enrollment'
import type { Course, CourseSubject } from '../types/course'

export function CourseDetailsPage() {
  const { slug } = useParams<{ slug: string }>(); const { user } = useAuth(); const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null); const [subjects, setSubjects] = useState<CourseSubject[]>([]); const [active, setActive] = useState(false); const [loading, setLoading] = useState(true)
  useEffect(() => { void (async () => { if (!slug) return; try { const next = await getPublishedCourseBySlug(slug); setCourse(next); if (next) { setSubjects(await listPublishedCourseSubjects(next.id)); if (user) { const enrollment = await getEnrollment(user.uid, next.id); setActive(Boolean(enrollment?.status === 'active' && (!enrollment.expiresAt || enrollment.expiresAt.getTime() > Date.now()))) } } } finally { setLoading(false) } })() }, [slug, user])
  if (loading) return <Container className="redesign-page-container"><div className="catalogue-state">Chargement...</div></Container>
  if (!course) return <Container className="redesign-page-container"><Card className="redesign-empty"><h1>Concours introuvable.</h1><Link className="redesign-primary-button compact" to="/courses">Retour au catalogue</Link></Card></Container>
  return <Container className="redesign-page-container">
    <button className="redesign-back" onClick={() => navigate(-1)}>← Retour aux concours</button>
    <section className="redesign-detail-hero"><div className="redesign-detail-copy"><span className="redesign-category">Préparation aux concours</span><h1>{course.title}</h1><p>{course.description || 'Une préparation structurée pour avancer avec méthode.'}</p><div className="redesign-meta"><span>▣ {subjects.length} matière{subjects.length === 1 ? '' : 's'}</span><span>⌁ {course.accessDurationDays} jours d’accès</span><strong>{course.price.toLocaleString('fr-FR')} {course.currency}</strong></div></div><div className="redesign-detail-image"><img src={courseIllustration(course)} alt={`Illustration de ${course.title}`} /></div></section>
    <section className="redesign-detail-content"><div><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Le programme</p><h2>Matières de la préparation</h2></div></div><div className="redesign-subject-list">{subjects.length ? subjects.map((subject, index) => <article key={subject.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{subject.title}</h3><p>{subject.description || 'Cours, supports et exercices pour maîtriser cette matière.'}</p></div><b>→</b></article>) : <Card className="redesign-empty"><p>Le programme détaillé sera publié prochainement.</p></Card>}</div></div><aside className="redesign-detail-aside"><Card><p className="redesign-eyebrow">{active ? 'Votre accès' : 'Commencer'}</p><h2>{active ? 'Continuez votre préparation' : 'Prêt à commencer ?'}</h2><p>{active ? 'Votre accès est actif. Retrouvez vos leçons et votre progression.' : 'Inscrivez-vous pour accéder au programme et commencer votre préparation.'}</p>{active ? <Link className="redesign-primary-button" to={`/courses/${course.id}/learn`}>Continuer →</Link> : <Link className="redesign-primary-button" to={`/courses/${course.slug}/enroll`}>S’inscrire →</Link>}</Card></aside></section>
  </Container>
}
