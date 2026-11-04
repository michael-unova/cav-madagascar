import { useCallback, useEffect, useState } from 'react'
import { confirmAction } from './ConfirmDialog'
import { EyeIcon, ContentEditIcon, PencilIcon } from './ActionIcons'
import { LessonContentReader } from './LessonContentReader'
import { RichLessonEditor, sanitizeLessonHtml } from './RichLessonEditor'
import {
  createCoursePaper,
  deleteCoursePaper,
  listCoursePapers,
  updateCoursePaper,
} from '../features/coursePapers'
import { DEFAULT_COURSE_PAPER_TITLE } from '../types/coursePaper'
import type { CoursePaper } from '../types/coursePaper'

interface Props {
  courseId: string
  userId: string
}

interface SettingsForm {
  title: string
  description: string
  timeLimit: string
  passMark: string
}

const EMPTY_FORM: SettingsForm = { title: DEFAULT_COURSE_PAPER_TITLE, description: '', timeLimit: '', passMark: '' }

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function describePaper(paper: CoursePaper) {
  const parts = [paper.status === 'published' ? 'Publié' : 'Brouillon']
  parts.push(paper.timeLimitMinutes ? `${paper.timeLimitMinutes} min` : 'Sans limite de temps')
  if (paper.passMark !== null) parts.push(`Réussite à ${paper.passMark} %`)
  return parts.join(' · ')
}

/**
 * "Sujets types de ce concours": mock exam papers written in the same rich editor
 * as lessons. Only rendered for a concours that is already saved.
 */
export function CoursePapersAdmin({ courseId, userId }: Props) {
  const [papers, setPapers] = useState<CoursePaper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // 'new' = creation form, a paper id = settings of that paper, null = closed.
  const [settingsTarget, setSettingsTarget] = useState<'new' | string | null>(null)
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM)
  const [openPaperId, setOpenPaperId] = useState<string | null>(null)
  const [draftHtml, setDraftHtml] = useState('')
  const [preview, setPreview] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setPapers(await listCoursePapers(courseId))
      setError('')
    } catch (e) {
      console.error(e)
      setError('Impossible de charger les sujets types de ce concours.')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  // The parent keys this component by concours id, so state starts fresh for each concours.
  useEffect(() => {
    let cancelled = false
    listCoursePapers(courseId)
      .then(list => { if (!cancelled) setPapers(list) })
      .catch(e => { console.error(e); if (!cancelled) setError('Impossible de charger les sujets types de ce concours.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [courseId])

  const openPaper = papers.find(paper => paper.id === openPaperId) ?? null
  const dirty = Boolean(openPaper) && draftHtml !== openPaper!.html

  function startCreate() {
    setError(''); setMessage('')
    setForm(EMPTY_FORM)
    setSettingsTarget('new')
  }

  function startSettings(paper: CoursePaper) {
    setError(''); setMessage('')
    setForm({
      title: paper.title,
      description: paper.description,
      timeLimit: paper.timeLimitMinutes ? String(paper.timeLimitMinutes) : '',
      passMark: paper.passMark !== null ? String(paper.passMark) : '',
    })
    setSettingsTarget(paper.id)
  }

  function validateForm() {
    const timeLimit = parseOptionalNumber(form.timeLimit)
    const passMark = parseOptionalNumber(form.passMark)
    if (!form.title.trim()) return { problem: 'Le titre est obligatoire.' as const }
    if (form.timeLimit.trim() && (timeLimit === null || timeLimit <= 0)) return { problem: 'La limite de temps doit être un nombre de minutes supérieur à 0.' as const }
    if (form.passMark.trim() && (passMark === null || passMark < 0 || passMark > 100)) return { problem: 'La note de réussite doit être un pourcentage entre 0 et 100.' as const }
    return { problem: null, timeLimit, passMark }
  }

  async function saveSettings() {
    const result = validateForm()
    if (result.problem) { setError(result.problem); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const input = { title: form.title, description: form.description, timeLimitMinutes: result.timeLimit, passMark: result.passMark }
      if (settingsTarget === 'new') {
        const nextOrder = papers.reduce((max, paper) => Math.max(max, paper.order), -1) + 1
        const id = await createCoursePaper(courseId, input, nextOrder, userId)
        const list = await listCoursePapers(courseId)
        setPapers(list)
        setSettingsTarget(null)
        setMessage('Sujet type créé en brouillon. Rédigez maintenant son contenu.')
        const created = list.find(paper => paper.id === id)
        if (created) { setOpenPaperId(id); setDraftHtml(created.html); setPreview(false) }
      } else if (settingsTarget) {
        await updateCoursePaper(settingsTarget, input, userId)
        await refresh()
        setSettingsTarget(null)
        setMessage('Paramètres du sujet type enregistrés.')
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer le sujet type.')
    } finally {
      setBusy(false)
    }
  }

  function openEditor(paper: CoursePaper) {
    setError(''); setMessage('')
    setSettingsTarget(null)
    setOpenPaperId(paper.id)
    setDraftHtml(paper.html)
    setPreview(false)
  }

  async function closeEditor() {
    if (dirty && !(await confirmAction({
      title: 'Quitter sans enregistrer ?',
      description: 'Les modifications du contenu de ce sujet type n’ont pas été enregistrées.',
      confirmLabel: 'Quitter',
    }))) return
    setOpenPaperId(null)
    setPreview(false)
  }

  async function saveContent() {
    if (!openPaper || !draftHtml.trim()) return
    setBusy(true); setError(''); setMessage('')
    try {
      await updateCoursePaper(openPaper.id, { html: sanitizeLessonHtml(draftHtml.trim()) }, userId)
      await refresh()
      setMessage('Sujet type enregistré.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer le sujet type.')
    } finally {
      setBusy(false)
    }
  }

  async function setPublication(paper: CoursePaper, publish: boolean) {
    if (publish && !(paper.id === openPaperId ? draftHtml : paper.html).trim()) {
      setError('Rédigez le contenu du sujet type avant de le publier.')
      return
    }
    setBusy(true); setError(''); setMessage('')
    try {
      // Publishing from the editor also saves the text on screen, so students never see an older version.
      const html = publish && paper.id === openPaperId && dirty ? sanitizeLessonHtml(draftHtml.trim()) : undefined
      await updateCoursePaper(paper.id, { status: publish ? 'published' : 'draft', ...(html !== undefined ? { html } : {}) }, userId)
      await refresh()
      setMessage(publish ? 'Sujet type publié.' : 'Sujet type dépublié.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de modifier la publication.')
    } finally {
      setBusy(false)
    }
  }

  async function removePaper(paper: CoursePaper) {
    if (!(await confirmAction({
      title: 'Supprimer ce sujet type ?',
      description: <>Le sujet type <strong>« {paper.title} »</strong> sera supprimé définitivement. Cette action est irréversible.</>,
    }))) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deleteCoursePaper(paper.id)
      if (openPaperId === paper.id) setOpenPaperId(null)
      if (settingsTarget === paper.id) setSettingsTarget(null)
      await refresh()
      setMessage('Sujet type supprimé.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de supprimer le sujet type.')
    } finally {
      setBusy(false)
    }
  }

  const settingsForm = settingsTarget && (
    <div className="compact-create-form course-paper-form">
      <div className="lesson-workspace-head"><div>
        <span className="pill">{settingsTarget === 'new' ? 'NOUVEAU SUJET TYPE' : 'PARAMÈTRES'}</span>
        <h3>{settingsTarget === 'new' ? 'Créer un sujet type' : 'Modifier les paramètres'}</h3>
      </div></div>
      <div className="form-grid">
        <label>Titre
          <input className="fake-input" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={DEFAULT_COURSE_PAPER_TITLE} />
        </label>
        <label>Limite de temps <span className="optional-label">(facultative)</span>
          <div className="input-with-suffix"><input className="fake-input" type="number" min="1" max="1440" inputMode="numeric" value={form.timeLimit} onChange={e => setForm({ ...form, timeLimit: e.target.value })} placeholder="Ex. 180" /><span>minutes</span></div>
        </label>
        <label>Note de réussite <span className="optional-label">(facultative)</span>
          <div className="input-with-suffix"><input className="fake-input" type="number" min="0" max="100" inputMode="decimal" value={form.passMark} onChange={e => setForm({ ...form, passMark: e.target.value })} placeholder="Ex. 50" /><span>%</span></div>
        </label>
        <label className="wide">Description <span className="optional-label">(facultative)</span>
          <textarea className="fake-textarea short" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Consignes, durée conseillée, matières couvertes…" />
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" className="primary" disabled={busy || !form.title.trim()} onClick={() => void saveSettings()}>{busy ? 'Enregistrement...' : settingsTarget === 'new' ? 'Créer en brouillon' : 'Enregistrer'}</button>
        <button type="button" className="outline" disabled={busy} onClick={() => setSettingsTarget(null)}>Annuler</button>
      </div>
    </div>
  )

  if (openPaper) {
    return (
      <section className="panel course-papers-section course-paper-editor" style={{ marginBottom: 0 }}>
        <button type="button" className="back" onClick={() => void closeEditor()}>← Retour aux sujets types</button>
        {error && <div className="form-error" role="alert">{error}</div>}
        {message && <div className="form-success" role="status">{message}</div>}
        <div className="lesson-workspace-head">
          <div>
            <span className="pill">SUJET TYPE</span>
            <h2>{openPaper.title}</h2>
            <small>{describePaper(openPaper)}</small>
          </div>
          <div className="lesson-workspace-actions">
            <button type="button" className="outline small-btn lesson-head-btn lesson-head-title" disabled={busy} onClick={() => startSettings(openPaper)}><PencilIcon />Paramètres</button>
            <button type="button" className={`small-btn lesson-head-btn lesson-head-content${preview ? ' is-edit' : ''}`} onClick={() => setPreview(value => !value)}>{preview ? <><ContentEditIcon />Éditer le contenu</> : <><EyeIcon />Aperçu</>}</button>
            {openPaper.status === 'published'
              ? <button type="button" className="outline small-btn lesson-head-btn" disabled={busy} onClick={() => void setPublication(openPaper, false)}>Dépublier</button>
              : <button type="button" className="primary small-btn lesson-head-btn" disabled={busy} onClick={() => void setPublication(openPaper, true)}>Publier</button>}
          </div>
        </div>
        {settingsForm}
        {preview
          ? <LessonContentReader html={draftHtml} />
          : <>
            <RichLessonEditor
              value={draftHtml}
              onChange={setDraftHtml}
              storageFolder={`content-subjects/course-papers/${courseId}/${openPaper.id}`}
              initialExpanded
              lessonTitle={openPaper.title}
              onExitExpanded={() => setPreview(true)}
              onSave={saveContent}
              isSaving={busy}
              canSave={Boolean(draftHtml.trim())}
            />
            <div className="lesson-save-bar">
              <button type="button" className="primary" disabled={busy || !draftHtml.trim() || !dirty} onClick={() => void saveContent()}>{busy ? 'Enregistrement...' : 'Enregistrer'}</button>
              <span>{dirty ? 'Modifications non enregistrées.' : 'Le brouillon peut être enregistré à tout moment. L’aperçu n’est pas une publication.'}</span>
            </div>
          </>}
      </section>
    )
  }

  return (
    <section className="panel course-papers-section" style={{ marginBottom: 0 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">TESTEZ VOS CONNAISSANCES</div>
          <h2>Sujets types de ce concours</h2>
          <p>Rédigez des sujets d’examen blanc propres à ce concours, avec le même éditeur que les leçons. Les étudiants peuvent les ouvrir à tout moment, même sans avoir terminé les leçons.</p>
        </div>
        <button type="button" className="primary small-btn" disabled={busy || settingsTarget === 'new'} onClick={startCreate}>+ Nouveau sujet type</button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="form-success" role="status">{message}</div>}
      {settingsForm}
      {loading
        ? <div className="empty-state compact">Chargement des sujets types…</div>
        : papers.length === 0
          ? <div className="empty-state compact">Aucun sujet type pour ce concours. Créez-en un pour proposer un examen blanc aux étudiants.</div>
          : <div className="admin-list course-paper-list">
            {papers.map(paper => (
              <div className="admin-course course-paper-row" key={paper.id}>
                <div>
                  <strong>{paper.title}</strong>
                  <span>{describePaper(paper)}{paper.html.trim() ? '' : ' · Contenu vide'}</span>
                  {paper.description && <span>{paper.description}</span>}
                </div>
                <div className="admin-list-actions">
                  <span className={`status ${paper.status === 'published' ? 'published' : 'draft'}`}>{paper.status === 'published' ? 'Publié' : 'Brouillon'}</span>
                  <button type="button" className="primary small-btn" disabled={busy} onClick={() => openEditor(paper)}>Rédiger</button>
                  <button type="button" className="outline small-btn" disabled={busy} onClick={() => startSettings(paper)}>Paramètres</button>
                  <button type="button" className="outline small-btn" disabled={busy} onClick={() => void setPublication(paper, paper.status !== 'published')}>{paper.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                  <button type="button" className="outline small-btn danger-outline" disabled={busy} onClick={() => void removePaper(paper)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>}
    </section>
  )
}
