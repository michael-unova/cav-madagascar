import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmAction } from '../components/ConfirmDialog'
import { listCourseSubjects } from '../features/curriculum'
import {
  deleteQuestionSet,
  listAdminExamPapers,
  listAdminQuestions,
  saveExamPaper,
  updateQuestionSetStatus,
} from '../features/questions'
import type { CourseSubject } from '../types/course'
import type { Question, QuestionSet } from '../types/question'

const DEFAULT_TITLE = 'Sujet type'

function questionLabel(question: Question) {
  return String(question.questionContent.text ?? question.questionContent.html ?? 'Question')
}

/**
 * "Sujets types" of one concours: mock exam papers that combine questions from all the matières of the
 * concours. Every concours manages its own papers; the administrator chooses the title, the description,
 * the optional time limit, the scoring options and which published questions each paper contains.
 */
export function AdminExamPapersPanel({ courseId, userId }: { courseId: string; userId: string }) {
  const [subjects, setSubjects] = useState<CourseSubject[]>([])
  const [questionsBySubject, setQuestionsBySubject] = useState<Record<string, Question[]>>({})
  const [papers, setPapers] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [passingScore, setPassingScore] = useState('50')
  const [showCorrections, setShowCorrections] = useState(true)
  const [showExplanations, setShowExplanations] = useState(true)
  const [allowRetry, setAllowRetry] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(async () => {
    const [courseSubjects, nextPapers] = await Promise.all([listCourseSubjects(courseId, false), listAdminExamPapers(courseId)])
    const entries = await Promise.all(
      courseSubjects.map(async item => [item.subjectId, (await listAdminQuestions(item.subjectId)).filter(q => q.status === 'published')] as const),
    )
    setSubjects(courseSubjects)
    setQuestionsBySubject(Object.fromEntries(entries))
    setPapers(nextPapers)
  }, [courseId])

  useEffect(() => {
    let cancelled = false
    load()
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Impossible de charger les sujets types.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [load])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const totalPublished = useMemo(() => Object.values(questionsBySubject).reduce((sum, list) => sum + list.length, 0), [questionsBySubject])

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setTitle(DEFAULT_TITLE)
    setDescription('')
    setDuration('')
    setPassingScore('50')
    setShowCorrections(true)
    setShowExplanations(true)
    setAllowRetry(true)
    setSelectedIds([])
  }

  function openNew() {
    resetForm()
    setMessage('')
    setError('')
    setFormOpen(true)
  }

  function openEdit(paper: QuestionSet) {
    setMessage('')
    setError('')
    setEditingId(paper.id)
    setTitle(paper.title)
    setDescription(paper.description)
    setDuration(paper.settings?.durationMinutes ? String(paper.settings.durationMinutes) : '')
    setPassingScore(paper.settings?.passingScore !== undefined ? String(paper.settings.passingScore) : '')
    setShowCorrections(paper.settings?.showCorrections !== false)
    setShowExplanations(paper.settings?.showExplanations !== false)
    setAllowRetry(paper.settings?.allowRetry !== false)
    setSelectedIds(paper.questionIds)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleQuestion(id: string) {
    setSelectedIds(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  }

  function toggleSubject(subjectId: string) {
    const ids = (questionsBySubject[subjectId] ?? []).map(q => q.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedSet.has(id))
    setSelectedIds(current => (allSelected ? current.filter(id => !ids.includes(id)) : [...current, ...ids.filter(id => !current.includes(id))]))
  }

  async function save() {
    setError('')
    setMessage('')
    const minutes = duration.trim() ? Number(duration) : 0
    const passing = passingScore.trim() ? Number(passingScore) : undefined
    if (!title.trim()) { setError('Donnez un titre à ce sujet.'); return }
    if (!selectedIds.length) { setError('Sélectionnez au moins une question.'); return }
    if (!Number.isFinite(minutes) || minutes < 0) { setError('La durée doit être un nombre de minutes positif.'); return }
    if (passing !== undefined && (!Number.isFinite(passing) || passing < 0 || passing > 100)) { setError('Le seuil de réussite doit être compris entre 0 et 100.'); return }
    setSaving(true)
    try {
      // Questions are kept in the order of the concours's matières, then in the order they were chosen.
      const ordered = subjects.flatMap(item => (questionsBySubject[item.subjectId] ?? []).map(q => q.id)).filter(id => selectedSet.has(id))
      await saveExamPaper({
        id: editingId ?? undefined,
        courseId,
        title,
        description,
        questionIds: ordered,
        subjects: subjects.map(item => ({ id: item.subjectId, title: item.title })),
        settings: {
          showScore: true,
          showCorrections,
          showExplanations,
          showPoints: true,
          allowRetry,
          ...(passing !== undefined ? { passingScore: passing } : {}),
          ...(minutes > 0 ? { durationMinutes: minutes } : {}),
        },
        userId,
      })
      const wasEditing = Boolean(editingId)
      resetForm()
      await load()
      setMessage(wasEditing ? 'Sujet mis à jour.' : 'Sujet créé en brouillon. Publiez-le pour le rendre accessible aux étudiants.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer ce sujet.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(paper: QuestionSet) {
    setError('')
    setMessage('')
    try {
      await updateQuestionSetStatus(paper.id, paper.status === 'published' ? 'draft' : 'published')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de modifier ce sujet.')
    }
  }

  async function remove(paper: QuestionSet) {
    if (!(await confirmAction({ title: 'Supprimer ce sujet ?', description: <>Le sujet <strong>« {paper.title} »</strong> sera supprimé définitivement. Cette action est irréversible.</> }))) return
    setError('')
    setMessage('')
    try {
      await deleteQuestionSet(paper.id)
      if (editingId === paper.id) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer ce sujet.')
    }
  }

  return (
    <section className="panel course-editor-subjects exam-papers-admin" style={{ marginBottom: 0 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">TESTEZ VOS CONNAISSANCES</div>
          <h2>Sujets types de ce concours</h2>
          <p>Composez des sujets d’examen blanc à partir des questions publiées de toutes les matières du concours. Les étudiants inscrits peuvent les ouvrir à tout moment, même sans avoir terminé les leçons.</p>
        </div>
        {!formOpen && <button className="primary" type="button" onClick={openNew} disabled={loading}>+ Créer un sujet</button>}
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {formOpen && (
        <div className="compact-create-panel">
          <div className="form-grid">
            <label className="wide">Titre du sujet
              <input className="fake-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={DEFAULT_TITLE} />
            </label>
            <label className="wide">Description <span className="optional-label">(facultative)</span>
              <textarea className="fake-textarea short" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Consignes, conditions de l’épreuve, barème…" />
            </label>
            <label>Durée <span className="optional-label">(facultative)</span>
              <div className="input-with-suffix"><input className="fake-input" type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Sans limite" /><span>minutes</span></div>
            </label>
            <label>Seuil de réussite <span className="optional-label">(facultatif)</span>
              <div className="input-with-suffix"><input className="fake-input" type="number" min="0" max="100" value={passingScore} onChange={e => setPassingScore(e.target.value)} /><span>%</span></div>
            </label>
          </div>
          <div className="exam-paper-options">
            <label><input type="checkbox" checked={showCorrections} onChange={e => setShowCorrections(e.target.checked)} /> Afficher la correction après l’épreuve</label>
            <label><input type="checkbox" checked={showExplanations} onChange={e => setShowExplanations(e.target.checked)} disabled={!showCorrections} /> Afficher les explications</label>
            <label><input type="checkbox" checked={allowRetry} onChange={e => setAllowRetry(e.target.checked)} /> Autoriser à recommencer</label>
          </div>

          <div className="section-head" style={{ marginTop: 22 }}>
            <div>
              <div className="eyebrow">QUESTIONS</div>
              <h3>Choisissez les questions par matière</h3>
              <p>{selectedIds.length} question{selectedIds.length === 1 ? '' : 's'} sélectionnée{selectedIds.length === 1 ? '' : 's'} · seules les questions publiées sont proposées.</p>
            </div>
          </div>
          {!subjects.length && <div className="empty-state compact">Ce concours ne contient encore aucune matière. Ajoutez-en d’abord ci-dessus.</div>}
          {subjects.length > 0 && totalPublished === 0 && <div className="empty-state compact">Aucune question publiée dans les matières de ce concours. Créez et publiez des questions dans la banque de questions de chaque matière.</div>}
          {subjects.map(item => {
            const list = questionsBySubject[item.subjectId] ?? []
            const chosen = list.filter(q => selectedSet.has(q.id)).length
            return (
              <div className="exam-paper-subject" key={item.id}>
                <div className="exam-paper-subject-head">
                  <strong>{item.title}</strong>
                  <span>{chosen}/{list.length}</span>
                  {list.length > 0 && <button className="outline small-btn" type="button" onClick={() => toggleSubject(item.subjectId)}>{chosen === list.length ? 'Tout retirer' : 'Tout sélectionner'}</button>}
                </div>
                {list.length === 0
                  ? <p className="form-help">Aucune question publiée pour cette matière.</p>
                  : list.map(q => (
                    <label className="exam-paper-question" key={q.id}>
                      <input type="checkbox" checked={selectedSet.has(q.id)} onChange={() => toggleQuestion(q.id)} />
                      <span>{questionLabel(q)}</span>
                      <small>{q.points} pt{q.points === 1 ? '' : 's'}</small>
                    </label>
                  ))}
              </div>
            )
          })}

          <div className="editor-actions">
            <button className="primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : 'Créer le sujet'}</button>
            <button className="outline" type="button" disabled={saving} onClick={resetForm}>Annuler</button>
          </div>
        </div>
      )}

      <div className="admin-list" style={{ marginTop: 18 }}>
        {loading
          ? <div className="empty-state compact">Chargement des sujets…</div>
          : papers.length === 0
            ? <div className="empty-state compact">Aucun sujet pour ce concours. Les étudiants verront « Le sujet de ce concours sera bientôt disponible. »</div>
            : papers.map(paper => {
              const matieres = new Set(paper.questions.map(q => q.subjectId).filter(Boolean)).size
              const minutes = paper.settings?.durationMinutes
              return (
                <div className="admin-course" key={paper.id}>
                  <div>
                    <strong>{paper.title}</strong>
                    <span>{paper.questions.length} question{paper.questions.length === 1 ? '' : 's'} · {matieres} matière{matieres === 1 ? '' : 's'}{minutes ? ` · ${minutes} min` : ' · sans limite de temps'}</span>
                  </div>
                  <div className="admin-list-actions">
                    <span className={`status ${paper.status === 'published' ? 'published' : 'draft'}`}>{paper.status === 'published' ? 'Publié' : 'Brouillon'}</span>
                    <button className="outline" type="button" onClick={() => openEdit(paper)}>Modifier</button>
                    <button className="outline" type="button" onClick={() => void togglePublish(paper)}>{paper.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    <button className="outline danger-outline" type="button" onClick={() => void remove(paper)}>Supprimer</button>
                  </div>
                </div>
              )
            })}
      </div>
    </section>
  )
}
