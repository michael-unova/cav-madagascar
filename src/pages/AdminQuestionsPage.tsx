import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listAdminSubjects } from '../features/admin/adminRepository'
import { listSubjectContentNodes } from '../features/curriculum'
import { createQuestion, createQuestionSet, deleteQuestion, deleteQuestionSet, listAdminQuestionSets, listAdminQuestions, updateQuestion, updateQuestionSetStatus } from '../features/questions'
import type { Subject } from '../types/subject'
import type { ContentNode } from '../types/content'
import type { Question, QuestionDifficulty, QuestionOption, QuestionSet, QuestionSetType, QuestionType } from '../types/question'

const emptyOptions: QuestionOption[] = [
  { id: 'a', label: 'A', text: '' }, { id: 'b', label: 'B', text: '' }, { id: 'c', label: 'C', text: '' }, { id: 'd', label: 'D', text: '' },
]

const setTypeLabel: Record<QuestionSetType, string> = { question_bank: 'Banque', important_questions: 'Questions importantes', practice: 'Entraînement', exercise: 'Exercices', quiz: 'Quiz' }

export function AdminQuestionsPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [nodes, setNodes] = useState<ContentNode[]>([])
  const [nodeId, setNodeId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice')
  const [text, setText] = useState('')
  const [options, setOptions] = useState<QuestionOption[]>(emptyOptions.map(item => ({ ...item })))
  const [correct, setCorrect] = useState<string | string[] | boolean>('a')
  const [shortAnswer, setShortAnswer] = useState('')
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium')
  const [points, setPoints] = useState('1')
  const [explanation, setExplanation] = useState('')
  const [setTitle, setSetTitle] = useState('')
  const [setDescription, setSetDescription] = useState('')
  const [setType, setSetType] = useState<QuestionSetType>('quiz')
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [showScore, setShowScore] = useState(true)
  const [showCorrections, setShowCorrections] = useState(true)
  const [showExplanations, setShowExplanations] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [allowRetry, setAllowRetry] = useState(true)
  const [passingScore, setPassingScore] = useState('70')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function refresh(subject = subjectId) {
    if (!subject) { setQuestions([]); setSets([]); return }
    const [qs, ss] = await Promise.all([listAdminQuestions(subject), listAdminQuestionSets(subject)])
    setQuestions(qs); setSets(ss)
  }

  useEffect(() => { void listAdminSubjects().then(setSubjects) }, [])
  useEffect(() => {
    if (!subjectId) { setNodes([]); setNodeId(''); refresh(''); return }
    void Promise.all([listSubjectContentNodes(subjectId, false), refresh(subjectId)]).then(([content]) => setNodes(content))
  }, [subjectId])

  const publishedQuestions = useMemo(() => questions.filter(q => q.status === 'published'), [questions])

  function resetForm() {
    setEditingId(null); setQuestionType('multiple_choice'); setText(''); setOptions(emptyOptions.map(item => ({ ...item }))); setCorrect('a'); setShortAnswer(''); setDifficulty('medium'); setPoints('1'); setExplanation(''); setNodeId('')
  }

  function prepareEdit(question: Question) {
    setEditingId(question.id); setQuestionType(question.type); setText(String(question.questionContent.text ?? question.questionContent.html ?? '')); setOptions(question.options?.length ? question.options.map(item => ({ ...item })) : emptyOptions.map(item => ({ ...item })))
    if (question.type === 'true_false') setCorrect(Boolean(question.correctAnswer)); else if (question.type === 'multiple_select') setCorrect(Array.isArray(question.correctAnswer) ? question.correctAnswer.map(String) : []); else if (question.type === 'multiple_choice') setCorrect(String(question.correctAnswer ?? 'a')); else setCorrect('')
    setShortAnswer(question.type === 'short_answer' || question.type === 'numeric' ? String(question.correctAnswer ?? '') : ''); setDifficulty(question.difficulty); setPoints(String(question.points)); setExplanation(question.explanation ?? ''); setNodeId(question.contentNodeId ?? ''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function buildCorrectAnswer(): unknown {
    if (questionType === 'true_false') return correct === true
    if (questionType === 'multiple_select') return Array.isArray(correct) ? correct : []
    if (questionType === 'multiple_choice') return String(correct)
    if (questionType === 'numeric') return Number(shortAnswer)
    if (questionType === 'short_answer') return shortAnswer.trim()
    return undefined
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!user || !subjectId || !text.trim()) { setError('La matière et l’énoncé sont obligatoires.'); return }
    if ((questionType === 'multiple_choice' || questionType === 'multiple_select') && options.some(option => !option.text.trim())) { setError('Chaque proposition doit être renseignée.'); return }
    if ((questionType === 'multiple_choice' || questionType === 'multiple_select') && (Array.isArray(correct) ? correct.length === 0 : !correct)) { setError('Sélectionnez au moins une bonne réponse.'); return }
    if ((questionType === 'short_answer' || questionType === 'numeric') && !shortAnswer.trim()) { setError('La bonne réponse est obligatoire.'); return }
    try {
      const payload = { subjectId, contentNodeId: nodeId || undefined, type: questionType, questionContent: { text: text.trim() }, ...(questionType === 'multiple_choice' || questionType === 'multiple_select' ? { options } : {}), ...(questionType !== 'written' ? { correctAnswer: buildCorrectAnswer() } : {}), explanation: explanation.trim(), difficulty, points: Math.max(1, Number(points) || 1) }
      if (editingId) await updateQuestion(editingId, payload)
      else await createQuestion({ ...payload, userId: user.uid })
      setMessage(editingId ? 'Question modifiée.' : 'Question créée en brouillon.'); resetForm(); await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible d’enregistrer la question.') }
  }

  async function createSet(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!user || !subjectId || !setTitle.trim() || selectedQuestionIds.length === 0) { setError('Indiquez un titre et sélectionnez au moins une question publiée.'); return }
    try {
      await createQuestionSet({ title: setTitle, description: setDescription, subjectId, questionIds: selectedQuestionIds, type: setType, settings: { showScore, showCorrections, showExplanations, showPoints, allowRetry, passingScore: Math.min(100, Math.max(0, Number(passingScore) || 0)) }, userId: user.uid })
      setSetTitle(''); setSetDescription(''); setSelectedQuestionIds([]); setMessage(`${setTypeLabel[setType]} créé en brouillon.`); await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de créer cette évaluation.') }
  }

  async function publishSet(set: QuestionSet) {
    try { await updateQuestionSetStatus(set.id, set.status === 'published' ? 'draft' : 'published'); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Impossible de modifier le statut.') }
  }

  async function removeSet(set: QuestionSet) {
    if (!window.confirm(`Supprimer « ${set.title} » ?`)) return
    try { await deleteQuestionSet(set.id); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de supprimer.') }
  }

  async function publishQuestion(question: Question) {
    try { await updateQuestion(question.id, { status: question.status === 'published' ? 'draft' : 'published' }); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de modifier le statut.') }
  }

  async function removeQuestion(question: Question) {
    if (!window.confirm(`Supprimer la question « ${String(question.questionContent.text ?? '')} » ?`)) return
    try { await deleteQuestion(question.id); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de supprimer.') }
  }

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Évaluation</p><h1>Questions, exercices & quiz</h1><p className="page-description">Tout est créé indépendamment du concours et associé directement à une Matière.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success">{message}</div>}

    <Card className="admin-form-card"><h2>1. Choisir une Matière</h2><select className="admin-select" value={subjectId} onChange={e => { setSubjectId(e.target.value); resetForm(); setSelectedQuestionIds([]) }}><option value="">Sélectionner une matière...</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>{subjectId && <p className="page-description">Les éléments créés ici seront disponibles dans tous les concours qui utilisent cette Matière.</p>}</Card>

    {subjectId && <>
      <Card className="admin-form-card"><h2>2. Banque de questions</h2><form className="auth-form" onSubmit={saveQuestion}>
        <label>Type<select className="admin-select" value={questionType} onChange={e => { const next = e.target.value as QuestionType; setQuestionType(next); setCorrect(next === 'multiple_choice' ? 'a' : next === 'multiple_select' ? [] : next === 'true_false' ? true : '') }}><option value="multiple_choice">QCM — une réponse</option><option value="multiple_select">QCM — plusieurs réponses</option><option value="true_false">Vrai / Faux</option><option value="short_answer">Réponse courte</option><option value="numeric">Réponse numérique</option><option value="written">Question écrite</option></select></label>
        <label>Chapitre (optionnel)<select className="admin-select" value={nodeId} onChange={e => setNodeId(e.target.value)}><option value="">Toute la Matière</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
        <label>Énoncé<textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Écrivez la question..." /></label>
        {(questionType === 'multiple_choice' || questionType === 'multiple_select') && <div className="question-options-editor"><strong>Propositions</strong>{options.map((option, index) => <div className="question-option-row" key={option.id}><input value={option.text} onChange={e => setOptions(current => current.map(item => item.id === option.id ? { ...item, text: e.target.value } : item))} placeholder={`Proposition ${option.label}`} /><label className="question-correct"><input type={questionType === 'multiple_select' ? 'checkbox' : 'radio'} name="correct-option" checked={Array.isArray(correct) ? correct.includes(option.id) : correct === option.id} onChange={e => { if (questionType === 'multiple_select') { const current = Array.isArray(correct) ? correct : []; setCorrect(e.target.checked ? [...current, option.id] : current.filter(id => id !== option.id)) } else setCorrect(option.id) }} /> Bonne réponse</label>{index >= 4 && <button type="button" onClick={() => setOptions(current => current.filter(item => item.id !== option.id))}>Retirer</button>}</div>)}<button type="button" className="ui-button ui-button-secondary" onClick={() => setOptions(current => [...current, { id: `option-${current.length + 1}`, label: String.fromCharCode(65 + current.length), text: '' }])}>Ajouter une proposition</button></div>}
        {questionType === 'true_false' && <label>Bonne réponse<select className="admin-select" value={String(correct)} onChange={e => setCorrect(e.target.value === 'true')}><option value="true">Vrai</option><option value="false">Faux</option></select></label>}
        {(questionType === 'short_answer' || questionType === 'numeric') && <label>Bonne réponse<input value={shortAnswer} onChange={e => setShortAnswer(e.target.value)} type={questionType === 'numeric' ? 'number' : 'text'} /></label>}
        <div className="admin-form-grid"><label>Difficulté<select className="admin-select" value={difficulty} onChange={e => setDifficulty(e.target.value as QuestionDifficulty)}><option value="easy">Facile</option><option value="medium">Moyenne</option><option value="hard">Difficile</option></select></label><label>Points<input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} /></label></div>
        <label>Explication / correction<textarea rows={3} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Optionnel" /></label>
        <div className="admin-list-actions"><button className="ui-button ui-button-primary">{editingId ? 'Enregistrer les modifications' : 'Créer la question'}</button>{editingId && <button type="button" className="ui-button ui-button-secondary" onClick={resetForm}>Annuler</button>}</div>
      </form></Card>

      <section className="admin-list-section"><h2>Questions de {subjects.find(s => s.id === subjectId)?.name}</h2><div className="admin-list">{questions.map(question => <Card className="admin-list-row" key={question.id}><div><strong>{String(question.questionContent.text ?? '')}</strong><span>{question.type} · {question.points} pt{question.points === 1 ? '' : 's'} · {question.difficulty}{question.contentNodeId ? ' · chapitre associé' : ''}</span></div><div className="admin-list-actions"><span className={`status-pill status-${question.status}`}>{question.status}</span><button className="ui-button ui-button-secondary" onClick={() => prepareEdit(question)}>Modifier</button><button className="ui-button ui-button-secondary" onClick={() => void publishQuestion(question)}>{question.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="ui-button ui-button-secondary" onClick={() => void removeQuestion(question)}>Supprimer</button></div></Card>)}{questions.length === 0 && <Card className="catalogue-empty"><p>Aucune question pour cette Matière.</p></Card>}</div></section>

      <Card className="admin-form-card"><h2>3. Créer une évaluation</h2><p className="page-description">Sélectionnez les questions publiées de cette Matière pour créer un ensemble réutilisable.</p><form className="auth-form" onSubmit={createSet}><div className="admin-form-grid"><label>Type<select className="admin-select" value={setType} onChange={e => setSetType(e.target.value as QuestionSetType)}><option value="quiz">Quiz</option><option value="exercise">Exercice</option><option value="important_questions">Questions importantes</option><option value="practice">Entraînement</option></select></label><label>Titre<input value={setTitle} onChange={e => setSetTitle(e.target.value)} placeholder="Quiz Français — Chapitre 1" /></label></div><label>Description<textarea rows={3} value={setDescription} onChange={e => setSetDescription(e.target.value)} /></label><div className="practice-question-picker">{publishedQuestions.map(question => <label key={question.id} className="practice-picker-row"><input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={() => setSelectedQuestionIds(current => current.includes(question.id) ? current.filter(id => id !== question.id) : [...current, question.id])} /><span>{String(question.questionContent.text ?? '')}</span></label>)}{publishedQuestions.length === 0 && <p>Aucune question publiée disponible.</p>}</div>{setType !== 'important_questions' && <div className="admin-settings-grid"><strong>Résultats</strong><label><input type="checkbox" checked={showScore} onChange={e => setShowScore(e.target.checked)} /> Afficher le score</label><label><input type="checkbox" checked={showCorrections} onChange={e => setShowCorrections(e.target.checked)} /> Afficher les corrections</label><label><input type="checkbox" checked={showExplanations} onChange={e => setShowExplanations(e.target.checked)} /> Afficher les explications</label><label><input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} /> Afficher les points</label><label><input type="checkbox" checked={allowRetry} onChange={e => setAllowRetry(e.target.checked)} /> Autoriser plusieurs essais</label><label>Seuil de réussite (%)<input type="number" min="0" max="100" value={passingScore} onChange={e => setPassingScore(e.target.value)} /></label></div>}<button className="ui-button ui-button-primary">Créer en brouillon</button></form></Card>

      <section className="admin-list-section"><h2>Évaluations de la Matière</h2><div className="admin-list">{sets.map(set => <Card className="admin-list-row" key={set.id}><div><strong>{set.title}</strong><span>{setTypeLabel[set.type]} · {set.questions.length} question{set.questions.length === 1 ? '' : 's'}</span></div><div className="admin-list-actions"><span className={`status-pill status-${set.status}`}>{set.status}</span><button className="ui-button ui-button-secondary" onClick={() => void publishSet(set)}>{set.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="ui-button ui-button-secondary" onClick={() => void removeSet(set)}>Supprimer</button></div></Card>)}{sets.length === 0 && <Card className="catalogue-empty"><p>Aucun quiz, exercice ou ensemble de questions importantes.</p></Card>}</div></section>
    </>}
  </Container>
}
