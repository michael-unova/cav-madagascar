import { useCallback, useEffect, useState } from 'react'
import { confirmAction } from './ConfirmDialog'
import { EyeIcon, ContentEditIcon, PencilIcon } from './ActionIcons'
import { LessonContentReader } from './LessonContentReader'
import { RichLessonEditor, sanitizeLessonHtml } from './RichLessonEditor'
import {
  createCoursePaper,
  createCoursePaperGroup,
  deleteCoursePaper,
  deleteCoursePaperGroup,
  listCoursePaperGroups,
  listCoursePapers,
  updateCoursePaper,
  updateCoursePaperGroup,
} from '../features/coursePapers'
import { DEFAULT_COURSE_PAPER_TITLE } from '../types/coursePaper'
import type { CoursePaper, CoursePaperGroup } from '../types/coursePaper'

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
  const [groups, setGroups] = useState<CoursePaperGroup[]>([])
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  // 'new' = creation form, a group id = rename form, null = closed.
  const [groupTarget, setGroupTarget] = useState<'new' | string | null>(null)
  const [groupTitle, setGroupTitle] = useState('')
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
      const [paperList, groupList] = await Promise.all([listCoursePapers(courseId), listCoursePaperGroups(courseId)])
      setPapers(paperList)
      setGroups(groupList)
      setError('')
    } catch (e) {
      console.error(e)
      setError('Impossible de charger les épreuves de ce concours.')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  // The parent keys this component by concours id, so state starts fresh for each concours.
  useEffect(() => {
    let cancelled = false
    Promise.all([listCoursePapers(courseId), listCoursePaperGroups(courseId)])
      .then(([paperList, groupList]) => { if (!cancelled) { setPapers(paperList); setGroups(groupList) } })
      .catch(e => { console.error(e); if (!cancelled) setError('Impossible de charger les épreuves de ce concours.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [courseId])

  const openPaper = papers.find(paper => paper.id === openPaperId) ?? null
  const openGroup = groups.find(group => group.id === openGroupId) ?? null
  const groupPapers = openGroup ? papers.filter(paper => paper.groupId === openGroup.id) : []
  const ungroupedPapers = papers.filter(paper => !groups.some(group => group.id === paper.groupId))
  const dirty = Boolean(openPaper) && draftHtml !== openPaper!.html

  function startGroupCreate() {
    setError(''); setMessage('')
    setGroupTitle('')
    setGroupTarget('new')
  }

  function startGroupRename(group: CoursePaperGroup) {
    setError(''); setMessage('')
    setGroupTitle(group.title)
    setGroupTarget(group.id)
  }

  async function saveGroup() {
    const title = groupTitle.trim()
    if (!title) { setError('Le nom de l’épreuve est obligatoire.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      if (groupTarget === 'new') {
        const nextOrder = groups.reduce((max, group) => Math.max(max, group.order), -1) + 1
        await createCoursePaperGroup(courseId, title, nextOrder, userId)
        setMessage('Épreuve créée en brouillon. Ouvrez-la pour y ajouter des sujets types.')
      } else if (groupTarget) {
        await updateCoursePaperGroup(groupTarget, { title }, userId)
        setMessage('Épreuve renommée.')
      }
      await refresh()
      setGroupTarget(null)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’épreuve.')
    } finally {
      setBusy(false)
    }
  }

  async function setGroupPublication(group: CoursePaperGroup, publish: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      await updateCoursePaperGroup(group.id, { status: publish ? 'published' : 'draft' }, userId)
      await refresh()
      const publishedInside = papers.filter(paper => paper.groupId === group.id && paper.status === 'published').length
      setMessage(publish
        ? publishedInside > 0 ? 'Épreuve publiée.' : 'Épreuve publiée. Elle restera masquée pour les étudiants tant qu’elle n’a pas de sujet type publié.'
        : 'Épreuve dépubliée.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de modifier la publication.')
    } finally {
      setBusy(false)
    }
  }

  async function removeGroup(group: CoursePaperGroup) {
    const count = papers.filter(paper => paper.groupId === group.id).length
    if (!(await confirmAction({
      title: 'Supprimer cette épreuve ?',
      description: <>L’épreuve <strong>« {group.title} »</strong> sera supprimée définitivement{count > 0 ? <>, avec ses <strong>{count} sujet{count > 1 ? 's' : ''} type{count > 1 ? 's' : ''}</strong></> : null}. Cette action est irréversible.</>,
    }))) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deleteCoursePaperGroup(group.id)
      if (openGroupId === group.id) { setOpenGroupId(null); setOpenPaperId(null); setSettingsTarget(null) }
      await refresh()
      setMessage('Épreuve supprimée avec ses sujets types.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de supprimer l’épreuve.')
    } finally {
      setBusy(false)
    }
  }

  async function movePaper(paper: CoursePaper, groupId: string) {
    if (!groupId) return
    setBusy(true); setError(''); setMessage('')
    try {
      await updateCoursePaper(paper.id, { groupId }, userId)
      await refresh()
      setMessage('Sujet type déplacé dans l’épreuve.')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Impossible de déplacer le sujet type.')
    } finally {
      setBusy(false)
    }
  }

  function startCreate() {
    setError(''); setMessage('')
    setForm({ ...EMPTY_FORM, title: `${DEFAULT_COURSE_PAPER_TITLE} ${groupPapers.length + 1}` })
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
        if (!openGroup) throw new Error('Ouvrez d’abord une épreuve.')
        const nextOrder = groupPapers.reduce((max, paper) => Math.max(max, paper.order), -1) + 1
        const id = await createCoursePaper(courseId, openGroup.id, input, nextOrder, userId)
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
        <button type="button" className="back" onClick={() => void closeEditor()}>← Retour {openGroup ? `à l’épreuve « ${openGroup.title} »` : 'à la liste'}</button>
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

  const groupForm = groupTarget && (
    <div className="compact-create-form course-paper-form">
      <div className="lesson-workspace-head"><div>
        <span className="pill">{groupTarget === 'new' ? 'NOUVELLE ÉPREUVE' : 'RENOMMER'}</span>
        <h3>{groupTarget === 'new' ? 'Créer une épreuve' : 'Renommer l’épreuve'}</h3>
      </div></div>
      <div className="form-grid">
        <label className="wide">Nom de l’épreuve
          <input className="fake-input" autoFocus value={groupTitle} onChange={e => setGroupTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveGroup() }} placeholder="Ex. EPREUVE MATHS" />
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" className="primary" disabled={busy || !groupTitle.trim()} onClick={() => void saveGroup()}>{busy ? 'Enregistrement...' : groupTarget === 'new' ? 'Créer en brouillon' : 'Enregistrer'}</button>
        <button type="button" className="outline" disabled={busy} onClick={() => setGroupTarget(null)}>Annuler</button>
      </div>
    </div>
  )

  const feedback = (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="form-success" role="status">{message}</div>}
    </>
  )

  function renderPaperRow(paper: CoursePaper) {
    return (
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
    )
  }

  // Level 2: the Sujets types of one épreuve.
  if (openGroup) {
    return (
      <section className="panel course-papers-section" style={{ marginBottom: 0 }}>
        <button type="button" className="back" onClick={() => { setOpenGroupId(null); setSettingsTarget(null); setError(''); setMessage('') }}>← Retour aux épreuves</button>
        <div className="section-head">
          <div>
            <div className="eyebrow">ÉPREUVE · {openGroup.status === 'published' ? 'PUBLIÉE' : 'BROUILLON'}</div>
            <h2>{openGroup.title}</h2>
            <p>Créez ici les sujets types de cette épreuve (Sujet type 1, 2, 3…). Chacun a son propre éditeur, sa description, sa limite de temps et sa note de réussite.</p>
          </div>
          <div className="admin-list-actions">
            <button type="button" className="primary small-btn" disabled={busy || settingsTarget === 'new'} onClick={startCreate}>+ Nouveau sujet type</button>
            <button type="button" className="outline small-btn" disabled={busy} onClick={() => startGroupRename(openGroup)}>Renommer</button>
            <button type="button" className="outline small-btn" disabled={busy} onClick={() => void setGroupPublication(openGroup, openGroup.status !== 'published')}>{openGroup.status === 'published' ? 'Dépublier' : 'Publier'}</button>
            <button type="button" className="outline small-btn danger-outline" disabled={busy} onClick={() => void removeGroup(openGroup)}>Supprimer</button>
          </div>
        </div>
        {feedback}
        {groupForm}
        {settingsForm}
        {groupPapers.length === 0
          ? <div className="empty-state compact">Aucun sujet type dans cette épreuve. Créez le premier avec « Nouveau sujet type ».</div>
          : <div className="admin-list course-paper-list">{groupPapers.map(renderPaperRow)}</div>}
      </section>
    )
  }

  // Level 1: the épreuves of the concours.
  return (
    <section className="panel course-papers-section" style={{ marginBottom: 0 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">TESTEZ VOS CONNAISSANCES</div>
          <h2>Sujets types de ce concours</h2>
          <p>Créez d’abord une épreuve (par exemple EPREUVE MATHS ou EPREUVE FRS), puis ses sujets types. Les étudiants les ouvrent à tout moment, même sans avoir terminé les leçons.</p>
        </div>
        <button type="button" className="primary small-btn" disabled={busy || groupTarget === 'new'} onClick={startGroupCreate}>+ Nouvelle épreuve</button>
      </div>
      {feedback}
      {groupForm}
      {loading
        ? <div className="empty-state compact">Chargement des épreuves…</div>
        : groups.length === 0 && ungroupedPapers.length === 0
          ? <div className="empty-state compact">Aucune épreuve pour ce concours. Créez-en une pour y ajouter des sujets types.</div>
          : <div className="admin-list course-paper-list">
            {groups.map(group => {
              const inside = papers.filter(paper => paper.groupId === group.id)
              const published = inside.filter(paper => paper.status === 'published').length
              return (
                <div className="admin-course course-paper-row" key={group.id}>
                  <div>
                    <strong>{group.title}</strong>
                    <span>{inside.length === 0 ? 'Aucun sujet type' : `${inside.length} sujet${inside.length > 1 ? 's' : ''} type${inside.length > 1 ? 's' : ''}, ${published} publié${published > 1 ? 's' : ''}`}</span>
                  </div>
                  <div className="admin-list-actions">
                    <span className={`status ${group.status === 'published' ? 'published' : 'draft'}`}>{group.status === 'published' ? 'Publiée' : 'Brouillon'}</span>
                    <button type="button" className="primary small-btn" disabled={busy} onClick={() => { setOpenGroupId(group.id); setError(''); setMessage('') }}>Ouvrir</button>
                    <button type="button" className="outline small-btn" disabled={busy} onClick={() => startGroupRename(group)}>Renommer</button>
                    <button type="button" className="outline small-btn" disabled={busy} onClick={() => void setGroupPublication(group, group.status !== 'published')}>{group.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    <button type="button" className="outline small-btn danger-outline" disabled={busy} onClick={() => void removeGroup(group)}>Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>}
      {ungroupedPapers.length > 0 && (
        <div className="course-paper-orphans">
          <h3>Sujets types sans épreuve</h3>
          <p>Ces sujets ont été créés avant les épreuves. Les étudiants ne les voient pas tant qu’ils ne sont pas rangés dans une épreuve.</p>
          {settingsForm}
          <div className="admin-list course-paper-list">
            {ungroupedPapers.map(paper => (
              <div className="admin-course course-paper-row" key={paper.id}>
                <div>
                  <strong>{paper.title}</strong>
                  <span>{describePaper(paper)}</span>
                </div>
                <div className="admin-list-actions">
                  <select className="fake-input course-paper-move" aria-label={`Ranger « ${paper.title} » dans une épreuve`} disabled={busy || groups.length === 0} value="" onChange={e => void movePaper(paper, e.target.value)}>
                    <option value="">{groups.length === 0 ? 'Créez d’abord une épreuve' : 'Ranger dans une épreuve…'}</option>
                    {groups.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}
                  </select>
                  <button type="button" className="primary small-btn" disabled={busy} onClick={() => openEditor(paper)}>Rédiger</button>
                  <button type="button" className="outline small-btn" disabled={busy} onClick={() => startSettings(paper)}>Paramètres</button>
                  <button type="button" className="outline small-btn danger-outline" disabled={busy} onClick={() => void removePaper(paper)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
