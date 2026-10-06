import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { courseIllustration } from '../components/CourseIllustration'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listMyEnrollments } from '../features/enrollment'
import { getCourseProgressSummary } from '../features/progress'
import { getPublishedCourseById, listPublishedCourseGroups } from '../features/courses'
import { listMyPracticeAttempts, getPublishedPracticeSet } from '../features/questions'
import type { Enrollment } from '../types/enrollment'
import type { PracticeAttempt } from '../types/question'
import type { Course, CourseGroup } from '../types/course'

interface CourseDashboardItem { enrollment: Enrollment; course: Course | null; percent: number; completed: number; total: number }

function ContestCard({ item }: { item: CourseDashboardItem }) {
  const course = item.course
  const title = course?.title ?? 'Concours'
  return <article className="redesign-contest-card">
    <div className="redesign-contest-copy">
      <div className="redesign-card-top"><span className="redesign-category">Préparation aux concours</span><span className="redesign-status">✓ Inscrit</span></div>
      <h3>{title}</h3>
      <div className="redesign-meta"><span>▣ {item.total} leçon{item.total === 1 ? '' : 's'}</span><span>⌁ Préparation structurée</span></div>
      <div className="redesign-progress-row"><div className="redesign-progress"><span style={{ width: `${item.percent}%` }} /></div><b>{item.percent}%</b></div>
      <Link className="redesign-primary-button" to={`/courses/${course?.id ?? item.enrollment.courseId}/learn`}>Continuer ma préparation <span>→</span></Link>
    </div>
    <div className="redesign-contest-image">{<img src={courseIllustration(course)} alt="Illustration du concours" />}</div>
  </article>
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<CourseDashboardItem[]>([])
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [attemptTitles, setAttemptTitles] = useState<Record<string, string>>({})
  const [groups, setGroups] = useState<CourseGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const currentUser = user
    async function load() {
      try {
        const enrollments = await listMyEnrollments(currentUser.uid)
        const active = enrollments.filter(item => item.status === 'active')
        const [nextItems, nextAttempts, nextGroups] = await Promise.all([
          Promise.all(active.map(async enrollment => {
            const course = await getPublishedCourseById(enrollment.courseId)
            const summary = await getCourseProgressSummary(currentUser.uid, enrollment.courseId)
            return { enrollment, course, percent: summary.percent, completed: summary.completedLessons, total: summary.totalLessons }
          })),
          listMyPracticeAttempts(currentUser.uid),
          listPublishedCourseGroups(),
        ])
        setItems(nextItems)
        setAttempts(nextAttempts.slice(0, 3))
        setGroups(nextGroups)
        const titles: Record<string, string> = {}
        await Promise.all(nextAttempts.slice(0, 3).map(async attempt => { const set = await getPublishedPracticeSet(attempt.questionSetId); if (set) titles[attempt.questionSetId] = set.title }))
        setAttemptTitles(titles)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    void load()
  }, [user])

  const name = String(profile?.displayName ?? user?.displayName ?? 'Étudiant')
  const totalLessons = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items])
  const completedLessons = useMemo(() => items.reduce((sum, item) => sum + item.completed, 0), [items])
  const overall = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0

  return <Container className="redesign-page-container">
    <section className="redesign-welcome redesign-welcome-photo">
      <div className="redesign-welcome-overlay" />
      <div className="redesign-welcome-copy"><p className="redesign-eyebrow">Espace étudiant</p><h1>Bonjour, <em>{name}</em>.</h1><p>Continuez votre préparation et avancez vers votre prochain concours.</p></div>
      <Link className="redesign-primary-button redesign-welcome-cta" to="/courses">Explorer les concours <span>→</span></Link>
    </section>

    <section className="redesign-stat-strip">
      <div><strong>{items.length}</strong><span>Concours actifs</span></div><div><strong>{groups.length || items.length}</strong><span>Préparations disponibles</span></div><div><strong>{completedLessons}</strong><span>Leçons terminées</span></div>
    </section>

    <section className="redesign-section"><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Votre préparation</p><h2>Mes concours</h2></div><Link to="/courses">Voir tout →</Link></div>
      {loading ? <div className="catalogue-state">Chargement de votre préparation...</div> : items.length ? <div className="redesign-contest-grid">{items.slice(0, 2).map(item => <ContestCard key={item.enrollment.id} item={item} />)}</div> : <Card className="redesign-empty"><h3>Commencez votre préparation</h3><p>Découvrez les concours disponibles et choisissez votre prochaine préparation.</p><Link className="redesign-primary-button compact" to="/courses">Découvrir les concours →</Link></Card>}
    </section>

    <section className="redesign-section"><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Explorer</p><h2>Découvrir les concours</h2></div><Link to="/courses">Voir tout →</Link></div><div className="redesign-discover-grid">{items.length ? items.slice(0, 4).map(item => item.course && <Link key={item.course.id} to={`/courses/${item.course.slug}`} className="redesign-discover-card"><div className="redesign-discover-image"><img src={courseIllustration(item.course)} alt="" /></div><div><span>Préparation</span><h3>{item.course.title}</h3><small>{item.total} matières · Préparation structurée</small></div><span className="arrow">→</span></Link>) : <p className="redesign-muted">Les concours publiés apparaîtront ici.</p>}</div></section>

    <section className="redesign-bottom-grid">
      <Card className="redesign-panel"><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Votre progression</p><h2>Ma progression</h2></div></div><div className="redesign-progress-panel"><div className="redesign-ring" style={{ '--progress': `${overall * 3.6}deg` } as CSSProperties}><strong>{overall}%</strong></div><div><h3>{overall > 0 ? 'Bonne progression !' : 'Prêt à commencer ?'}</h3><p>Continuez votre préparation pour progresser régulièrement.</p></div></div></Card>
      <Card className="redesign-panel"><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Entraînement</p><h2>Derniers résultats</h2></div></div>{attempts.length ? <div className="redesign-result-list">{attempts.map(attempt => <div key={attempt.id}><span>◉</span><div><strong>{attemptTitles[attempt.questionSetId] ?? 'Entraînement'}</strong><small>{attempt.earnedPoints} / {attempt.totalPoints} points</small></div><b>{attempt.percentage}%</b></div>)}</div> : <p className="redesign-muted">Aucun entraînement réalisé pour le moment.</p>}</Card>
    </section>
  </Container>
}
