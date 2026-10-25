import { useEffect, useMemo, useState } from 'react'
import { confirmAction } from '../components/ConfirmDialog'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { QUESTION_STATUS_LABELS, buildQuestionStatuses, collectCommentThreadIds, deleteLessonCommentThread, markLessonCommentsRead, markQuestionSeen, replyToLessonComment, setQuestionTreated, subscribeAdminLessonComments, updateLessonComment, type QuestionStatus } from '../features/lessonComments'
import type { LessonComment } from '../types/lessonComment'

function formatDate(value: LessonComment['createdAt']) {
  if (!value) return 'Date en cours d’enregistrement'
  return value.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatusBadge({ status }: { status: QuestionStatus }) {
  return <span className={`question-status-badge is-${status}`}>{QUESTION_STATUS_LABELS[status]}</span>
}

function CategoryBadge({ category }: { category?: LessonComment['category'] }) {
  return category === 'technical'
    ? <span className="question-category-badge is-technical">🛠️ Problème technique</span>
    : <span className="question-category-badge is-course">📘 Question de cours</span>
}

function seenLabel(names: string[]) {
  return names.length ? `Vu par ${names.join(', ')}` : ''
}

export function AdminLessonQuestionsPage({ onOpenLesson }: { onOpenLesson?: (courseId: string, subjectId: string, lessonId: string, commentId: string) => void }) {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<LessonComment[]>([])
  const [selected, setSelected] = useState<LessonComment | null>(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'course' | 'technical'>('all')
  const canManage = profile?.role === 'super_admin' || profile?.role === 'content_manager'

  useEffect(() => {
    if (!canManage) return
    setLoading(true)
    return subscribeAdminLessonComments(next => { setItems(next); setLoading(false); if (selected) { const fresh = next.find(item => item.id === selected.id); if (fresh) setSelected(fresh) } }, err => { console.error(err); setError('Impossible de charger les questions des étudiants.'); setLoading(false) })
  }, [canManage, selected?.id])

  const unreadCount = useMemo(() => items.filter(item => item.unreadForAdmin && item.authorRole === 'student').length, [items])
  const roots = useMemo(() => items.filter(item => !item.parentCommentId), [items])
  const statuses = useMemo(() => buildQuestionStatuses(items), [items])
  const todoCount = roots.filter(item => statuses[item.id]?.status !== 'treated').length
  const doneCount = roots.length - todoCount
  const courseCount = roots.filter(item => item.category !== 'technical').length
  const technicalCount = roots.length - courseCount
  const visibleRoots = roots
    .filter(item => typeFilter === 'all' || (typeFilter === 'technical' ? item.category === 'technical' : item.category !== 'technical'))
    .filter(item => filter === 'all' || (filter === 'done' ? statuses[item.id]?.status === 'treated' : statuses[item.id]?.status !== 'treated'))
  const adminName = String(profile?.displayName ?? user?.displayName ?? 'Administrateur').trim() || 'Administrateur'
  const repliesFor = (id: string) => items.filter(item => item.parentCommentId === id).sort((a,b)=>(a.createdAt?.toMillis?.() ?? 0)-(b.createdAt?.toMillis?.() ?? 0))

  function renderThread(comment: LessonComment, depth = 0, rendered = new Set<string>()) {
    if (rendered.has(comment.id)) return null
    rendered.add(comment.id)
    const children = repliesFor(comment.id)
    return <div className="admin-thread-reply" key={comment.id} style={{ marginLeft: depth ? Math.min(depth * 20, 80) : 0 }}>
      <strong>{comment.studentName}{comment.authorRole === 'manager' && <span className="lesson-comment-role">CAV</span>}</strong>
      <span>{formatDate(comment.createdAt)}</span>
      {editingId === comment.id ? <div className="lesson-comment-edit">
        <textarea value={editingText} onChange={event => setEditingText(event.target.value)} rows={3} maxLength={3000} aria-label="Modifier la réponse" />
        <div className="lesson-comment-edit-footer"><span>{editingText.length}/3000</span><div className="lesson-comment-actions">
          <button type="button" className="ui-button ui-button-primary" disabled={editSaving || !editingText.trim() || editingText.trim() === comment.content} onClick={() => void saveEdit(comment)}>{editSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button type="button" className="ui-button" disabled={editSaving} onClick={() => { setEditingId(null); setEditingText('') }}>Annuler</button>
        </div></div>
      </div> : <>
        <p>{comment.content}</p>
        <div className="lesson-comment-actions">
          {comment.authorRole === 'manager' && comment.userId === user?.uid && <button type="button" className="lesson-comment-action" onClick={() => { setEditingId(comment.id); setEditingText(comment.content) }}>✎ Modifier</button>}
          <button type="button" className="lesson-comment-action is-danger" onClick={() => void removeComment(comment)}>⌫ Supprimer</button>
        </div>
      </>}
      {children.map(child => renderThread(child, depth + 1, rendered))}
    </div>
  }

  if (!canManage) return <Container className="page-container"><Card><p className="eyebrow">Questions étudiants</p><h1>Accès réservé</h1><p>Cette section est réservée aux administrateurs et gestionnaires de contenu.</p></Card></Container>

  async function openComment(item: LessonComment) {
    setSelected(item); setReply(''); setSuccess('')
    try {
      const discussionIds = items
        .filter(comment => comment.lessonId === item.lessonId && comment.courseId === item.courseId && comment.unreadForAdmin && comment.authorRole === 'student')
        .map(comment => comment.id)
      if (item.unreadForAdmin && !discussionIds.includes(item.id)) discussionIds.push(item.id)
      if (discussionIds.length) await markLessonCommentsRead(discussionIds)
      if (user?.uid) {
        const seenTargets = new Set<string>([item.id, ...items.filter(comment => discussionIds.includes(comment.id) && !comment.parentCommentId).map(comment => comment.id)])
        await Promise.all(Array.from(seenTargets)
          .filter(id => { const target = items.find(comment => comment.id === id); return target && !target.parentCommentId && !target.seenBy?.[user.uid] })
          .map(id => markQuestionSeen(id, user.uid, adminName)))
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de marquer cette discussion comme lue.')
    }
  }

  async function saveEdit(comment: LessonComment) {
    const content = editingText.trim()
    if (!content) return
    setEditSaving(true); setError(''); setSuccess('')
    try {
      await updateLessonComment(comment.id, content, 'manager')
      setEditingId(null); setEditingText(''); setSuccess('Réponse modifiée.')
    } catch (err) { console.error(err); setError('Impossible de modifier cette réponse.') } finally { setEditSaving(false) }
  }

  async function removeComment(comment: LessonComment) {
    const threadIds = collectCommentThreadIds(comment.id, items)
    const replyCount = threadIds.length - 1
    const isStudentQuestion = comment.authorRole !== 'manager'
    const confirmed = await confirmAction({
      title: isStudentQuestion ? 'Supprimer cette question ?' : 'Supprimer cette réponse ?',
      description: isStudentQuestion ? <>La question de <strong>{comment.studentName}</strong> sera supprimée définitivement.</> : 'Cette réponse sera supprimée définitivement.',
      hint: replyCount > 0 ? `${replyCount} réponse${replyCount > 1 ? 's' : ''} associée${replyCount > 1 ? 's' : ''} ser${replyCount > 1 ? 'ont' : 'a'} également supprimée${replyCount > 1 ? 's' : ''}.` : undefined,
    })
    if (!confirmed) return
    setError(''); setSuccess('')
    try {
      await deleteLessonCommentThread(threadIds)
      if (selected && threadIds.includes(selected.id)) setSelected(null)
      if (editingId && threadIds.includes(editingId)) { setEditingId(null); setEditingText('') }
      setSuccess(isStudentQuestion ? 'Question supprimée.' : 'Réponse supprimée.')
    } catch (err) { console.error(err); setError(isStudentQuestion ? 'Impossible de supprimer cette question.' : 'Impossible de supprimer cette réponse.') }
  }

  async function changeTreated(comment: LessonComment, treated: boolean) {
    if (!user?.uid || statusSaving) return
    setStatusSaving(true); setError(''); setSuccess('')
    try {
      await setQuestionTreated(comment.id, treated, user.uid, adminName)
      setSuccess(treated ? 'Question marquée comme traitée.' : 'Question rouverte.')
    } catch (err) { console.error(err); setError('Impossible de mettre à jour le statut.') } finally { setStatusSaving(false) }
  }

  async function saveReply() {
    if (!selected || !reply.trim() || !profile) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await replyToLessonComment({ parent: selected, content: reply.trim(), userId: user?.uid ?? '', authorName: String(profile.displayName ?? 'Équipe CAV Madagascar'), authorPhotoURL: String(profile.photoURL ?? user?.photoURL ?? '').trim() || null, authorRole: 'manager' })
      setReply(''); setSuccess('Réponse envoyée avec succès.')
    } catch (err) { console.error(err); setError('Impossible d’envoyer la réponse.') } finally { setSaving(false) }
  }

  return <Container className="page-container">
    <div className="page-header"><div><p className="eyebrow">ÉTUDIANTS</p><h1>Questions des étudiants</h1><p className="page-description">Consultez les discussions liées aux leçons et répondez au bon endroit.</p></div><div className="messages-count"><strong>{unreadCount}</strong><span>nouvelle{unreadCount === 1 ? '' : 's'}</span></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{success && <div className="form-success" role="status">✓ {success}</div>}
    <div className="messages-layout">
      <section className="messages-list">
        {loading ? <Card><p>Chargement des questions...</p></Card> : roots.length === 0 ? <Card className="catalogue-empty"><p>Aucune question d’étudiant pour le moment.</p></Card> : <>
          <div className="question-filter" role="group" aria-label="Filtrer les questions">
            <button type="button" className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Toutes <b>{roots.length}</b></button>
            <button type="button" className={filter === 'todo' ? 'active' : ''} aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')}>À traiter <b>{todoCount}</b></button>
            <button type="button" className={filter === 'done' ? 'active' : ''} aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>Traitées <b>{doneCount}</b></button>
          </div>
          <div className="question-filter question-type-filter" role="group" aria-label="Filtrer par type">
            <button type="button" className={typeFilter === 'all' ? 'active' : ''} aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Tous types <b>{roots.length}</b></button>
            <button type="button" className={typeFilter === 'course' ? 'active' : ''} aria-pressed={typeFilter === 'course'} onClick={() => setTypeFilter('course')}>Cours <b>{courseCount}</b></button>
            <button type="button" className={typeFilter === 'technical' ? 'active' : ''} aria-pressed={typeFilter === 'technical'} onClick={() => setTypeFilter('technical')}>Technique <b>{technicalCount}</b></button>
          </div>
          {visibleRoots.length === 0 ? <Card className="catalogue-empty"><p>{filter === 'todo' ? 'Aucune question à traiter. Bon travail !' : filter === 'done' ? 'Aucune question traitée pour le moment.' : 'Aucune question dans cette catégorie.'}</p></Card> : visibleRoots.map(item => { const info = statuses[item.id] ?? { status: 'seen' as QuestionStatus, seenNames: [] }; return <button key={item.id} type="button" className={`message-row ${info.status === 'new' ? 'is-unread' : ''} ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => void openComment(item)}><span className={`message-status-dot is-${info.status}`} aria-hidden="true" /><span className="message-row-main"><strong>{item.studentName}</strong><b>{item.lessonTitle}</b><CategoryBadge category={item.category} /><small>{item.courseTitle} · {item.subjectTitle} · {formatDate(item.createdAt)}</small>{seenLabel(info.seenNames) && <small className="question-seen-line">{seenLabel(info.seenNames)}</small>}</span><StatusBadge status={info.status} /></button> })}
        </>}
      </section>
      <section className="message-detail">
        {selected ? <Card><div className="message-detail-head"><div><p className="eyebrow">{selected.unreadForAdmin ? 'NOUVELLE QUESTION' : 'DISCUSSION'}</p><h2>{selected.lessonTitle}</h2></div><div className="message-detail-head-actions"><span className="course-parent-badge">{selected.subjectTitle}</span><button type="button" className="ui-button ui-button-primary" disabled={!selected.subjectId || !selected.lessonId || !onOpenLesson} onClick={() => onOpenLesson?.(selected.courseId, selected.subjectId, selected.lessonId, selected.id)}>↗ Voir dans la leçon</button></div></div><div className="message-sender"><strong>{selected.studentName}</strong><span>{formatDate(selected.createdAt)}</span></div><div className="question-status-panel">
          <div className="question-status-info">
            <StatusBadge status={statuses[selected.id]?.status ?? 'seen'} />
            <CategoryBadge category={selected.category} />
            {seenLabel(statuses[selected.id]?.seenNames ?? []) && <span>{seenLabel(statuses[selected.id]?.seenNames ?? [])}</span>}
            {statuses[selected.id]?.status === 'treated' && selected.treatedByName && <span>Traité par {selected.treatedByName}{selected.treatedAt ? ` · ${formatDate(selected.treatedAt)}` : ''}</span>}
          </div>
          <div className="question-status-toggle" role="group" aria-label="Statut de la question">
            <button type="button" className={statuses[selected.id]?.status !== 'treated' ? 'active is-seen' : ''} aria-pressed={statuses[selected.id]?.status !== 'treated'} disabled={statusSaving} onClick={() => { if (statuses[selected.id]?.status === 'treated') void changeTreated(selected, false) }}>Vu</button>
            <button type="button" className={statuses[selected.id]?.status === 'treated' ? 'active is-treated' : ''} aria-pressed={statuses[selected.id]?.status === 'treated'} disabled={statusSaving} onClick={() => { if (statuses[selected.id]?.status !== 'treated') void changeTreated(selected, true) }}>✓ Traité</button>
          </div>
        </div>{selected.category === 'technical' && <p className="question-status-hint">{statuses[selected.id]?.status === 'treated' ? 'Ce problème technique est masqué pour les autres étudiants. Son auteur le voit comme résolu.' : 'Ce problème technique reste visible par les étudiants jusqu’à ce qu’il soit marqué comme traité.'}</p>}<div className="message-meta"><span>Concours : {selected.courseTitle}</span><span>Matière : {selected.subjectTitle}</span>{selected.topicTitle && <span>Topic : {selected.topicTitle}</span>}<span>Leçon : {selected.lessonTitle}</span></div><div className="message-body">{selected.content}</div><div className="question-moderation"><p>Cette question sera retirée de la leçon pour tous les étudiants.</p><button type="button" className="question-delete-btn" onClick={() => void removeComment(selected)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Supprimer la question</button></div><div className="admin-thread-replies">{repliesFor(selected.id).map(replyItem => renderThread(replyItem, 1))}</div><div className="lesson-comment-admin-reply"><p className="eyebrow">RÉPONDRE</p><textarea value={reply} onChange={event => setReply(event.target.value)} rows={4} placeholder="Écrivez une réponse à l’étudiant..."/><div className="message-actions"><button type="button" className="ui-button ui-button-primary" disabled={saving || !reply.trim()} onClick={() => void saveReply()}>{saving ? 'Envoi...' : 'Répondre à l’étudiant'}</button></div></div></Card> : <Card className="catalogue-empty"><p>Sélectionnez une question pour consulter la discussion.</p></Card>}
      </section>
    </div>
  </Container>
}
