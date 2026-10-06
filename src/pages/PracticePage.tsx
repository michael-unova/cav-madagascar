import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { getPublishedCourseById } from '../features/courses'
import { listCourseSubjects } from '../features/curriculum'
import { listMyEnrollments } from '../features/enrollment'
import { getPublishedPracticeSet } from '../features/questions'
import type { PracticeQuestionSnapshot, QuestionSet } from '../types/question'
import { getFirebaseFunctions } from '../lib/firebase/functions'
import { httpsCallable } from 'firebase/functions'

export function PracticePage() {
  const { setId } = useParams<{ setId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [set, setSet] = useState<QuestionSet | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<{ earned: number; total: number; percentage: number; pending: number } | null>(null)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!setId || !user) return
      try {
        const nextSet = await getPublishedPracticeSet(setId)
        if (!nextSet) { setError('Entraînement introuvable.'); return }
        const enrollments = (await listMyEnrollments(user.uid)).filter(e => e.status === 'active')
        if (!enrollments.length) { setError('Votre accès à aucun concours n’est encore actif.'); return }
        if (nextSet.courseId) {
          const course = await getPublishedCourseById(nextSet.courseId)
          if (!course || !enrollments.some(e => e.courseId === course.id)) { setError('Votre accès à ce concours n’est pas encore actif.'); return }
        } else {
          let allowed = false
          for (const enrollment of enrollments) {
            const associations = await listCourseSubjects(enrollment.courseId, true)
            if (associations.some(item => item.subjectId === nextSet.subjectId)) { allowed = true; break }
          }
          if (!allowed) { setError('Votre accès à cette Matière n’est pas encore actif.'); return }
        }
        setSet(nextSet)
      } catch (err) {
        console.error(err)
        setError('Impossible de charger cet entraînement.')
      }
    }
    void load()
  }, [setId, user])

  const answeredCount = useMemo(() => Object.keys(answers).filter(key => answers[key] !== '' && answers[key] !== undefined && answers[key] !== null && (!Array.isArray(answers[key]) || answers[key].length > 0)).length, [answers])

  function setAnswer(question: PracticeQuestionSnapshot, value: unknown) {
    setAnswers(current => ({ ...current, [question.id]: value }))
  }

  async function submit() {
    if (!user || !set || submitted || saving) return
    setSaving(true)
    setError('')
    try {
      const submitPractice = httpsCallable<{ setId: string; answers: { questionId: string; answer: unknown }[] }, { earnedPoints: number; totalPoints: number; percentage: number; pendingManualCount: number; results: Record<string, boolean> }>(getFirebaseFunctions(), 'submitPractice')
      const response = await submitPractice({ setId: set.id, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) })
      const result = response.data
      setScore({ earned: result.earnedPoints, total: result.totalPoints, percentage: result.percentage, pending: result.pendingManualCount })
      setResults(result.results)
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Impossible d’enregistrer votre résultat.')
    } finally {
      setSaving(false)
    }
  }

  if (error && !set) return <Container className="page-container"><Card className="catalogue-empty"><h1>{error}</h1><button className="ui-button ui-button-primary" onClick={() => navigate(-1)}>Retour</button></Card></Container>
  if (!set) return <Container className="page-container"><div className="catalogue-state">Chargement de l’entraînement...</div></Container>

  return <Container className="page-container narrow">
    <button className="back-link back-button" onClick={() => navigate(-1)}>← Retour</button>
    <div className="page-header"><div><p className="eyebrow">Entraînement</p><h1>{set.title}</h1><p className="page-description">{set.description}</p></div><span className="practice-counter">{answeredCount}/{set.questions.length} répondues</span></div>
    {error && <div className="form-error" role="alert">{error}</div>}

    {set.questions.map((question, index) => <Card key={question.id} className="practice-question-card">
      <div className="practice-question-header"><strong>Question {index + 1}</strong>{set.settings?.showPoints !== false && <span>{question.points} pt{question.points === 1 ? '' : 's'}</span>}</div>
      <div className="lesson-preview practice-question-text">{String(question.questionContent.text ?? question.questionContent.html ?? '')}</div>
      {question.type === 'multiple_choice' && <div className="practice-options">{(question.options ?? []).map(option => <label key={option.id} className="practice-option"><input type="radio" name={question.id} checked={answers[question.id] === option.id} disabled={submitted} onChange={() => setAnswer(question, option.id)} /><span>{option.label}. {option.text}</span></label>)}</div>}
      {question.type === 'multiple_select' && <div className="practice-options">{(question.options ?? []).map(option => { const raw = answers[question.id]; const selectedIds: string[] = Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []; const selected = selectedIds.includes(option.id); return <label key={option.id} className="practice-option"><input type="checkbox" checked={selected} disabled={submitted} onChange={e => { const current = selectedIds; setAnswer(question, e.target.checked ? [...current, option.id] : current.filter(id => id !== option.id)) }} /><span>{option.label}. {option.text}</span></label> })}</div>}
      {question.type === 'true_false' && <div className="practice-options"><label className="practice-option"><input type="radio" name={question.id} disabled={submitted} checked={answers[question.id] === true} onChange={() => setAnswer(question, true)} />Vrai</label><label className="practice-option"><input type="radio" name={question.id} disabled={submitted} checked={answers[question.id] === false} onChange={() => setAnswer(question, false)} />Faux</label></div>}
      {question.type === 'short_answer' && <input className="practice-answer-input" disabled={submitted} value={String(answers[question.id] ?? '')} onChange={e => setAnswer(question, e.target.value)} placeholder="Votre réponse" />}
      {question.type === 'numeric' && <input className="practice-answer-input" type="number" disabled={submitted} value={String(answers[question.id] ?? '')} onChange={e => setAnswer(question, e.target.value)} placeholder="Votre réponse" />}
      {question.type === 'written' && <textarea className="practice-written" disabled={submitted} rows={7} value={String(answers[question.id] ?? '')} onChange={e => setAnswer(question, e.target.value)} placeholder="Rédigez votre réponse..." />}
      {submitted && set.settings?.showCorrections !== false && question.type !== 'written' && <div className={`practice-feedback ${results[question.id] ? 'is-correct' : 'is-wrong'}`}>{results[question.id] ? 'Bonne réponse.' : 'Réponse incorrecte.'}{set.settings?.showExplanations !== false && question.explanation && <div>{question.explanation}</div>}</div>}
      {submitted && question.type === 'written' && <div className="practice-feedback">Cette réponse écrite nécessite une correction manuelle.</div>}
    </Card>)}

    {!submitted ? <button className="ui-button ui-button-primary practice-submit" disabled={saving || answeredCount === 0} onClick={() => void submit()}>{saving ? 'Enregistrement...' : 'Terminer l’entraînement'}</button> : <Card className="practice-result"><p className="eyebrow">Résultat</p>{set.settings?.showScore !== false && <><h2>{score?.percentage ?? 0}%</h2><p>{score?.earned ?? 0} / {score?.total ?? 0} point{score?.total === 1 ? '' : 's'} obtenu{score?.total === 1 ? '' : 's'}.</p>{set.settings?.passingScore !== undefined && <p>{(score?.percentage ?? 0) >= set.settings.passingScore ? 'Réussi' : 'À revoir'} · seuil {set.settings.passingScore}%</p>}</>}{Boolean(score?.pending) && <p>Les questions écrites ({score?.pending}) nécessitent une correction manuelle.</p>}<div className="admin-list-actions"><button className="ui-button ui-button-primary" onClick={() => navigate(-1)}>Retour au cours</button>{set.settings?.allowRetry !== false && <button className="ui-button ui-button-secondary" onClick={() => { setSubmitted(false); setScore(null); setResults({}); setAnswers({}) }}>Recommencer</button>}</div></Card>}
  </Container>
}
