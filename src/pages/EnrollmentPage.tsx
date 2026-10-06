import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { useAuth } from '../features/auth'
import { getPublishedCourseBySlug } from '../features/courses'
import { getEnrollment, hasPendingPayment, submitPayment } from '../features/enrollment'
import type { Course } from '../types/course'

export function EnrollmentPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [reference, setReference] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState<'new' | 'active' | 'pending'>('new')

  useEffect(() => {
    async function load() {
      if (!slug) return
      const nextCourse = await getPublishedCourseBySlug(slug)
      setCourse(nextCourse)
      if (user && nextCourse) {
        const enrollment = await getEnrollment(user.uid, nextCourse.id)
        if (enrollment?.status === 'active') setState('active')
        else {
          if (await hasPendingPayment(user.uid, nextCourse.id)) setState('pending')
        }
      }
    }
    void load()
  }, [slug, user])

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('')
    if (!user || !course || !reference.trim()) return
    try {
      await submitPayment({ userId: user.uid, courseId: course.id, amount: course.price, reference, method: 'mvola' })
      setMessage('Votre référence MVola a été envoyée. L’administration vérifiera le SMS de paiement puis activera votre accès.')
      setReference(''); setState('pending')
    } catch (err) { console.error(err); setError('Impossible d’enregistrer le paiement.') }
  }

  if (!course) return <Container className="page-container"><div className="catalogue-state">Chargement...</div></Container>
  if (!user) return <Container className="page-container"><Card className="catalogue-empty"><h1>Connectez-vous pour vous inscrire</h1><p>Vous pourrez ensuite soumettre votre référence MVola depuis votre espace.</p><Link className="ui-button ui-button-primary" to="/login">Se connecter</Link></Card></Container>
  if (state === 'active') return <Container className="page-container"><Card className="catalogue-empty"><p className="eyebrow">Accès actif</p><h1>Vous êtes déjà inscrit à {course.title}</h1><p>Votre accès au contenu pédagogique est actif{course.accessDurationDays ? ` pour ${course.accessDurationDays} jours selon votre inscription.` : '.'}</p><button className="ui-button ui-button-primary" onClick={() => navigate(`/courses/${course.id}/learn`)}>Commencer la préparation</button></Card></Container>

  return <Container className="page-container"><button className="back-link back-button" onClick={() => navigate(-1)}>← Retour</button><Card className="auth-card"><p className="eyebrow">Inscription</p><h1>{course.title}</h1><p className="page-description">Montant : <strong>{course.price.toLocaleString('fr-FR')} MGA</strong> · Accès : <strong>{course.accessDurationDays} jours</strong></p><p>Effectuez le paiement via MVola puis saisissez ici votre référence de transaction. L’administration la comparera au SMS reçu avant de valider l’accès.</p>{message && <div className="form-success">{message}</div>}{error && <div className="form-error">{error}</div>}{state === 'pending' && <div className="form-info">Un paiement est déjà en attente de vérification pour ce concours. Vous pouvez envoyer une nouvelle référence uniquement si nécessaire.</div>}<form className="auth-form" onSubmit={submit}><label>Référence MVola<input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ex. 123456789" inputMode="numeric" /></label><button className="ui-button ui-button-primary">Envoyer le paiement</button></form><Link className="text-link" to="/dashboard">Voir mon espace →</Link></Card></Container>
}
