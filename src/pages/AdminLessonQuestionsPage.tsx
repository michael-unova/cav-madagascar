import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { markLessonCommentsRead, replyToLessonComment, subscribeAdminLessonComments } from '../features/lessonComments'
import type { LessonComment } from '../types/lessonComment'

function formatDate(value: LessonComment['createdAt']) {
  if (!value) return 'Date en cours d’enregistrement'
  return value.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
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
  const canManage = profile?.role === 'super_admin' || profile?.role === 'content_manager'

  useEffect(() => {
    if (!canManage) return
    setLoading(true)
    return subscribeAdminLessonComments(next => { setItems(next); setLoading(false); if (selected) { const fresh = next.find(item => item.id === selected.id); if (fresh) setSelected(fresh) } }, err => { console.error(err); setError('Impossible de charger les questions des étudiants.'); setLoading(false) })
  }, [canManage, selected?.id])

  const unreadCount = useMemo(() => items.filter(item => item.unreadForAdmin && item.authorRole === 'student').length, [items])
  const roots = useMemo(() => items.filter(item => !item.parentCommentId), [items])
  const repliesFor = (id: string) => items.filter(item => item.parentCommentId === id).sort((a,b)=>(a.createdAt?.toMillis?.() ?? 0)-(b.createdAt?.toMillis?.() ?? 0))

  function renderThread(comment: LessonComment, depth = 0, rendered = new Set<string>()) {
    if (rendered.has(comment.id)) return null
    rendered.add(comment.id)
    const children = repliesFor(comment.id)
    return <div className="admin-thread-reply" key={comment.id} style={{ marginLeft: depth ? Math.min(depth * 20, 80) : 0 }}>
      <strong>{comment.studentName}{comment.authorRole === 'manager' && <span className="lesson-comment-role">CAV</span>}</strong>
      <span>{formatDate(comment.createdAt)}</span>
      <p>{comment.content}</p>
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
    } catch (err) {
      console.error(err);
      setError('Impossible de marquer cette discussion comme lue.')
    }
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
        {loading ? <Card><p>Chargement des questions...</p></Card> : roots.length === 0 ? <Card className="catalogue-empty"><p>Aucune question d’étudiant pour le moment.</p></Card> : roots.map(item => <button key={item.id} type="button" className={`message-row ${item.unreadForAdmin ? 'is-unread' : ''}`} onClick={() => void openComment(item)}><span className="message-status-dot" aria-hidden="true" /><span className="message-row-main"><strong>{item.studentName}</strong><b>{item.lessonTitle}</b><small>{item.courseTitle} · {item.subjectTitle} · {formatDate(item.createdAt)}</small></span><span className="message-row-status">{item.unreadForAdmin ? 'Nouveau' : 'Lu'}</span></button>)}
      </section>
      <section className="message-detail">
        {selected ? <Card><div className="message-detail-head"><div><p className="eyebrow">{selected.unreadForAdmin ? 'NOUVELLE QUESTION' : 'DISCUSSION'}</p><h2>{selected.lessonTitle}</h2></div><div className="message-detail-head-actions"><span className="course-parent-badge">{selected.subjectTitle}</span><button type="button" className="ui-button ui-button-primary" disabled={!selected.subjectId || !selected.lessonId || !onOpenLesson} onClick={() => onOpenLesson?.(selected.courseId, selected.subjectId, selected.lessonId, selected.id)}>↗ Voir dans la leçon</button></div></div><div className="message-sender"><strong>{selected.studentName}</strong><span>{formatDate(selected.createdAt)}</span></div><div className="message-meta"><span>Concours : {selected.courseTitle}</span><span>Matière : {selected.subjectTitle}</span>{selected.topicTitle && <span>Topic : {selected.topicTitle}</span>}<span>Leçon : {selected.lessonTitle}</span></div><div className="message-body">{selected.content}</div><div className="admin-thread-replies">{repliesFor(selected.id).map(replyItem => renderThread(replyItem, 1))}</div><div className="lesson-comment-admin-reply"><p className="eyebrow">RÉPONDRE</p><textarea value={reply} onChange={event => setReply(event.target.value)} rows={4} placeholder="Écrivez une réponse à l’étudiant..."/><div className="message-actions"><button type="button" className="ui-button ui-button-primary" disabled={saving || !reply.trim()} onClick={() => void saveReply()}>{saving ? 'Envoi...' : 'Répondre à l’étudiant'}</button></div></div></Card> : <Card className="catalogue-empty"><p>Sélectionnez une question pour consulter la discussion.</p></Card>}
      </section>
    </div>
  </Container>
}
