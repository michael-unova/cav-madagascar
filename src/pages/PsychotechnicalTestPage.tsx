import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { useAuth } from '../features/auth'
import { getPsychotechnicalTest } from '../features/questions'
import { listMyEnrollments } from '../features/enrollment'
import type { PsychotechnicalQuestionSnapshot, PsychotechnicalTest } from '../types/psychotechnical'
import { PSYCHOTECHNICAL_DOMAIN_LABELS } from '../types/psychotechnical'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from '../lib/firebase/config'

const functions = getFunctions(getFirebaseApp(), 'africa-south1')
const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
type TestResult = { attemptId?: string; percentage: number; earnedPoints: number; totalPoints: number; domainResults?: Record<string, { earned: number; total: number; percentage: number }> }

export function PsychotechnicalTestPage() {
  const { testId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [test, setTest] = useState<PsychotechnicalTest | null>(null)
  const [questions, setQuestions] = useState<PsychotechnicalQuestionSnapshot[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [courseId, setCourseId] = useState('')
  const startedAt = useRef<number>(0)
  const submitted = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!testId || !user?.uid) { setError(!testId ? 'Test introuvable.' : 'Connectez-vous pour passer ce test.'); setLoading(false); return }
      try {
        const t = await getPsychotechnicalTest(testId)
        if (!t || t.status !== 'published') throw new Error('Ce test n’est pas disponible.')
        const enrollments = await listMyEnrollments(user.uid)
        const enrollment = enrollments.find(e => t.courseIds.includes(e.courseId) && e.status === 'active')
        if (!enrollment) throw new Error('Votre accès à ce concours n’est pas actif.')
        const selected = t.distributions.length
          ? t.distributions.flatMap(d => (t.settings.randomizeQuestions ? shuffle(t.questions.filter(q => q.domain === d.domain)) : t.questions.filter(q => q.domain === d.domain)).slice(0, Math.max(0, d.count)))
          : (t.settings.randomizeQuestions ? shuffle(t.questions) : [...t.questions]).slice(0, Math.max(1, t.settings.questionCount))
        const validQuestions = selected.filter(q => q && q.id && q.prompt)
        if (!validQuestions.length) throw new Error('Ce test ne contient aucune question utilisable. Contactez l’administrateur.')
        const finalQuestions = t.settings.randomizeQuestions ? shuffle(validQuestions) : validQuestions
        const displayQuestions = finalQuestions.map(q => t.settings.randomizeOptions && q.options ? { ...q, options: shuffle(q.options) } : q)
        if (!cancelled) {
          setTest(t); setCourseId(enrollment.courseId); setQuestions(displayQuestions)
          setRemaining(Math.max(1, Number(t.settings.durationMinutes) || 30) * 60)
          startedAt.current = Date.now()
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Impossible de charger le test.')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [testId, user?.uid])

  const submit = useCallback(async (timedOut = false) => {
    if (!user || !test || submitted.current || submitting) return
    submitted.current = true
    setSubmitting(true); setSubmitError('')
    try {
      const payload = { testId: test.id, questionIds: questions.map(question => question.id), answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })), courseId, durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)) }
      const fn = httpsCallable<typeof payload, TestResult>(functions, 'submitPsychotechnicalTest')
      const response = await fn(payload)
      setResult(response.data)
      if (timedOut) setRemaining(0)
    } catch (e) {
      submitted.current = false
      setSubmitError(e instanceof Error ? e.message : 'Impossible de soumettre le test. Vérifiez votre connexion puis réessayez.')
    } finally { setSubmitting(false) }
  }, [user, test, answers, courseId, submitting])

  useEffect(() => {
    if (!test || result || loading || remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [test, result, loading, remaining])
  useEffect(() => { if (test && !loading && remaining === 0 && !result && !submitted.current) void submit(true) }, [test, loading, remaining, result, submit])

  const current = questions[index]
  const answeredCount = useMemo(() => questions.filter(q => answers[q.id] !== undefined && String(answers[q.id]).trim() !== '').length, [questions, answers])
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0
  const timeLabel = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`
  const chooseAnswer = (questionId: string, answer: unknown) => setAnswers(previous => ({ ...previous, [questionId]: answer }))

  if (loading) return <Container className="page-container"><Card className="psy-loading"><p className="eyebrow">🧠 TEST PSYCHOTECHNIQUE</p><h2>Préparation de votre test…</h2><p>Nous vérifions votre accès et préparons les questions.</p></Card></Container>
  if (error) return <Container className="page-container"><Card className="catalogue-empty"><h2>Impossible d’ouvrir le test</h2><p>{error}</p><button className="ui-button ui-button-secondary" onClick={() => nav(-1)}>Retour</button></Card></Container>
  if (result && test) return <Container className="page-container"><Card className="psy-result"><p className="eyebrow">✓ TEST TERMINÉ</p><h1>{test.title}</h1><p className="page-description">Votre test a été enregistré. Voici votre résultat.</p><div className="psy-score"><strong>{result.percentage}%</strong><span>{result.earnedPoints} / {result.totalPoints} points</span></div><div className="psy-progress"><span style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }} /></div><div className="psy-domain-grid">{Object.entries(result.domainResults ?? {}).map(([domain, data]) => <div key={domain}><span>{PSYCHOTECHNICAL_DOMAIN_LABELS[domain as keyof typeof PSYCHOTECHNICAL_DOMAIN_LABELS] ?? domain}</span><b>{data.percentage}%</b><small>{data.earned} / {data.total} points</small></div>)}</div><button className="ui-button ui-button-primary" onClick={() => nav(-1)}>Retour au concours</button></Card></Container>
  if (!test || !current) return <Container className="page-container"><Card className="catalogue-empty"><p>Aucune question disponible.</p><button className="ui-button ui-button-secondary" onClick={() => nav(-1)}>Retour</button></Card></Container>

  return <Container className="page-container">
    <div className="page-header psy-test-header"><div><p className="eyebrow">🧠 Entraînement psychotechnique</p><h1>{test.title}</h1><p className="page-description">{test.description || 'Test de logique, raisonnement et observation.'}</p></div><div className={`psy-timer ${remaining <= 60 ? 'is-warning' : ''}`} aria-live="polite">⏱ {timeLabel}<small>Temps restant</small></div></div>
    <div className="psy-test-overview"><span><b>{questions.length}</b> questions</span><span><b>{answeredCount}</b> répondues</span><span><b>{questions.length - answeredCount}</b> restantes</span></div>
    <div className="psy-progress" aria-label={`Progression : ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
    <div className="psy-test-layout"><aside className="psy-question-nav"><strong>Questions</strong><div>{questions.map((q, i) => <button type="button" key={q.id} aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ', répondue' : ''}`} aria-current={i === index ? 'step' : undefined} className={`${i === index ? 'is-current' : ''} ${answers[q.id] !== undefined && String(answers[q.id]).trim() !== '' ? 'is-answered' : ''}`} onClick={() => setIndex(i)}>{i + 1}</button>)}</div><small>Vous pouvez revenir sur vos réponses avant de terminer.</small></aside>
      <Card className="psy-question-card"><div className="psy-question-meta"><span>{PSYCHOTECHNICAL_DOMAIN_LABELS[current.domain] ?? current.domain}</span><span>Question {index + 1} / {questions.length}</span><span>{current.points} pt{current.points > 1 ? 's' : ''}</span></div><h2>{current.prompt}</h2>{current.imageUrl && <img className="psy-question-image" src={current.imageUrl} alt="Illustration de la question" />}
        <div className="psy-options">{current.type === 'multiple_choice' && (current.options?.length ? current.options.map((option, optionIndex) => <button type="button" key={option.id} aria-pressed={answers[current.id] === option.id} className={`psy-option ${answers[current.id] === option.id ? 'is-selected' : ''}`} onClick={() => chooseAnswer(current.id, option.id)}><span className="psy-option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option.text}</span>{answers[current.id] === option.id && <span className="psy-option-check">✓</span>}</button>) : <p>Les choix de réponse ne sont pas configurés pour cette question. Signalez-le à l’administrateur.</p>)}
          {current.type === 'true_false' && ['true', 'false'].map(value => <button type="button" key={value} aria-pressed={String(answers[current.id]) === value} className={`psy-option ${String(answers[current.id]) === value ? 'is-selected' : ''}`} onClick={() => chooseAnswer(current.id, value === 'true')}><span>{value === 'true' ? 'Vrai' : 'Faux'}</span></button>)}
          {(current.type === 'numeric' || current.type === 'short_answer') && <label className="psy-text-answer"><span>{current.type === 'numeric' ? 'Votre réponse numérique' : 'Votre réponse'}</span><input className="psy-answer-input" value={String(answers[current.id] ?? '')} onChange={e => chooseAnswer(current.id, e.target.value)} inputMode={current.type === 'numeric' ? 'decimal' : 'text'} placeholder="Saisissez votre réponse" /></label>}
        </div>
        {submitError && <div className="psy-submit-error" role="alert"><span>{submitError}</span><button type="button" onClick={() => void submit()}>Réessayer l’envoi</button></div>}
        <div className="psy-actions">{index > 0 && <button className="ui-button ui-button-secondary" onClick={() => setIndex(i => i - 1)}>← Précédente</button>}<span className="psy-action-spacer" />{index < questions.length - 1 ? <button className="ui-button ui-button-primary" onClick={() => setIndex(i => i + 1)}>Suivante →</button> : <button className="ui-button ui-button-primary" disabled={submitting} onClick={() => { if (window.confirm(`Terminer le test ? Vous avez répondu à ${answeredCount} question(s) sur ${questions.length}.`)) void submit() }}>{submitting ? 'Envoi en cours…' : 'Terminer le test'}</button>}</div>
      </Card></div>
  </Container>
}
