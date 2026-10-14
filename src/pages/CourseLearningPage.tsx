import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { sanitizeLessonHtml } from '../components/RichLessonEditor'
import { useAuth } from '../features/auth'
import { getPublishedCourseById, getPublishedCourseBySlug } from '../features/courses'
import { listMyEnrollments } from '../features/enrollment'
import { listCourseSubjects, listCourseSubjectContentNodes, getStudentLessonContent } from '../features/curriculum'
import { getNodeProgress, saveNodeProgress, listMyProgress, getCourseProgressSummary, listMyBookmarks, createBookmark, deleteBookmark, listMyNotes, saveNote } from '../features/progress'
import { listPublishedImportantQuestionSets, listPublishedPracticeSets, listPublishedPsychotechnicalTestsForCourse } from '../features/questions'
import { createLessonComment, deleteLessonComment, subscribeLessonComments, subscribeLessonCommentLoves, toggleLessonCommentLove, updateLessonComment, replyToLessonComment } from '../features/lessonComments'
import type { Course, CourseSubject } from '../types/course'
import type { ContentNode, ContentBlock } from '../types/content'
import type { QuestionSet } from '../types/question'
import type { PsychotechnicalTest } from '../types/psychotechnical'
import type { LessonComment } from '../types/lessonComment'
import { confirmAction } from '../components/ConfirmDialog'

export function CourseLearningPage() {
  const { courseRef } = useParams<{ courseRef: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [subjects, setSubjects] = useState<CourseSubject[]>([])
  const [nodes, setNodes] = useState<ContentNode[]>([])
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [practiceSets, setPracticeSets] = useState<QuestionSet[]>([])
  const [importantSets, setImportantSets] = useState<QuestionSet[]>([])
  const [psychotechnicalTests, setPsychotechnicalTests] = useState<PsychotechnicalTest[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [completed, setCompleted] = useState(false)
  const [coursePercent, setCoursePercent] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [videoStart, setVideoStart] = useState(0)
  const [bookmarkId, setBookmarkId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [lessonComments, setLessonComments] = useState<LessonComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null)
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<string | null>(null)
  const [commentLoveState, setCommentLoveState] = useState<Record<string, { count: number; loved: boolean }>>({})
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastVideoSave = useRef(0)
  const currentUserId = user?.uid ?? ''

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId])
  const rootTopics = useMemo(() => nodes.filter(node => !node.parentId), [nodes])
  const childLessons = useMemo(() => nodes.filter(node => Boolean(node.parentId)), [nodes])
  const childrenOf = (parentId: string) => childLessons.filter(node => node.parentId === parentId)

  async function loadNode(subjectId: string, nodeId: string, courseValue: Course) {
    setSelectedSubjectId(subjectId)
    setSelectedNodeId(nodeId)
    setBlocks([])
    setCompleted(false)
    setVideoStart(0)
    setLoadingLesson(true)
    try {
      const [nodeBlocks, progress, bookmarks, notes] = await Promise.all([
        getStudentLessonContent(courseValue.id, nodeId),
        user ? getNodeProgress(user.uid, courseValue.id, nodeId) : Promise.resolve(null),
        user ? listMyBookmarks(user.uid) : Promise.resolve([]),
        user ? listMyNotes(user.uid, courseValue.id) : Promise.resolve([]),
      ])
      setBlocks(nodeBlocks)
      setCompleted(Boolean(progress?.completed))
      setVideoStart(progress?.videoTimestampSeconds ?? 0)
      const currentBookmark = bookmarks.find(item => item.courseId === courseValue.id && item.nodeId === nodeId)
      const currentNote = notes.find(item => item.nodeId === nodeId)
      setBookmarkId(currentBookmark?.id ?? null)
      setNoteId(currentNote?.id ?? null)
      setNoteText(currentNote?.content ?? '')
      if (user) {
        await saveNodeProgress({
          userId: user.uid,
          courseId: courseValue.id,
          courseSubjectId: subjectId,
          nodeId,
          blockId: nodeBlocks[0]?.id,
          completed: Boolean(progress?.completed),
          ...(progress?.videoTimestampSeconds !== undefined ? { videoTimestampSeconds: progress.videoTimestampSeconds } : {}),
        })
      }
    } catch (err) {
      console.error(err)
      setError('Impossible de charger cette leçon.')
    } finally {
      setLoadingLesson(false)
    }
  }

  useEffect(() => {
    if (!selectedNodeId || !user) {
      setLessonComments([])
      return
    }
    return subscribeLessonComments(selectedNodeId, course?.id ?? "", setLessonComments, errorValue => {
      console.error(errorValue)
      setError('Impossible de charger vos questions sur cette leçon.')
    })
  }, [selectedNodeId, user, course?.id])

  useEffect(() => {
    setCommentLoveState({})
    if (!user || lessonComments.length === 0) return
    const unsubscribers = lessonComments.map(comment => subscribeLessonCommentLoves(comment.id, user.uid, state => {
      setCommentLoveState(current => ({ ...current, [comment.id]: state }))
    }, errorValue => console.error(errorValue)))
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [lessonComments, user])

  async function submitLessonComment() {
    if (!user || !course || !selectedNode || !selectedSubjectId || !commentText.trim()) return
    setCommentSaving(true)
    setError('')
    try {
      const subject = subjects.find(item => item.id === selectedSubjectId)
      const topic = selectedNode.parentId ? nodes.find(item => item.id === selectedNode.parentId) : undefined
      await createLessonComment({
        userId: user.uid,
        studentName: String(profile?.displayName ?? user.displayName ?? 'Étudiant').trim() || 'Étudiant',
        authorPhotoURL: String(profile?.photoURL ?? user.photoURL ?? '').trim() || null,
        authorRole: 'student',
        parentCommentId: null,
        courseId: course.id,
        courseTitle: course.title,
        subjectId: subject?.subjectId ?? selectedSubjectId,
        subjectTitle: subject?.title ?? 'Matière',
        topicId: topic?.id ?? null,
        topicTitle: topic?.title ?? null,
        lessonId: selectedNode.id,
        lessonTitle: selectedNode.title,
        content: commentText.trim(),
      })
      setCommentText('')
    } catch (err) {
      console.error(err)
      setError('Impossible de publier votre question.')
    } finally {
      setCommentSaving(false)
    }
  }

  async function submitCommentReply(parent: LessonComment) {
    if (!replyText.trim()) return
    try {
      if (!user) return
      await replyToLessonComment({ parent, content: replyText.trim(), userId: user.uid, authorName: String(profile?.displayName ?? user.displayName ?? 'Étudiant').trim() || 'Étudiant', authorPhotoURL: String(profile?.photoURL ?? user.photoURL ?? '').trim() || null, authorRole: 'student' })
      setReplyText(''); setReplyingToId(null)
    } catch (error) { console.error(error); setError('Impossible d’envoyer votre réponse.') }
  }

  async function saveEditedComment(commentId: string) {
    if (!editingCommentText.trim()) return
    setCommentSaving(true)
    setError('')
    try {
      await updateLessonComment(commentId, editingCommentText)
      setEditingCommentId(null)
      setEditingCommentText('')
    } catch (err) {
      console.error(err)
      setError('Impossible de modifier votre question.')
    } finally {
      setCommentSaving(false)
    }
  }

  async function removeLessonComment(commentId: string) {
    if (!(await confirmAction({ title: 'Supprimer cette question ?', description: 'Cette question sera supprimée définitivement.' }))) return
    setError('')
    try {
      await deleteLessonComment(commentId)
    } catch (err) {
      console.error(err)
      setError('Impossible de supprimer votre question.')
    }
  }

  function commentInitials(name: string) {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'É'
  }

  function commentAvatar(comment: LessonComment) {
    const photo = comment.authorPhotoURL || (comment.userId === currentUserId ? String(profile?.photoURL ?? user?.photoURL ?? '') : '')
    if (photo) return <img src={photo} alt="" className="lesson-comment-avatar-image" />
    return <span>{commentInitials(comment.studentName)}</span>
  }

  async function toggleCommentLove(comment: LessonComment) {
    if (!currentUserId) return
    const previous = commentLoveState[comment.id] ?? { count: 0, loved: false }
    const nextLoved = !previous.loved
    setCommentLoveState(current => ({
      ...current,
      [comment.id]: { count: Math.max(0, previous.count + (nextLoved ? 1 : -1)), loved: nextLoved },
    }))
    try {
      await toggleLessonCommentLove(comment.id, currentUserId, previous.loved)
    } catch (err) {
      console.error(err)
      setCommentLoveState(current => ({ ...current, [comment.id]: previous }))
      setError('Impossible de mettre à jour la réaction.')
    }
  }

  const commentEmojis = ['😊', '😂', '❤️', '😍', '👏', '🎉', '😮', '😢', '🙏', '💡', '🔥', '✅']

  function insertCommentEmoji(target: string, emoji: string) {
    if (target === 'new') setCommentText(value => `${value}${emoji}`)
    else if (target.startsWith('reply:')) setReplyText(value => `${value}${emoji}`)
    setEmojiPickerTarget(null)
  }

  function renderEmojiPicker(target: string) {
    if (emojiPickerTarget !== target) return null
    return <div className="lesson-comment-emoji-picker" role="dialog" aria-label="Choisir un emoji">{commentEmojis.map(emoji => <button key={emoji} type="button" onClick={() => insertCommentEmoji(target, emoji)}>{emoji}</button>)}</div>
  }

  function renderCommentThread(comment: LessonComment, depth = 0, renderedIds = new Set<string>()): ReactNode {
    if (renderedIds.has(comment.id)) return null
    renderedIds.add(comment.id)

    const replies = lessonComments
      .filter(item => item.parentCommentId === comment.id)
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
    const isOwner = comment.userId === currentUserId

    return (
      <div className={depth > 0 ? 'lesson-comment-reply-item' : 'lesson-comment-thread'} key={comment.id}>
        <article className="lesson-comment-card compact">
          <header className="lesson-comment-head">
            <div className="lesson-comment-author">
              <span className={comment.authorRole === 'manager' ? 'lesson-comment-avatar manager' : 'lesson-comment-avatar'} aria-hidden="true">{commentAvatar(comment)}</span>
              <div className="lesson-comment-author-copy">
                <div className="lesson-comment-author-line">
                  <strong>{comment.studentName}</strong>{comment.authorRole === 'manager' && <span className="lesson-comment-role">CAV</span>}
                </div>
                <span>{comment.createdAt ? comment.createdAt.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'À l’instant'}</span>
              </div>
            </div>
            {isOwner && (
              <div className="lesson-comment-menu-wrap">
                <button type="button" className="lesson-comment-menu-trigger" aria-label="Options du commentaire" aria-expanded={openCommentMenuId === comment.id} onClick={() => { setOpenCommentMenuId(value => value === comment.id ? null : comment.id); setEmojiPickerTarget(null) }}>⋯</button>
                {openCommentMenuId === comment.id && (
                  <div className="lesson-comment-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); setOpenCommentMenuId(null) }}>Modifier</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setOpenCommentMenuId(null); void removeLessonComment(comment.id) }}>Supprimer</button>
                  </div>
                )}
              </div>
            )}
          </header>

          {editingCommentId === comment.id ? (
            <div className="lesson-comment-edit">
              <textarea value={editingCommentText} onChange={event => setEditingCommentText(event.target.value)} rows={3} maxLength={3000} autoFocus />
              <div className="lesson-comment-edit-footer"><span>{editingCommentText.length}/3000</span><div className="lesson-comment-actions">
                <button type="button" className="ui-button ui-button-secondary" onClick={() => { setEditingCommentId(null); setEditingCommentText('') }}>Annuler</button>
                <button type="button" className="ui-button ui-button-primary" disabled={commentSaving || !editingCommentText.trim()} onClick={() => void saveEditedComment(comment.id)}>{commentSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div></div>
            </div>
          ) : (
            <>
              <div className="lesson-comment-body">{comment.content}</div>
              <div className="lesson-comment-actions comment-actions">
                <button type="button" className={`lesson-comment-action lesson-comment-love ${commentLoveState[comment.id]?.loved ? 'is-loved' : ''}`} aria-label={commentLoveState[comment.id]?.loved ? 'Retirer l’amour' : 'Aimer ce commentaire'} aria-pressed={commentLoveState[comment.id]?.loved ?? false} onClick={() => void toggleCommentLove(comment)}>
                  <span aria-hidden="true">{commentLoveState[comment.id]?.loved ? '♥' : '♡'}</span>
                  {(commentLoveState[comment.id]?.count ?? 0) > 0 && <b>{commentLoveState[comment.id]?.count}</b>}
                </button>
                <button type="button" className="lesson-comment-action" onClick={() => { setReplyingToId(comment.id); setCommentsOpen(true); setOpenCommentMenuId(null); setEmojiPickerTarget(null) }}><span aria-hidden="true">↩</span> Répondre</button>
              </div>
            </>
          )}

          {replyingToId === comment.id && (
            <div className="lesson-comment-reply-composer">
              <div className="lesson-comment-reply-row">
                <span className="lesson-comment-avatar">{profile?.photoURL || user?.photoURL ? <img src={String(profile?.photoURL ?? user?.photoURL)} alt="" className="lesson-comment-avatar-image" /> : commentInitials(String(profile?.displayName ?? user?.displayName ?? 'Étudiant'))}</span>
                <textarea value={replyText} onChange={event => setReplyText(event.target.value)} rows={2} maxLength={3000} placeholder={`Répondre à ${comment.studentName}...`} />
              </div>
              <div className="lesson-comment-reply-tools">
                <div className="lesson-comment-emoji-wrap"><button type="button" className="lesson-comment-tool" aria-label="Ajouter un emoji" onClick={() => { setEmojiPickerTarget(value => value === `reply:${comment.id}` ? null : `reply:${comment.id}`); setOpenCommentMenuId(null) }}>☺</button>{renderEmojiPicker(`reply:${comment.id}`)}</div>
                <div className="lesson-comment-edit-footer"><span>{replyText.length}/3000</span><div className="lesson-comment-actions">
                  <button type="button" className="ui-button ui-button-secondary" onClick={() => { setReplyingToId(null); setReplyText(''); setEmojiPickerTarget(null) }}>Annuler</button>
                  <button type="button" className="ui-button ui-button-primary" disabled={commentSaving || !replyText.trim()} onClick={() => void submitCommentReply(comment)}>{commentSaving ? 'Envoi...' : 'Répondre'}</button>
                </div></div>
              </div>
            </div>
          )}
        </article>
        {replies.length > 0 && (
          <div className="lesson-comment-replies">
            {replies.map(reply => renderCommentThread(reply, depth + 1, renderedIds))}
          </div>
        )}
      </div>
    )
  }

  async function loadSubject(courseSubjectId: string, courseValue: Course, resumeNodeId?: string) {
    const association = (await listCourseSubjects(courseValue.id, true)).find(item => item.id === courseSubjectId)
    const reusableSubjectId = association?.subjectId ?? courseSubjectId
    const ns = await listCourseSubjectContentNodes(courseSubjectId, reusableSubjectId, true)
    setSelectedSubjectId(courseSubjectId)
    setNodes(ns)
    const lessonNodes = ns.filter(node => node.parentId)
    const fallbackLessons = lessonNodes.length ? lessonNodes : ns.filter(node => !node.parentId && node.type !== 'topic')
    const target = resumeNodeId && fallbackLessons.some(n => n.id === resumeNodeId)
      ? resumeNodeId
      : fallbackLessons[0]?.id
    if (target) await loadNode(courseSubjectId, target, courseValue)
    else {
      setSelectedNodeId('')
      setBlocks([])
      setLoadingLesson(false)
    }
    const [nextPracticeSets, nextImportantSets, nextPsychotechnicalTests] = await Promise.all([listPublishedPracticeSets(reusableSubjectId), listPublishedImportantQuestionSets(reusableSubjectId), listPublishedPsychotechnicalTestsForCourse(courseValue.id)])
    setPracticeSets(nextPracticeSets)
    setImportantSets(nextImportantSets)
    setPsychotechnicalTests(nextPsychotechnicalTests)
  }

  useEffect(() => {
    async function load() {
      if (!courseRef || !user) return
      setLoading(true)
      setError('')
      try {
        const c = await getPublishedCourseById(courseRef) ?? await getPublishedCourseBySlug(courseRef)
        if (!c) {
          setError('Cours introuvable.')
          return
        }
        const enrollments = await listMyEnrollments(user.uid)
        if (!enrollments.some(e => e.courseId === c.id && e.status === 'active')) {
          setError('Votre accès à ce concours n’est pas encore actif.')
          return
        }

        const [ss, allProgress, summary] = await Promise.all([
          listCourseSubjects(c.id, true),
          listMyProgress(user.uid),
          getCourseProgressSummary(user.uid, c.id),
        ])
        setCourse(c)
        setSubjects(ss)
        setCoursePercent(summary.percent)
        if (!ss[0]) return

        const courseProgress = allProgress
          .filter(p => p.courseId === c.id && p.courseSubjectId)
          .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))
        const resume = courseProgress[0]
        const resumeSubject = resume?.courseSubjectId ? ss.find(s => s.id === resume.courseSubjectId) : undefined
        await loadSubject(resumeSubject?.id ?? ss[0].id, c, resumeSubject ? resume?.nodeId : undefined)
      } catch (err) {
        console.error(err)
        setError('Impossible de charger le contenu pédagogique.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [courseRef, user])

  async function selectSubject(subjectId: string) {
    if (!course) return
    setLoadingLesson(true)
    setError('')
    try {
      await loadSubject(subjectId, course)
    } catch (err) {
      console.error(err)
      setError('Impossible de charger la matière.')
      setLoadingLesson(false)
    }
  }

  async function selectNode(nodeId: string) {
    if (!course) return
    await loadNode(selectedSubjectId, nodeId, course)
  }


  async function toggleBookmark() {
    if (!user || !course || !selectedNodeId) return
    try {
      if (bookmarkId) { await deleteBookmark(bookmarkId); setBookmarkId(null) }
      else { const ref = await createBookmark({ userId: user.uid, courseId: course.id, nodeId: selectedNodeId }); setBookmarkId(ref.id) }
    } catch (err) { console.error(err); setError('Impossible d’enregistrer le signet.') }
  }

  async function saveCurrentNote() {
    if (!user || !course || !selectedNodeId || !noteText.trim()) return
    try {
      const id = await saveNote({ id: noteId ?? undefined, userId: user.uid, courseId: course.id, nodeId: selectedNodeId, content: noteText.trim() })
      setNoteId(id)
    } catch (err) { console.error(err); setError('Impossible d’enregistrer la note.') }
  }

  async function toggleCompleted() {
    if (!user || !course || !selectedNodeId) return
    const next = !completed
    setCompleted(next)
    try {
      await saveNodeProgress({
        userId: user.uid,
        courseId: course.id,
        courseSubjectId: selectedSubjectId,
        nodeId: selectedNodeId,
        blockId: blocks[0]?.id,
        completed: next,
        ...(videoRef.current ? { videoTimestampSeconds: videoRef.current.currentTime } : {}),
      })
      const summary = await getCourseProgressSummary(user.uid, course.id)
      setCoursePercent(summary.percent)
    } catch (err) {
      console.error(err)
      setCompleted(!next)
      setError('Impossible d’enregistrer votre progression.')
    }
  }

  async function saveVideoTimestamp() {
    if (!user || !course || !selectedNodeId || !videoRef.current) return
    const current = videoRef.current.currentTime
    if (current - lastVideoSave.current < 8) return
    lastVideoSave.current = current
    try {
      await saveNodeProgress({
        userId: user.uid,
        courseId: course.id,
        courseSubjectId: selectedSubjectId,
        nodeId: selectedNodeId,
        blockId: blocks[0]?.id,
        completed,
        videoTimestampSeconds: current,
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (loading && !course) {
    return <Container className="page-container"><div className="catalogue-state">Chargement de votre préparation...</div></Container>
  }

  if (error && !course) {
    return <Container className="page-container"><Card className="catalogue-empty"><h1>{error}</h1><button className="ui-button ui-button-primary" onClick={() => navigate(-1)}>Retour</button></Card></Container>
  }

  return (
    <Container className="page-container">
      <button className="back-link back-button" onClick={() => navigate(-1)}>← Retour</button>
      <div className="learning-header">
        <div>
          <p className="eyebrow">Apprentissage</p>
          <h1>{course?.title}</h1>
        </div>
        <div className="course-progress-summary">
          <span>Progression</span>
          <strong>{coursePercent}%</strong>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${coursePercent}%` }} /></div>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="learning-layout">
        <aside className="learning-sidebar">
          <h3>Matières</h3>
          {subjects.map(subject => (
            <button key={subject.id} type="button" className={`learning-item ${selectedSubjectId === subject.id ? 'is-active' : ''}`} onClick={() => void selectSubject(subject.id)}>
              {subject.title}
            </button>
          ))}
          {rootTopics.length > 0 && <div className="learning-chapters">
            {rootTopics.map(topic => {
              const lessons = childrenOf(topic.id)
              return (
                <div key={topic.id} className="learning-topic-group">
                  <h4>{topic.title}</h4>
                  {lessons.length > 0 ? lessons.map(lesson => (
                    <button key={lesson.id} type="button" className={`learning-item learning-node ${selectedNodeId === lesson.id ? 'is-active' : ''}`} onClick={() => void selectNode(lesson.id)}>
                      {lesson.title}
                    </button>
                  )) : <p className="learning-empty-hint">Aucun chapitre publié.</p>}
                </div>
              )
            })}
          </div>}
          {practiceSets.length > 0 && <div className="learning-chapters"><h4>Entraînement</h4>{practiceSets.map(set => (
            <button key={set.id} type="button" className="learning-item" onClick={() => navigate(`/practice/${set.id}`)}>{set.title}</button>
          ))}</div>}
        </aside>

        <main>
          {selectedNode ? <>
            <p className="eyebrow">{rootTopics.find(topic => topic.id === selectedNode.parentId)?.title ?? 'Leçon'}</p>
            <h2>{selectedNode.title}</h2>
            {selectedNode.description && <p className="page-description">{selectedNode.description}</p>}
          </> : <h2>Sélectionnez une leçon</h2>}
          {loadingLesson && <p>Chargement de la leçon...</p>}
          {!loadingLesson && selectedNode && blocks.length === 0 && <Card className="catalogue-empty"><p>Cette leçon ne contient pas encore de contenu publié.</p></Card>}

          {!loadingLesson && selectedNode && blocks.length > 0 && (
            <>
            <div className="learning-progress-actions">
              <button type="button" className={`ui-button ${completed ? 'ui-button-secondary' : 'ui-button-primary'}`} onClick={() => void toggleCompleted()}>
                {completed ? '✓ Leçon terminée' : 'Marquer comme terminée'}
              </button>
              <span>{completed ? 'Votre progression est enregistrée.' : 'Votre dernière visite est enregistrée automatiquement.'}</span>
            </div>
            <div className="learning-personal-actions"><button className={`ui-button ${bookmarkId ? 'ui-button-secondary' : 'ui-button-secondary'}`} onClick={() => void toggleBookmark()}>{bookmarkId ? '★ Retirer le signet' : '☆ Ajouter un signet'}</button><div className="learning-note"><textarea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Votre note personnelle sur cette leçon..."/><button className="ui-button ui-button-secondary" onClick={() => void saveCurrentNote()} disabled={!noteText.trim()}>Enregistrer ma note</button></div></div>
            </>
          )}

          {blocks.map((block, index) => (
            <Card key={block.id} className="learning-block">
              {block.type === 'video' && block.media?.url ? (
                <video ref={index === 0 ? videoRef : undefined} controls width="100%" src={block.media.url} onLoadedMetadata={() => { if (videoRef.current && videoStart > 0) videoRef.current.currentTime = Math.min(videoStart, videoRef.current.duration || videoStart) }} onTimeUpdate={() => void saveVideoTimestamp()} />
              ) : block.type === 'image' && block.media?.url ? (
                <img src={block.media.url} alt="Illustration du cours" style={{ maxWidth: '100%' }} />
              ) : block.type === 'file' && block.media?.url ? (
                <a className="text-link" href={block.media.url} target="_blank" rel="noreferrer">Ouvrir le document</a>
              ) : (
                <div className="lesson-preview lesson-editor-surface learning-text" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(String(block.content.html ?? block.content.text ?? '')) }} />
              )}
            </Card>
          ))}


          {selectedNode && <section className="lesson-comments-section">
            <div className="lesson-comments-compact-bar">
              <div className="lesson-comments-label"><span className="lesson-comments-icon" aria-hidden="true">💬</span><div><strong>Commentaires{lessonComments.length > 0 && <span className="lesson-comments-count">{lessonComments.length}</span>}</strong><small>Posez vos questions ou échangez avec les autres étudiants.</small></div></div>
              <div className="lesson-comments-actions">
                <button type="button" className="lesson-comments-toggle secondary" onClick={() => setCommentsOpen(true)}>Commenter</button>
                <button type="button" className="lesson-comments-toggle" onClick={() => setCommentsOpen(value => !value)}>{commentsOpen ? 'Fermer' : 'Voir les commentaires'}</button>
              </div>
            </div>
            {commentsOpen && <><button type="button" className="lesson-comments-backdrop" aria-label="Fermer les commentaires" onClick={() => { setCommentsOpen(false); setOpenCommentMenuId(null) }} />
              <div className="lesson-comments-panel">
                <div className="lesson-comments-panel-head"><div><strong>Commentaires</strong><span>{lessonComments.length} {lessonComments.length === 1 ? 'commentaire' : 'commentaires'}</span></div><button type="button" className="lesson-comments-close" aria-label="Fermer" onClick={() => { setCommentsOpen(false); setOpenCommentMenuId(null) }}>×</button></div>
                <div className="lesson-comment-composer">
                  <div className="lesson-comment-composer-row"><span className="lesson-comment-avatar">{profile?.photoURL || user?.photoURL ? <img src={String(profile?.photoURL ?? user?.photoURL)} alt="" className="lesson-comment-avatar-image" /> : commentInitials(String(profile?.displayName ?? user?.displayName ?? 'Étudiant'))}</span><textarea value={commentText} onChange={event => setCommentText(event.target.value)} rows={3} maxLength={3000} placeholder="Écrivez votre commentaire..." /></div>
                  <div className="lesson-comment-compose-actions"><div className="lesson-comment-emoji-wrap"><button type="button" className="lesson-comment-tool" aria-label="Ajouter un emoji" onClick={() => { setEmojiPickerTarget(value => value === 'new' ? null : 'new'); setOpenCommentMenuId(null) }}>☺</button>{renderEmojiPicker('new')}</div><span>{commentText.length}/3000</span><button type="button" className="ui-button ui-button-primary" disabled={commentSaving || !commentText.trim()} onClick={() => void submitLessonComment()}>{commentSaving ? 'Publication...' : 'Publier'}</button></div>
                </div>
                <div className="lesson-comments-list">
                  {lessonComments.length === 0 ? <div className="lesson-comments-empty"><span>💬</span><strong>Aucun commentaire pour le moment</strong><p>Soyez le premier à poser une question sur cette leçon.</p></div> : (() => {
                    const renderedIds = new Set<string>()
                    const roots = lessonComments.filter(comment => !comment.parentCommentId)
                    const orphanReplies = lessonComments.filter(comment => comment.parentCommentId && !lessonComments.some(parent => parent.id === comment.parentCommentId))
                    return [...roots, ...orphanReplies].map(comment => renderCommentThread(comment, 0, renderedIds))
                  })()}
                </div>
              </div>
            </>}
          </section>}
          {practiceSets.length > 0 && <section className="learning-practice-section"><p className="eyebrow">Entraînement</p><h2>Testez vos connaissances</h2><div className="practice-card-grid">{practiceSets.map(set => <Card key={set.id}><h3>{set.title}</h3><p>{set.description || 'Entraînez-vous avec les questions de cette matière.'}</p><span className="page-description">{set.questions.length} question{set.questions.length === 1 ? '' : 's'}</span><button className="ui-button ui-button-primary" onClick={() => navigate(`/practice/${set.id}`)}>Commencer</button></Card>)}</div></section>}
          {psychotechnicalTests.length > 0 && <section className="learning-practice-section"><p className="eyebrow">🧠 Tests psychotechniques</p><h2>Évaluez votre raisonnement</h2><div className="practice-card-grid">{psychotechnicalTests.map(test => <Card key={test.id}><h3>{test.title}</h3><p>{test.description || 'Logique, numérique, attention, mémoire et autres exercices psychotechniques.'}</p><span className="page-description">{test.settings.questionCount} questions · {test.settings.durationMinutes} min</span><button className="ui-button ui-button-primary" onClick={() => navigate(`/psychotechnical/${test.id}`)}>Commencer</button></Card>)}</div></section>}
          {importantSets.length > 0 && <section className="learning-practice-section"><p className="eyebrow">Révision</p><h2>Questions importantes</h2><div className="practice-card-grid">{importantSets.map(set => <Card key={set.id}><h3>{set.title}</h3><p>{set.description || 'Questions importantes de cette matière.'}</p><span className="page-description">{set.questions.length} question{set.questions.length === 1 ? '' : 's'}</span></Card>)}</div></section>}
        </main>
      </div>
    </Container>
  )
}
