import { useCallback, useEffect, useState } from 'react'
import { confirmAction } from './ConfirmDialog'
import { CoursePapersAdmin } from './CoursePapersAdmin'
import {
  createCourseEpreuve,
  deleteCourseEpreuve,
  ensureCoursePaperEpreuves,
  listCourseEpreuves,
  listCoursePapers,
  updateCourseEpreuve,
} from '../features/coursePapers'
import type { CourseEpreuve, CoursePaper } from '../types/coursePaper'

interface Props {
  courseId: string
  userId: string
}

function countLabel(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * "Sujets types de ce concours": the concours is split into épreuves (for example
 * "EPREUVE MATHS"), and each épreuve holds its own Sujets types. Only rendered for a
 * concours that is already saved.
 */
export function CourseEpreuvesAdmin({ courseId, userId }: Props) {
  const [epreuves, setEpreuves] = useState<CourseEpreuve[]>([])
  const [papers, setPapers] = useState<CoursePaper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // 'new' = creation form, an épreuve id = renaming that épreuve, null = closed.
  const [formTarget, setFormTarget] = useState<'new' | string | null>(null)
  const [title, setTitle] = useState('')
  const [openEpreuveId, setOpenEpreuveId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [nextEpreuves, nextPapers] = await Promise.all([listCourseEpreuves(courseId), listCoursePapers(courseId)])
    setEpreuves(nextEpreuves)
    setPapers(nextPapers)
  }, [courseId])

  // The parent keys this component by concours id, so state starts fresh for each concours.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Sujets types written before épreuves existed are moved into a default épreuve first.
      await ensureCoursePaperEpreuves(courseId)
      await refresh()
    })()
      .catch(e => { console.error(e); if (!cancelled) setError('Impossible de charger les épreuves de ce concours.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [courseId, refresh])

  const openEpreuve = epreuves.find(item => item.id === openEpreuveId) ?? null

  function papersOf(epreuveId: string) {
    return papers.filter(paper => paper.epreuveId === epreuveId)
  }

  function startCreate() {
    setError(''); setMessage('')
    setTitle('')
    setFormTarget('new')
  }

  function startRename(epreuve: CourseEpreuve) {
    setError(''); setMessage('')
    setTitle(epreuve.title)
    setFormTarget(epreuve.id)
  }

  async function saveForm() {
    if (!title.trim()) { setError('Le nom de l’épreuve est obligatoire.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      if (formTarget === 'new') {
        const nextOrder = epreuves.reduce((max, item) => Math.max(max, item.order), -1) + 1
        const id = await createCourseEpreuve(courseId, title, nextOrder, userId)
        await refresh()
        setFormTarget(null)
        setOpenEpreuveId(id)
      } else if (formTarget) {
        await updateCourseEpreuve(formTarget, { title }, userId)
        await refresh()
        setFormTarget(null)
        setMessage('Épreuve renommée.')
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’épreuve.')
    } finally {
      setBusy(false)
    }
  }

  async function setPublication(epreuve: CourseEpreuve, publish: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      await updateCourseEpreuve(epreuve.id, { status: publish ? 'published' : 'draft' }, userId)
      await refresh()
      setMessage(publish ? 'Épreuve publiée. Ses sujets types publiés sont visibles des étudiants.' : 'Épreuve dépubliée. Ses sujets types ne sont plus visibles des étudiants.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de modifier la publication.')
    } finally {
      setBusy(false)
    }
  }

  async function removeEpreuve(epreuve: CourseEpreuve) {
    const count = papersOf(epreuve.id).length
    if (!(await confirmAction({
      title: 'Supprimer cette épreuve ?',
      description: <>L’épreuve <strong>« {epreuve.title} »</strong> sera supprimée définitivement{count ? <>, avec ses <strong>{countLabel(count, 'sujet type', 'sujets types')}</strong></> : null}. Cette action est irréversible.</>,
    }))) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deleteCourseEpreuve(epreuve.id)
      if (formTarget === epreuve.id) setFormTarget(null)
      await refresh()
      setMessage('Épreuve supprimée.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de supprimer l’épreuve.')
    } finally {
      setBusy(false)
    }
  }

  // Inside an épreuve: its Sujets types. Back refreshes the counts shown in the list.
  if (openEpreuve) {
    return (
      <CoursePapersAdmin
        key={openEpreuve.id}
        courseId={courseId}
        epreuve={openEpreuve}
        userId={userId}
        onBack={() => { setOpenEpreuveId(null); void refresh().catch(e => console.error(e)) }}
      />
    )
  }

  const form = formTarget && (
    <div className="compact-create-form course-paper-form">
      <div className="lesson-workspace-head"><div>
        <span className="pill">{formTarget === 'new' ? 'NOUVELLE ÉPREUVE' : 'RENOMMER'}</span>
        <h3>{formTarget === 'new' ? 'Créer une épreuve' : 'Renommer l’épreuve'}</h3>
      </div></div>
      <div className="form-grid">
        <label className="wide">Nom de l’épreuve
          <input className="fake-input" autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy) void saveForm() }} placeholder="Ex. EPREUVE MATHS" />
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" className="primary" disabled={busy || !title.trim()} onClick={() => void saveForm()}>{busy ? 'Enregistrement...' : formTarget === 'new' ? 'Créer l’épreuve' : 'Enregistrer'}</button>
        <button type="button" className="outline" disabled={busy} onClick={() => setFormTarget(null)}>Annuler</button>
      </div>
    </div>
  )

  return (
    <section className="panel course-papers-section" style={{ marginBottom: 0 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">TESTEZ VOS CONNAISSANCES</div>
          <h2>Sujets types de ce concours</h2>
          <p>Organisez les sujets d’examen blanc par épreuve (par exemple « EPREUVE MATHS »). Chaque épreuve contient ses sujets types (Sujet type 1, 2, 3…), rédigés avec le même éditeur que les leçons. Les étudiants peuvent les ouvrir à tout moment, même sans avoir terminé les leçons.</p>
        </div>
        <button type="button" className="primary small-btn" disabled={busy || loading || formTarget === 'new'} onClick={startCreate}>+ Nouvelle épreuve</button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="form-success" role="status">{message}</div>}
      {form}
      {loading
        ? <div className="empty-state compact">Chargement des épreuves…</div>
        : epreuves.length === 0
          ? <div className="empty-state compact">Aucune épreuve pour ce concours. Créez-en une (par exemple « EPREUVE MATHS »), puis ajoutez-y ses sujets types.</div>
          : <div className="admin-list course-paper-list">
            {epreuves.map(epreuve => {
              const inside = papersOf(epreuve.id)
              const published = inside.filter(paper => paper.status === 'published').length
              return (
                <div className="admin-course course-paper-row" key={epreuve.id}>
                  <div>
                    <strong>{epreuve.title}</strong>
                    <span>{countLabel(inside.length, 'sujet type', 'sujets types')}{inside.length ? ` · ${countLabel(published, 'publié', 'publiés')}` : ''}</span>
                  </div>
                  <div className="admin-list-actions">
                    <span className={`status ${epreuve.status === 'published' ? 'published' : 'draft'}`}>{epreuve.status === 'published' ? 'Publiée' : 'Brouillon'}</span>
                    <button type="button" className="primary small-btn" disabled={busy} onClick={() => { setError(''); setMessage(''); setFormTarget(null); setOpenEpreuveId(epreuve.id) }}>Sujets types</button>
                    <button type="button" className="outline small-btn" disabled={busy} onClick={() => startRename(epreuve)}>Renommer</button>
                    <button type="button" className="outline small-btn" disabled={busy} onClick={() => void setPublication(epreuve, epreuve.status !== 'published')}>{epreuve.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    <button type="button" className="outline small-btn danger-outline" disabled={busy} onClick={() => void removeEpreuve(epreuve)}>Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>}
    </section>
  )
}
