import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listMyPracticeAttempts, getPublishedPracticeSet } from '../features/questions'
import type { PracticeAttempt } from '../types/question'

export function ResultsPage() {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void listMyPracticeAttempts(user.uid).then(async items => {
      setAttempts(items)
      const next: Record<string, string> = {}
      await Promise.all(items.slice(0, 20).map(async item => { const set = await getPublishedPracticeSet(item.questionSetId); if (set) next[item.questionSetId] = set.title }))
      setTitles(next)
    }).catch(console.error).finally(() => setLoading(false))
  }, [user])

  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length) : 0
  return <Container className="redesign-page-container">
    <section className="redesign-catalog-hero"><div><p className="redesign-eyebrow">Votre progression</p><h1>Résultats</h1><p>Retrouvez vos entraînements et voyez vos progrès au fil du temps.</p></div></section>
    <section className="redesign-stat-strip"><div><strong>{average}%</strong><span>Moyenne</span></div><div><strong>{attempts.length}</strong><span>Entraînements</span></div><div><strong>{attempts.filter(item => item.percentage >= 50).length}</strong><span>Réussites</span></div></section>
    {loading ? <div className="catalogue-state">Chargement de vos résultats...</div> : attempts.length ? <Card className="redesign-panel"><div className="redesign-result-list">{attempts.map(item => <div key={item.id}><span>◉</span><div><strong>{titles[item.questionSetId] ?? 'Entraînement'}</strong><small>{item.earnedPoints} / {item.totalPoints} points</small></div><b>{item.percentage}%</b></div>)}</div></Card> : <Card className="redesign-empty"><h2>Aucun résultat pour le moment</h2><p>Commencez un entraînement depuis votre préparation.</p><Link className="redesign-primary-button compact" to="/courses">Voir les concours →</Link></Card>}
  </Container>
}
