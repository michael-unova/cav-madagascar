import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listPublishedCourses } from '../features/courses'
import { createPsychotechnicalQuestion, createPsychotechnicalTest, deletePsychotechnicalQuestion, deletePsychotechnicalTest, listAdminPsychotechnicalTests, listPsychotechnicalQuestions, updatePsychotechnicalQuestion, updatePsychotechnicalTestPlacement, updatePsychotechnicalTestStatus } from '../features/questions'
import type { Course } from '../types/course'
import type { PsychotechnicalDomain, PsychotechnicalQuestion, PsychotechnicalQuestionType } from '../types/psychotechnical'
import { PSYCHOTECHNICAL_DOMAIN_LABELS } from '../types/psychotechnical'
import { confirmAction } from '../components/ConfirmDialog'

const domains: PsychotechnicalDomain[] = ['logic', 'numerical', 'spatial', 'attention', 'memory', 'reaction']
const optionIds = ['a', 'b', 'c', 'd']
const domainIcons: Record<PsychotechnicalDomain, string> = {
  logic: '◈', numerical: '∑', spatial: '◇', attention: '◉', memory: '⌁', reaction: '⚡',
}

function formatStatus(status: string) {
  return status === 'published' ? 'Publié' : status === 'draft' ? 'Brouillon' : 'Archivé'
}

/** When set, the page works inside a chapter: the test is created for (and placed in) that chapter. */
export type PsychotechnicalChapterContext = {
  subjectId: string
  contentNodeId: string
  /** Concours that already use this matière: the new test is assigned to them automatically. */
  courseIds: string[]
  /** Position at the end of the chapter's content list. */
  nextOrder: number
  onDone: (message: string) => void
  onCancel: () => void
}

export function AdminPsychotechnicalPage({ onBack, chapter }: { onBack?: () => void; chapter?: PsychotechnicalChapterContext }) {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [questions, setQuestions] = useState<PsychotechnicalQuestion[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [savingTest, setSavingTest] = useState(false)
  const [questionSearch, setQuestionSearch] = useState('')
  const [questionFilter, setQuestionFilter] = useState<'all' | PsychotechnicalDomain>('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<'bank' | 'compose' | 'tests'>(chapter ? 'compose' : 'bank')

  const [domain, setDomain] = useState<PsychotechnicalDomain>('logic')
  const [type, setType] = useState<PsychotechnicalQuestionType>('multiple_choice')
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [options, setOptions] = useState(optionIds.map(id => ({ id, text: '' })))
  const [correct, setCorrect] = useState('a')
  const [explanation, setExplanation] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [points, setPoints] = useState('1')
  const [editing, setEditing] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [duration, setDuration] = useState('30')
  const [questionCount, setQuestionCount] = useState('20')
  const [distributions, setDistributions] = useState<Record<PsychotechnicalDomain, string>>({ logic: '', numerical: '', spatial: '', attention: '', memory: '', reaction: '' })

  async function refresh() {
    setLoading(true)
    try {
      const [q, t, c] = await Promise.all([listPsychotechnicalQuestions(), listAdminPsychotechnicalTests(), listPublishedCourses()])
      setQuestions(q)
      setTests(t)
      setCourses(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const published = useMemo(() => questions.filter(q => q.status === 'published'), [questions])
  const filteredQuestions = useMemo(() => {
    const query = questionSearch.trim().toLowerCase()
    return questions.filter(q => {
      const matchesDomain = questionFilter === 'all' || q.domain === questionFilter
      const matchesSearch = !query || q.prompt.toLowerCase().includes(query)
      return matchesDomain && matchesSearch
    })
  }, [questions, questionFilter, questionSearch])
  const selectedPublished = useMemo(() => published.filter(q => selected.includes(q.id)), [published, selected])
  const publishedByDomain = useMemo(() => domains.reduce<Record<PsychotechnicalDomain, number>>((acc, d) => {
    acc[d] = selectedPublished.filter(q => q.domain === d).length
    return acc
  }, { logic: 0, numerical: 0, spatial: 0, attention: 0, memory: 0, reaction: 0 }), [selectedPublished])

  function clearFeedback() { setError(''); setMessage('') }
  function resetQ() {
    setEditing(null); setDomain('logic'); setType('multiple_choice'); setPrompt(''); setImageUrl(''); setOptions(optionIds.map(id => ({ id, text: '' }))); setCorrect('a'); setExplanation(''); setDifficulty('medium'); setPoints('1')
  }

  async function saveQ() {
    clearFeedback()
    if (!user || !prompt.trim()) { setError('L’énoncé est obligatoire.'); return }
    if (type === 'multiple_choice' && options.filter(o => o.text.trim()).length < 2) { setError('Ajoutez au moins deux propositions.'); return }
    setSavingQuestion(true)
    try {
      const data = {
        domain, type, prompt: prompt.trim(),
        correctAnswer: type === 'true_false' ? correct === 'true' : correct.trim(),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        ...(type === 'multiple_choice' ? { options: options.filter(o => o.text.trim()) } : {}),
        ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
        difficulty, points: Math.max(1, Number(points) || 1),
      }
      if (editing) await updatePsychotechnicalQuestion(editing, data)
      else await createPsychotechnicalQuestion({ ...data, userId: user.uid })
      resetQ(); await refresh(); setMessage(editing ? 'Question mise à jour.' : 'Question créée en brouillon.')
      setActiveSection('bank')
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la question.') } finally { setSavingQuestion(false) }
  }

  function autoDistribute() {
    const count = Math.max(1, Number(questionCount) || 1)
    if (selectedPublished.length < count) { setError(`Sélectionnez au moins ${count} questions publiées avant de répartir automatiquement.`); return }
    const next: Record<PsychotechnicalDomain, string> = { logic: '', numerical: '', spatial: '', attention: '', memory: '', reaction: '' }
    let remaining = count
    const available = domains.map(d => ({ domain: d, available: publishedByDomain[d] })).filter(x => x.available > 0)
    for (let i = 0; i < available.length && remaining > 0; i += 1) {
      const slots = available.length - i
      const target = Math.min(available[i].available, Math.max(1, Math.ceil(remaining / slots)))
      next[available[i].domain] = String(target)
      remaining -= target
    }
    setDistributions(next)
    clearFeedback()
  }

  async function createTest() {
    clearFeedback()
    if (!user || !title.trim() || (!chapter && courseIds.length === 0)) { setError(chapter ? 'Ajoutez un titre au test.' : 'Ajoutez un titre et au moins un concours.'); return }
    const count = Math.max(1, Number(questionCount) || 1)
    if (selectedPublished.length < count) { setError(`Sélectionnez au moins ${count} questions publiées pour ce test.`); return }
    const dist = domains.map(d => ({ domain: d, count: Number(distributions[d] || 0) })).filter(x => x.count > 0)
    const requested = dist.reduce((n, x) => n + x.count, 0)
    if (requested && requested !== count) { setError(`La répartition doit totaliser ${count} questions.`); return }
    for (const d of dist) {
      if (selectedPublished.filter(q => q.domain === d.domain).length < d.count) { setError(`Pas assez de questions publiées en ${PSYCHOTECHNICAL_DOMAIN_LABELS[d.domain]}.`); return }
    }
    setSavingTest(true)
    try {
      await createPsychotechnicalTest({ title: title.trim(), description: description.trim(), courseIds: chapter ? chapter.courseIds : courseIds, distributions: dist, questionIds: selected, settings: { durationMinutes: Math.max(1, Number(duration) || 30), questionCount: count, randomizeQuestions: true, randomizeOptions: true, showCorrections: true }, userId: user.uid, ...(chapter ? { subjectId: chapter.subjectId, contentNodeId: chapter.contentNodeId, contentOrder: chapter.nextOrder } : {}) })
      if (chapter) { chapter.onDone('Test psychotechnique ajouté au chapitre (brouillon).'); return }
      setTitle(''); setDescription(''); setCourseIds([]); setSelected([]); setDistributions({ logic: '', numerical: '', spatial: '', attention: '', memory: '', reaction: '' }); await refresh(); setMessage('Test créé en brouillon.'); setActiveSection('tests')
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de créer le test.') } finally { setSavingTest(false) }
  }

  async function attachExistingTest(testId: string) {
    if (!chapter) return
    clearFeedback()
    setSavingTest(true)
    try {
      await updatePsychotechnicalTestPlacement(testId, { subjectId: chapter.subjectId, contentNodeId: chapter.contentNodeId, contentOrder: chapter.nextOrder })
      chapter.onDone('Test psychotechnique ajouté au chapitre.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’ajouter ce test au chapitre.') } finally { setSavingTest(false) }
  }

  async function toggleQuestion(q: PsychotechnicalQuestion) {
    clearFeedback()
    try { await updatePsychotechnicalQuestion(q.id, { status: q.status === 'published' ? 'draft' : 'published' }); await refresh(); setMessage(q.status === 'published' ? 'Question dépubliée.' : 'Question publiée.') } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de modifier le statut.') }
  }

  function editQuestion(q: PsychotechnicalQuestion) {
    setEditing(q.id); setDomain(q.domain); setType(q.type); setPrompt(q.prompt); setImageUrl(q.imageUrl ?? ''); setOptions(q.options?.length ? q.options : optionIds.map(id => ({ id, text: '' }))); setCorrect(String(q.correctAnswer ?? 'a')); setExplanation(q.explanation ?? ''); setDifficulty(q.difficulty); setPoints(String(q.points)); setActiveSection('bank'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <Container className="page-container psych-admin-page">
    {chapter ? <div className="psych-back-row"><button className="psych-back-button" onClick={chapter.onCancel}>← Retour au chapitre</button><span className="psych-help">Le test sera ajouté à ce chapitre automatiquement</span></div> : <div className="psych-back-row"><button className="psych-back-button" onClick={() => onBack ? onBack() : window.history.back()}>← Tableau de bord</button><span className="psych-help">Création simple · réutilisation automatique</span></div>}

    {!chapter && <header className="psych-hero">
      <div>
        <div className="eyebrow">ÉVALUATION</div>
        <h1>Tests psychotechniques</h1>
        <p>Construisez une banque de questions une seule fois, puis assemblez des tests réutilisables pour plusieurs concours.</p>
      </div>
      <div className="psych-hero-actions"><button className="ui-button ui-button-secondary" onClick={() => { clearFeedback(); setActiveSection('bank'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>+ Question</button><button className="ui-button ui-button-primary" onClick={() => { clearFeedback(); setActiveSection('compose'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>+ Nouveau test</button></div>
    </header>}

    {(error || message) && <div className={`psych-feedback ${error ? 'is-error' : 'is-success'}`} role="status"><span>{error ? '!' : '✓'}</span><div>{error || message}</div><button onClick={clearFeedback} aria-label="Fermer">×</button></div>}

    {!chapter && <section className="psych-stats" aria-label="Résumé">
      <Card><span className="psych-stat-icon blue">⌁</span><div><strong>{questions.length}</strong><span>Questions dans la banque</span></div></Card>
      <Card><span className="psych-stat-icon green">✓</span><div><strong>{published.length}</strong><span>Questions publiées</span></div></Card>
      <Card><span className="psych-stat-icon violet">◫</span><div><strong>{tests.length}</strong><span>Tests créés</span></div></Card>
      <Card><span className="psych-stat-icon amber">◎</span><div><strong>{courses.length}</strong><span>Concours disponibles</span></div></Card>
    </section>}

    <nav className="psych-stepper" aria-label="Gestion des tests">
      {[['bank', '01', 'Banque', `${questions.length} questions`], ['compose', '02', 'Composer', 'Créer un test'], ...(chapter ? [] : [['tests', '03', 'Tests créés', `${tests.length} test${tests.length !== 1 ? 's' : ''}`]])].map(([id, number, label, sub]) => <button key={id} className={activeSection === id ? 'is-active' : ''} onClick={() => setActiveSection(id as typeof activeSection)}><b>{number}</b><span><strong>{label}</strong><small>{sub}</small></span></button>)}
    </nav>

    {activeSection === 'bank' && <>
      <Card className="psych-editor-card">
        <div className="psych-section-head"><div><span className="psych-section-number">01</span><div><h2>{editing ? 'Modifier la question' : 'Créer une question'}</h2><p>Une question publiée peut être réutilisée dans plusieurs tests.</p></div></div><span className="psych-mode-badge">Banque réutilisable</span></div>
        <div className="psych-editor-layout">
          <div className="psych-editor-main">
            <label className="psych-field"><span>Énoncé <em>*</em></span><textarea rows={5} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex. Quelle figure complète logiquement la suite ?" /></label>
            <label className="psych-field"><span>Image ou illustration <small>facultatif</small></span><input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="URL de l’image" /></label>
            {type === 'multiple_choice' && <div className="psych-options"><div className="psych-field-title"><span>Propositions <em>*</em></span><small>Sélectionnez la bonne réponse</small></div>{options.map(o => <div className={`psych-option ${correct === o.id ? 'is-correct' : ''}`} key={o.id}><button type="button" aria-label={`Marquer la proposition ${o.id.toUpperCase()} comme correcte`} onClick={() => setCorrect(o.id)}><span>{o.id.toUpperCase()}</span>{correct === o.id ? '✓' : ''}</button><input value={o.text} onChange={e => setOptions(xs => xs.map(x => x.id === o.id ? { ...x, text: e.target.value } : x))} placeholder={`Proposition ${o.id.toUpperCase()}`} /></div>)}</div>}
            {type === 'true_false' && <label className="psych-field"><span>Bonne réponse <em>*</em></span><select value={correct} onChange={e => setCorrect(e.target.value)}><option value="true">Vrai</option><option value="false">Faux</option></select></label>}
            {(type === 'numeric' || type === 'short_answer') && <label className="psych-field"><span>Bonne réponse <em>*</em></span><input value={correct} onChange={e => setCorrect(e.target.value)} placeholder="Réponse attendue" /></label>}
            <label className="psych-field"><span>Explication <small>facultatif</small></span><textarea rows={3} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Expliquez brièvement le raisonnement attendu." /></label>
          </div>
          <aside className="psych-editor-side">
            <div className="psych-field"><span>Domaine</span><select value={domain} onChange={e => setDomain(e.target.value as PsychotechnicalDomain)}>{domains.map(d => <option key={d} value={d}>{domainIcons[d]} {PSYCHOTECHNICAL_DOMAIN_LABELS[d]}</option>)}</select></div>
            <div className="psych-field"><span>Type</span><select value={type} onChange={e => setType(e.target.value as PsychotechnicalQuestionType)}><option value="multiple_choice">QCM</option><option value="true_false">Vrai / Faux</option><option value="numeric">Réponse numérique</option><option value="short_answer">Réponse courte</option></select></div>
            <div className="psych-two-fields"><label className="psych-field"><span>Difficulté</span><select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)}><option value="easy">Facile</option><option value="medium">Moyenne</option><option value="hard">Difficile</option></select></label><label className="psych-field"><span>Points</span><input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} /></label></div>
            <div className="psych-tip"><strong>Conseil</strong><p>Créez des questions courtes et précises. Elles pourront ensuite être utilisées dans plusieurs concours sans duplication.</p></div>
          </aside>
        </div>
        <div className="psych-editor-footer"><span>{editing ? 'Modification en cours' : 'Brouillon jusqu’à publication'}</span><div>{editing && <button className="ui-button ui-button-secondary" onClick={resetQ}>Annuler</button>}<button className="ui-button ui-button-primary" disabled={savingQuestion} onClick={() => void saveQ()}>{savingQuestion ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer la question'}</button></div></div>
      </Card>

      <Card className="psych-bank-card">
        <div className="psych-list-head"><div><h2>Banque de questions</h2><p>Filtrez, modifiez ou publiez vos questions.</p></div><span className="psych-count-badge">{filteredQuestions.length} / {questions.length}</span></div>
        <div className="psych-toolbar"><label className="psych-search"><span>⌕</span><input value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} placeholder="Rechercher une question..." /></label><select value={questionFilter} onChange={e => setQuestionFilter(e.target.value as typeof questionFilter)}><option value="all">Tous les domaines</option>{domains.map(d => <option key={d} value={d}>{PSYCHOTECHNICAL_DOMAIN_LABELS[d]}</option>)}</select></div>
        <div className="psych-bank-list">{loading ? <div className="psych-empty">Chargement de la banque...</div> : filteredQuestions.length === 0 ? <div className="psych-empty"><strong>Aucune question trouvée</strong><span>Créez votre première question ou modifiez vos filtres.</span></div> : filteredQuestions.map(q => <div className="psych-bank-row" key={q.id}><div className="psych-question-index">{domainIcons[q.domain]}</div><div className="psych-question-copy"><div><span className="psych-domain-pill">{PSYCHOTECHNICAL_DOMAIN_LABELS[q.domain]}</span><span className={`psych-status ${q.status}`}>{formatStatus(q.status)}</span></div><strong>{q.prompt}</strong><small>{q.type === 'multiple_choice' ? 'QCM' : q.type === 'true_false' ? 'Vrai / Faux' : q.type === 'numeric' ? 'Numérique' : 'Réponse courte'} · {q.points} pt · {q.difficulty === 'easy' ? 'Facile' : q.difficulty === 'medium' ? 'Moyenne' : 'Difficile'}</small></div><div className="psych-row-actions"><button onClick={() => editQuestion(q)}>Modifier</button><button onClick={() => void toggleQuestion(q)}>{q.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="danger" onClick={() => { void confirmAction({ title: 'Supprimer cette question ?', description: 'Cette question sera supprimée définitivement.' }).then(ok => { if (ok) void deletePsychotechnicalQuestion(q.id).then(refresh) }) }}>Supprimer</button></div></div>)}</div>
      </Card>
    </>}

    {chapter && activeSection === 'compose' && tests.some(t => !t.contentNodeId) && <Card className="psych-compose-card"><div className="psych-section-head"><div><div><h2>Utiliser un test existant</h2><p>Ajoutez au chapitre un test déjà créé. Il garde ses questions et son état de publication.</p></div></div></div><div className="psych-tests-list">{tests.filter(t => !t.contentNodeId).map(t => <div className="psych-test-row" key={t.id}><div className="psych-test-icon">🧠</div><div className="psych-test-copy"><div><span className={`psych-status ${t.status}`}>{formatStatus(t.status)}</span></div><strong>{t.title}</strong><p>{t.questions.length} questions</p></div><div className="psych-row-actions"><button disabled={savingTest} onClick={() => void attachExistingTest(t.id)}>Ajouter au chapitre</button></div></div>)}</div></Card>}

    {activeSection === 'compose' && <Card className="psych-compose-card">
      <div className="psych-section-head"><div><span className="psych-section-number">02</span><div><h2>Composer un test</h2><p>Choisissez les concours, les questions et la structure. Le reste est automatisé.</p></div></div><span className="psych-mode-badge">Réutilisable</span></div>
      <div className="psych-compose-grid">
        <div className="psych-compose-main">
          <div className="psych-form-block"><div className="psych-block-title"><strong>Informations du test</strong><span>1</span></div><label className="psych-field"><span>Titre <em>*</em></span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Test psychotechnique complet" /></label><label className="psych-field"><span>Description <small>facultatif</small></span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez brièvement ce test." /></label></div>
          {!chapter && <div className="psych-form-block"><div className="psych-block-title"><strong>Concours concernés</strong><span>2</span></div><p className="psych-block-hint">Le même test pourra être utilisé pour plusieurs concours.</p><div className="psych-course-grid">{courses.map(c => <label key={c.id} className={`psych-course-chip ${courseIds.includes(c.id) ? 'is-selected' : ''}`}><input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => setCourseIds(xs => xs.includes(c.id) ? xs.filter(id => id !== c.id) : [...xs, c.id])} /><span>{c.title}</span>{courseIds.includes(c.id) && <b>✓</b>}</label>)}{courses.length === 0 && <div className="psych-empty">Aucun concours publié disponible.</div>}</div></div>}
          <div className="psych-form-block"><div className="psych-block-title"><strong>Questions</strong><span>3</span></div><div className="psych-question-summary"><span><b>{selectedPublished.length}</b> sélectionnées</span><span>Objectif : <b>{Math.max(1, Number(questionCount) || 1)}</b></span><button className="text-button" onClick={() => setActiveSection('bank')}>Gérer la banque →</button></div><div className="psych-picker-list">{published.map(q => <label key={q.id} className={`psych-picker ${selected.includes(q.id) ? 'is-selected' : ''}`}><input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected(xs => xs.includes(q.id) ? xs.filter(id => id !== q.id) : [...xs, q.id])}/><span className="psych-picker-icon">{domainIcons[q.domain]}</span><span className="psych-picker-copy"><strong>{q.prompt}</strong><small>{PSYCHOTECHNICAL_DOMAIN_LABELS[q.domain]} · {q.points} pt</small></span>{selected.includes(q.id) && <b>✓</b>}</label>)}{published.length === 0 && <div className="psych-empty"><strong>Votre banque est encore vide</strong><span>Créez et publiez des questions avant de composer un test.</span><button className="ui-button ui-button-primary" onClick={() => setActiveSection('bank')}>Créer une question</button></div>}</div></div>
        </div>
        <aside className="psych-compose-side"><div className="psych-settings-card"><div className="psych-block-title"><strong>Paramètres du test</strong><span>4</span></div><div className="psych-two-fields"><label className="psych-field"><span>Durée</span><div className="psych-input-suffix"><input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} /><span>min</span></div></label><label className="psych-field"><span>Questions</span><input type="number" min="1" value={questionCount} onChange={e => setQuestionCount(e.target.value)} /></label></div><div className="psych-setting-row"><span>Ordre aléatoire</span><b>Activé</b></div><div className="psych-setting-row"><span>Options aléatoires</span><b>Activé</b></div><div className="psych-setting-row"><span>Corrections</span><b>Activées</b></div></div>
          <div className="psych-distribution-card"><div className="psych-distribution-head"><div><strong>Répartition</strong><span>Optionnelle</span></div><button onClick={autoDistribute}>Auto</button></div><p>Définissez combien de questions seront tirées dans chaque domaine.</p>{domains.map(d => <label className="psych-distribution-row" key={d}><span><i>{domainIcons[d]}</i>{PSYCHOTECHNICAL_DOMAIN_LABELS[d]}</span><small>{publishedByDomain[d]} dispo.</small><input type="number" min="0" value={distributions[d]} onChange={e => setDistributions(x => ({ ...x, [d]: e.target.value }))} /></label>)}<div className="psych-distribution-total"><span>Total demandé</span><strong>{domains.reduce((n, d) => n + Number(distributions[d] || 0), 0)} / {Math.max(1, Number(questionCount) || 1)}</strong></div></div></aside>
      </div>
      <div className="psych-compose-footer"><div>{chapter ? <><strong>{chapter.courseIds.length}</strong> concours (automatique)</> : <><strong>{courseIds.length}</strong> concours</>} · <strong>{selectedPublished.length}</strong> questions sélectionnées</div><button className="ui-button ui-button-primary" disabled={savingTest} onClick={() => void createTest()}>{savingTest ? 'Création...' : 'Créer le test en brouillon'}</button></div>
    </Card>}

    {activeSection === 'tests' && <Card className="psych-tests-card">
      <div className="psych-list-head"><div><h2>Tests créés</h2><p>Publiez ou dépubliez vos tests sans recréer leur contenu.</p></div><button className="ui-button ui-button-primary" onClick={() => setActiveSection('compose')}>+ Nouveau test</button></div>
      <div className="psych-tests-list">{loading ? <div className="psych-empty">Chargement des tests...</div> : tests.length === 0 ? <div className="psych-empty"><strong>Aucun test créé</strong><span>Composez votre premier test à partir de la banque de questions.</span><button className="ui-button ui-button-primary" onClick={() => setActiveSection('compose')}>Composer un test</button></div> : tests.map(t => <div className="psych-test-row" key={t.id}><div className="psych-test-icon">🧠</div><div className="psych-test-copy"><div><span className={`psych-status ${t.status}`}>{formatStatus(t.status)}</span></div><strong>{t.title}</strong><p>{t.questions.length} questions · {t.settings.durationMinutes} min · {t.courseIds.length} concours</p></div><div className="psych-test-courses">{t.courseIds.slice(0, 3).map((id: string) => <span key={id}>{courses.find(c => c.id === id)?.title ?? id}</span>)}{t.courseIds.length > 3 && <span>+{t.courseIds.length - 3}</span>}</div><div className="psych-row-actions"><button onClick={() => void updatePsychotechnicalTestStatus(t.id, t.status === 'published' ? 'draft' : 'published').then(refresh)}>{t.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="danger" onClick={() => { void confirmAction({ title: 'Supprimer ce test ?', description: 'Ce test sera supprimé définitivement.' }).then(ok => { if (ok) void deletePsychotechnicalTest(t.id).then(refresh) }) }}>Supprimer</button></div></div>)}</div>
    </Card>}
  </Container>
}
