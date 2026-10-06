import { useEffect, useMemo, useState } from 'react'
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import { Container } from '../components/ui/Container'
import { getFirebaseFirestore } from '../lib/firebase/firestore'

interface AttemptRecord { courseId?: unknown; percentage?: unknown; submittedAt?: unknown; userId?: unknown }
interface PaymentRecord { amount?: unknown; createdAt?: unknown; verifiedAt?: unknown; status?: unknown; userId?: unknown; courseId?: unknown }
interface CourseRecord { id: string; title: string; status?: unknown }
interface Analytics {
  courses: number; publishedCourses: number; users: number; activeUsers: number; activeEnrollments: number
  pendingPayments: number; verifiedPayments: number; revenue: number; completedLessons: number
  lessonAttempts: number; practiceAttempts: number; psychotechnicalAttempts: number; totalAttempts: number
  averageLessonScore: number; averagePracticeScore: number; averagePsychotechnicalScore: number
  revenueByMonth: Array<{ label: string; value: number }>
  attemptsByMonth: Array<{ label: string; value: number }>
  attemptMix: Array<{ label: string; value: number }>
  coursePerformance: Array<{ title: string; attempts: number; average: number }>
  recentActivity: Array<{ label: string; detail: string; value: string }>
}

const empty: Analytics = {
  courses: 0, publishedCourses: 0, users: 0, activeUsers: 0, activeEnrollments: 0,
  pendingPayments: 0, verifiedPayments: 0, revenue: 0, completedLessons: 0,
  lessonAttempts: 0, practiceAttempts: 0, psychotechnicalAttempts: 0, totalAttempts: 0,
  averageLessonScore: 0, averagePracticeScore: 0, averagePsychotechnicalScore: 0,
  revenueByMonth: [], attemptsByMonth: [], attemptMix: [], coursePerformance: [], recentActivity: [],
}

function toMillis(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') { const n = Date.parse(value); return Number.isFinite(n) ? n : null }
  return null
}

function percentageAverage(items: AttemptRecord[]): number {
  const values = items.map(item => Number(item.percentage)).filter(value => Number.isFinite(value))
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function isActiveEnrollment(data: Record<string, unknown>): boolean {
  if (data.status !== 'active') return false
  const expiresAt = data.expiresAt
  const millis = toMillis(expiresAt)
  return millis === null || millis > Date.now()
}

function monthBuckets(months = 6) {
  const now = new Date()
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') }
  })
}

function Icon({ name }: { name: 'users' | 'book' | 'wallet' | 'activity' | 'trend' | 'arrow' | 'refresh' | 'check' | 'clock' | 'target' | 'layers' }) {
  const paths = {
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3 2.6-4.5 5.5-4.5s4.8 1.5 5.5 4.5"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16 14.8c2.2.2 3.8 1.5 4.5 4.2"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/><path d="M8 7h8"/></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8h15"/><path d="M15 12h5"/><circle cx="15" cy="12" r=".8" fill="currentColor" stroke="none"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    trend: <><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.7 4L20 15"/><path d="M20 20v-5h-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></>,
    layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function formatMoney(value: number) { return `${Math.round(value).toLocaleString('fr-FR')} MGA` }
function formatDate(value: unknown) {
  const millis = toMillis(value)
  return millis ? new Date(millis).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'
}

function LineChart({ data, money = false }: { data: Array<{ label: string; value: number }>; money?: boolean }) {
  const width = 820, height = 280, padX = 48, padTop = 22, padBottom = 38
  const max = Math.max(1, ...data.map(item => item.value))
  const points = data.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, data.length - 1)
    const y = padTop + (1 - item.value / max) * (height - padTop - padBottom)
    return { ...item, x, y }
  })
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  const area = points.length ? `${path} L ${points.at(-1)?.x ?? padX} ${height - padBottom} L ${points[0]?.x ?? padX} ${height - padBottom} Z` : ''
  return <div className="analytics-chart-wrap"><svg className="analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution des statistiques">
    {[0, .25, .5, .75, 1].map(r => <g key={r}><line x1={padX} x2={width - padX} y1={padTop + r * (height - padTop - padBottom)} y2={padTop + r * (height - padTop - padBottom)} /><text x={8} y={padTop + r * (height - padTop - padBottom) + 4}>{money ? formatMoney((max * (1 - r))) : Math.round(max * (1 - r))}</text></g>)}
    {area && <path className="chart-area-fill" d={area} />}
    {path && <path className="chart-line" d={path} />}
    {points.map(p => <g key={p.label}><circle className="chart-dot" cx={p.x} cy={p.y} r="5"/><text x={p.x} y={height - 12} textAnchor="middle">{p.label}</text><title>{p.label}: {money ? formatMoney(p.value) : p.value}</title></g>)}
  </svg></div>
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map(item => item.value))
  return <div className="analytics-bars" role="img" aria-label="Activité mensuelle">
    {data.map(item => <div className="analytics-bar-col" key={item.label}><div className="analytics-bar-value">{item.value}</div><div className="analytics-bar-track"><span style={{ height: `${Math.max(3, (item.value / max) * 100)}%` }} /></div><small>{item.label}</small></div>)}
  </div>
}

function Donut({ items }: { items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const radius = 56, circumference = 2 * Math.PI * radius
  return <div className="donut-layout"><div className="donut-chart"><svg viewBox="0 0 150 150" aria-label="Répartition des évaluations">
    <circle cx="75" cy="75" r={radius} fill="none" stroke="#edf2f7" strokeWidth="18" />
    {items.map((item, index) => { const dash = total ? (item.value / total) * circumference : 0; const offset = items.slice(0, index).reduce((sum, previous) => sum + (total ? (previous.value / total) * circumference : 0), 0); return <circle key={item.label} cx="75" cy="75" r={radius} fill="none" stroke={`var(--chart-${index + 1})`} strokeWidth="18" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform="rotate(-90 75 75)" /> })}
    <text x="75" y="70" textAnchor="middle" className="donut-total">{total}</text><text x="75" y="88" textAnchor="middle" className="donut-label">tentatives</text>
  </svg></div><div className="donut-legend">{items.map((item, index) => <div key={item.label}><span className={`legend-dot legend-${index + 1}`} /><div><strong>{item.value}</strong><span>{item.label}</span></div></div>)}</div></div>
}

export function AdminAnalyticsPage({ onBack }: { onBack?: () => void }) {
  const db = getFirebaseFirestore()
  const [data, setData] = useState<Analytics>(empty)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [coursesSnap, publishedCourses, users, activeUsers, enrollments, pendingPayments, verifiedPayments, progress, lessonAttempts, practiceAttempts, psychotechnicalAttempts] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getCountFromServer(query(collection(db, 'courses'), where('status', '==', 'published'))),
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(query(collection(db, 'users'), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'enrollments'), where('status', '==', 'active'))),
        getCountFromServer(query(collection(db, 'payments'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'payments'), where('status', '==', 'verified'))),
        getCountFromServer(query(collection(db, 'progress'), where('completed', '==', true))),
        getDocs(collection(db, 'lessonAttempts')),
        getDocs(collection(db, 'practiceAttempts')),
        getDocs(collection(db, 'psychotechnicalAttempts')),
      ])

      const courseData = coursesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as CourseRecord[]
      const verifiedPaymentData = verifiedPayments.docs.map(item => item.data() as PaymentRecord)
      const lessonData = lessonAttempts.docs.map(item => item.data() as AttemptRecord)
      const practiceData = practiceAttempts.docs.map(item => item.data() as AttemptRecord)
      const psychoData = psychotechnicalAttempts.docs.map(item => item.data() as AttemptRecord)
      const months = monthBuckets(6)
      const revenueByMonth = months.map(month => ({ label: month.label, value: verifiedPaymentData.filter(item => { const t = toMillis(item.verifiedAt) ?? toMillis(item.createdAt); return t ? `${new Date(t).getFullYear()}-${String(new Date(t).getMonth() + 1).padStart(2, '0')}` === month.key : false }).reduce((sum, item) => sum + Number(item.amount ?? 0), 0) }))
      const allAttempts = [...lessonData, ...practiceData, ...psychoData]
      const attemptsByMonth = months.map(month => ({ label: month.label, value: allAttempts.filter(item => { const t = toMillis(item.submittedAt); return t ? `${new Date(t).getFullYear()}-${String(new Date(t).getMonth() + 1).padStart(2, '0')}` === month.key : false }).length }))
      const courseMap = new Map(courseData.map(course => [course.id, course.title]))
      const grouped = new Map<string, number[]>()
      allAttempts.forEach(item => { const key = String(item.courseId ?? ''); if (!key) return; const list = grouped.get(key) ?? []; const score = Number(item.percentage); if (Number.isFinite(score)) list.push(score); grouped.set(key, list) })
      const coursePerformance = [...grouped.entries()].map(([id, scores]) => ({ title: courseMap.get(id) ?? 'Concours non identifié', attempts: scores.length, average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0 })).sort((a, b) => b.attempts - a.attempts).slice(0, 6)
      const recentActivity = [...allAttempts.map(item => ({ time: toMillis(item.submittedAt) ?? 0, label: 'Évaluation', detail: 'Nouvelle tentative enregistrée', value: `${Number(item.percentage) || 0}%` })), ...verifiedPaymentData.map(item => ({ time: toMillis(item.verifiedAt) ?? toMillis(item.createdAt) ?? 0, label: 'Paiement', detail: 'Paiement vérifié', value: formatMoney(Number(item.amount ?? 0)) }))].sort((a, b) => b.time - a.time).slice(0, 6).map(item => ({ label: item.label, detail: `${item.detail} · ${formatDate(item.time)}`, value: item.value }))
      const revenue = verifiedPaymentData.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
      const activeEnrollmentCount = enrollments.docs.filter(item => isActiveEnrollment(item.data() as Record<string, unknown>)).length

      setData({
        courses: coursesSnap.size, publishedCourses: publishedCourses.data().count, users: users.data().count, activeUsers: activeUsers.data().count, activeEnrollments: activeEnrollmentCount,
        pendingPayments: pendingPayments.data().count, verifiedPayments: verifiedPayments.size, revenue, completedLessons: progress.data().count,
        lessonAttempts: lessonData.length, practiceAttempts: practiceData.length, psychotechnicalAttempts: psychoData.length, totalAttempts: allAttempts.length,
        averageLessonScore: percentageAverage(lessonData), averagePracticeScore: percentageAverage(practiceData), averagePsychotechnicalScore: percentageAverage(psychoData),
        revenueByMonth, attemptsByMonth, attemptMix: [{ label: 'Leçons', value: lessonData.length }, { label: 'Entraînements', value: practiceData.length }, { label: 'Psychotechniques', value: psychoData.length }], coursePerformance, recentActivity,
      })
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les statistiques. Vérifiez les règles Firestore.')
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { void load() }, [db])
  const avgOverall = useMemo(() => { const weighted = [[data.averageLessonScore, data.lessonAttempts], [data.averagePracticeScore, data.practiceAttempts], [data.averagePsychotechnicalScore, data.psychotechnicalAttempts]]; const total = weighted.reduce((n, [, count]) => n + count, 0); return total ? Math.round(weighted.reduce((n, [score, count]) => n + score * count, 0) / total) : 0 }, [data])
  const activeRate = data.users ? Math.round((data.activeUsers / data.users) * 100) : 0
  const verificationRate = data.pendingPayments + data.verifiedPayments ? Math.round((data.verifiedPayments / (data.pendingPayments + data.verifiedPayments)) * 100) : 0
  const maxCourseAttempts = Math.max(1, ...data.coursePerformance.map(item => item.attempts))

  return <Container className="page-container analytics-dashboard">
    <div className="analytics-header">
      <div className="analytics-title-block">
        <button className="analytics-back" type="button" onClick={onBack}><span>←</span> Tableau de bord</button>
        <div className="analytics-heading-row"><div><p className="eyebrow">ANALYTIQUE</p><h1>Vue analytique</h1><p className="page-description">Pilotez CAV Madagascar avec une lecture claire de l’activité, des revenus et de la progression.</p></div></div>
      </div>
      <div className="analytics-toolbar"><span className="analytics-live"><i /> Données en direct</span><span className="analytics-period"><Icon name="clock" /> 6 derniers mois</span><button className="analytics-refresh" type="button" disabled={refreshing || loading} onClick={() => { setRefreshing(true); void load() }}><Icon name="refresh" /> Actualiser</button></div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="analytics-loading"><div /><div /><div /><div /></div> : <>
      <section className="analytics-kpis">
        <article className="analytics-kpi kpi-blue"><div className="kpi-icon"><Icon name="users" /></div><div className="kpi-content"><span>Utilisateurs</span><strong>{data.users}</strong><small><b>{activeRate}%</b> actifs</small></div><div className="kpi-mini"><span style={{ width: `${activeRate}%` }} /></div></article>
        <article className="analytics-kpi kpi-purple"><div className="kpi-icon"><Icon name="book" /></div><div className="kpi-content"><span>Concours publiés</span><strong>{data.publishedCourses}</strong><small>{data.courses} concours au total</small></div><div className="kpi-side"><b>{data.courses ? Math.round((data.publishedCourses / data.courses) * 100) : 0}%</b><span>publiés</span></div></article>
        <article className="analytics-kpi kpi-green"><div className="kpi-icon"><Icon name="wallet" /></div><div className="kpi-content"><span>Revenus vérifiés</span><strong>{formatMoney(data.revenue)}</strong><small>{data.verifiedPayments} paiements validés</small></div><div className="kpi-side"><Icon name="trend" /><span>cumul</span></div></article>
        <article className="analytics-kpi kpi-orange"><div className="kpi-icon"><Icon name="activity" /></div><div className="kpi-content"><span>Évaluations</span><strong>{data.totalAttempts}</strong><small><b>{avgOverall}%</b> score moyen pondéré</small></div><div className="kpi-side"><b>{data.completedLessons}</b><span>leçons terminées</span></div></article>
      </section>

      <section className="analytics-overview-grid">
        <article className="analytics-panel analytics-revenue-panel"><div className="analytics-panel-head"><div><span className="panel-kicker">FINANCES</span><h2>Revenus vérifiés</h2><p>Évolution mensuelle des paiements validés</p></div><div className="panel-total"><strong>{formatMoney(data.revenue)}</strong><span>Total cumulé</span></div></div><LineChart data={data.revenueByMonth} money /></article>
        <article className="analytics-panel analytics-health-panel"><div className="analytics-panel-head"><div><span className="panel-kicker">SANTÉ DE LA PLATEFORME</span><h2>Indicateurs clés</h2><p>Lecture rapide de la situation actuelle</p></div></div><div className="health-score"><div className="health-ring" style={{ '--score': `${Math.max(activeRate, verificationRate, avgOverall)}%` } as React.CSSProperties}><div><strong>{Math.max(activeRate, verificationRate, avgOverall)}%</strong><span>indice</span></div></div><div><strong>Performance globale</strong><p>Basée sur l’activité, les paiements vérifiés et les scores.</p></div></div><div className="health-metrics"><div><span>Utilisateurs actifs</span><b>{activeRate}%</b><i><em style={{ width: `${activeRate}%` }} /></i></div><div><span>Paiements vérifiés</span><b>{verificationRate}%</b><i><em style={{ width: `${verificationRate}%` }} /></i></div><div><span>Score moyen</span><b>{avgOverall}%</b><i><em style={{ width: `${avgOverall}%` }} /></i></div></div></article>
      </section>

      <section className="analytics-grid-3">
        <article className="analytics-panel"><div className="analytics-panel-head"><div><span className="panel-kicker">APPRENTISSAGE</span><h2>Activité mensuelle</h2><p>Tentatives d’évaluation enregistrées</p></div><span className="panel-number">{data.totalAttempts}</span></div><BarChart data={data.attemptsByMonth} /></article>
        <article className="analytics-panel"><div className="analytics-panel-head"><div><span className="panel-kicker">RÉPARTITION</span><h2>Types d’évaluation</h2><p>Composition des tentatives</p></div></div><Donut items={data.attemptMix} /></article>
        <article className="analytics-panel"><div className="analytics-panel-head"><div><span className="panel-kicker">RÉSULTATS</span><h2>Scores moyens</h2><p>Par type d’évaluation</p></div></div><div className="score-bars score-bars-premium">{[['Leçons',data.averageLessonScore,data.lessonAttempts],['Entraînements',data.averagePracticeScore,data.practiceAttempts],['Psychotechniques',data.averagePsychotechnicalScore,data.psychotechnicalAttempts]].map(([label,score,count], index) => <div className="score-row" key={String(label)}><div className="score-label"><span><i className={`score-dot dot-${index + 1}`} />{label}</span><b>{score}%</b></div><div className="score-track"><span className={`score-fill fill-${index + 1}`} style={{ width: `${Number(score)}%` }} /></div><small>{count} tentative{Number(count) > 1 ? 's' : ''}</small></div>)}</div><div className="score-average"><span>Moyenne pondérée</span><strong>{avgOverall}%</strong></div></article>
      </section>

      <section className="analytics-bottom-grid">
        <article className="analytics-panel analytics-ranking"><div className="analytics-panel-head"><div><span className="panel-kicker">CLASSEMENT</span><h2>Concours les plus actifs</h2><p>Selon le nombre d’évaluations enregistrées</p></div><Icon name="layers" /></div>{data.coursePerformance.length ? <div className="ranking-list">{data.coursePerformance.map((item, index) => <div className="ranking-row" key={item.title}><span className={`ranking-number rank-${index + 1}`}>{index + 1}</span><div className="ranking-main"><div><strong>{item.title}</strong><span>{item.attempts} tentative{item.attempts > 1 ? 's' : ''}</span></div><div className="ranking-bar"><span style={{ width: `${(item.attempts / maxCourseAttempts) * 100}%` }} /></div></div><strong className="ranking-score">{item.average}%</strong></div>)}</div> : <div className="analytics-empty">Pas encore assez de données pour établir un classement.</div>}</article>
        <article className="analytics-panel analytics-ops"><div className="analytics-panel-head"><div><span className="panel-kicker">OPÉRATIONS</span><h2>État de la plateforme</h2><p>Volumes actuellement enregistrés</p></div></div><div className="ops-cards"><div><span className="ops-icon blue"><Icon name="users" /></span><div><small>Inscriptions actives</small><strong>{data.activeEnrollments}</strong></div></div><div><span className="ops-icon green"><Icon name="check" /></span><div><small>Paiements vérifiés</small><strong>{data.verifiedPayments}</strong></div></div><div><span className="ops-icon orange"><Icon name="clock" /></span><div><small>En attente</small><strong>{data.pendingPayments}</strong></div></div><div><span className="ops-icon purple"><Icon name="book" /></span><div><small>Leçons terminées</small><strong>{data.completedLessons}</strong></div></div></div></article>
        <article className="analytics-panel analytics-full"><div className="analytics-panel-head"><div><span className="panel-kicker">JOURNAL</span><h2>Activité récente</h2><p>Dernières opérations enregistrées dans CAV</p></div><span className="analytics-view-all">Actualisé maintenant</span></div>{data.recentActivity.length ? <div className="recent-list">{data.recentActivity.map((item, index) => <div key={`${item.label}-${index}`}><span className={`recent-icon ${item.label === 'Paiement' ? 'payment' : 'evaluation'}`}><Icon name={item.label === 'Paiement' ? 'wallet' : 'activity'} /></span><div><strong>{item.label}</strong><small>{item.detail}</small></div><b>{item.value}</b></div>)}</div> : <div className="analytics-empty">Aucune activité récente.</div>}</article>
      </section>
    </>}
  </Container>
}
