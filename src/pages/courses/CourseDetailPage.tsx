import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Card } from '../../components/Card/Card'
import { Button } from '../../components/Button/Button'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog'
import { CourseFormModal } from '../../features/courses/CourseFormModal'
import { LessonFormModal } from '../../features/lessons/LessonFormModal'
import { LessonListItem } from '../../features/lessons/LessonListItem'
import { useAuth } from '../../features/auth/useAuth'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getClass } from '../../lib/firebase/classes'
import { getCourse } from '../../lib/firebase/courses'
import { listLessonsByCourse, swapLessonOrder } from '../../lib/firebase/lessons'
import { deleteLessonWithContent, deleteCourseWithContent } from '../../lib/firebase/lessonStorage'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import { getStorageErrorMessage } from '../../lib/firebase/storageErrors'
import { paths } from '../../routes/paths'
import { formatDate } from '../../utils/formatDate'
import type { Class, Course, Lesson, User } from '../../types'
import styles from './CourseDetailPage.module.css'

interface CourseDetailData {
  course: Course | null
  classItem: Class | null
  lessons: Lesson[]
}

export function CourseDetailPage() {
  const { user } = useAuth()
  const { courseId } = useParams<{ courseId: string }>()

  if (!user || !courseId) {
    return null
  }

  return <CourseDetailView user={user} courseId={courseId} />
}

function CourseDetailView({ user, courseId }: { user: User; courseId: string }) {
  const navigate = useNavigate()
  const { data, isLoading, errorMessage, refresh } = useAsyncData<CourseDetailData>(async () => {
    const course = await getCourse(courseId)

    if (!course) {
      return { course: null, classItem: null, lessons: [] }
    }

    // Anyone allowed to read the course is also allowed to read its class
    // and its lessons, so both load without a separate permission check.
    const [classItem, lessons] = await Promise.all([getClass(course.classId), listLessonsByCourse(courseId)])
    return { course, classItem, lessons }
  }, [courseId])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)

  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null)
  const [isLessonPending, setIsLessonPending] = useState(false)
  const [lessonError, setLessonError] = useState<string | null>(null)

  if (isLoading) {
    return <LoadingState label="Chargement du cours" />
  }

  if (errorMessage) {
    return (
      <ErrorState
        title="Chargement impossible"
        description={errorMessage}
        action={
          <Button type="button" variant="secondary" onClick={refresh}>
            Réessayer
          </Button>
        }
      />
    )
  }

  const course = data?.course ?? null

  if (!course) {
    return (
      <EmptyState
        icon="icon-book"
        title="Cours introuvable"
        description="Ce cours a peut-être été supprimé, ou le lien utilisé est incorrect."
        action={
          <Button to={paths.courses} variant="secondary">
            Revenir aux cours
          </Button>
        }
      />
    )
  }

  const classItem = data?.classItem ?? null
  const lessons = data?.lessons ?? []
  const isOwner = course.teacherId === user.id

  const handleDelete = async () => {
    setPendingError(null)
    setIsPending(true)

    try {
      await deleteCourseWithContent(course.id)
      navigate(classItem ? paths.classDetail(classItem.id) : paths.courses, { replace: true })
    } catch (error) {
      setPendingError(getStorageErrorMessage(error))
      setIsPending(false)
    }
  }

  const handleMoveLesson = async (lesson: Lesson, direction: 'up' | 'down') => {
    const index = lessons.findIndex((item) => item.id === lesson.id)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const target = lessons[targetIndex]
    if (!target) return

    setLessonError(null)

    try {
      await swapLessonOrder(lesson, target)
      refresh()
    } catch (error) {
      setLessonError(getFirestoreErrorMessage(error, "L'ordre des leçons n'a pas pu être modifié. Veuillez réessayer."))
    }
  }

  const handleDeleteLesson = async () => {
    if (!deletingLesson) return

    setLessonError(null)
    setIsLessonPending(true)

    try {
      await deleteLessonWithContent(deletingLesson.id, deletingLesson.videoPath)
      setDeletingLesson(null)
      refresh()
    } catch (error) {
      setLessonError(getStorageErrorMessage(error))
    } finally {
      setIsLessonPending(false)
    }
  }

  return (
    <div>
      <Link to={classItem ? paths.classDetail(classItem.id) : paths.courses} className={styles.backLink}>
        <svg className={styles.backIcon} aria-hidden="true">
          <use href="/icons.svg#icon-chevron-right" />
        </svg>
        {classItem ? classItem.name : 'Tous les cours'}
      </Link>

      <PageHeader
        title={course.title}
        action={
          isOwner ? (
            <div className={styles.headerActions}>
              <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
                Modifier
              </Button>
              <Button type="button" variant="danger" onClick={() => setIsDeleteOpen(true)}>
                Supprimer
              </Button>
            </div>
          ) : undefined
        }
      />

      <p className={styles.meta}>
        {classItem ? `Classe : ${classItem.name}. ` : ''}Créé le {formatDate(course.createdAt)}.
      </p>

      {pendingError && <ErrorState title="Action impossible" description={pendingError} />}

      {course.description && (
        <Card className={styles.descriptionCard}>
          <h2 className={styles.sectionTitle}>À propos de ce cours</h2>
          <p className={styles.description}>{course.description}</p>
        </Card>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Leçons</h2>
          {isOwner && lessons.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsLessonFormOpen(true)}>
              Ajouter une leçon
            </Button>
          )}
        </div>

        {lessonError && <ErrorState title="Action impossible" description={lessonError} />}

        {lessons.length === 0 ? (
          <Card>
            <EmptyState
              icon="icon-file"
              title="Aucune leçon pour le moment"
              description={
                isOwner
                  ? 'Créez une première leçon, puis ajoutez-y une vidéo et des supports de cours.'
                  : 'Les leçons de ce cours seront disponibles prochainement.'
              }
              action={
                isOwner ? (
                  <Button type="button" onClick={() => setIsLessonFormOpen(true)}>
                    Créer une leçon
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card>
            <ul className={styles.lessonList}>
              {lessons.map((lesson, index) => (
                <LessonListItem
                  key={lesson.id}
                  lesson={lesson}
                  isOwner={isOwner}
                  canMoveUp={index > 0}
                  canMoveDown={index < lessons.length - 1}
                  onMoveUp={() => handleMoveLesson(lesson, 'up')}
                  onMoveDown={() => handleMoveLesson(lesson, 'down')}
                  onEdit={() => setEditingLesson(lesson)}
                  onDelete={() => setDeletingLesson(lesson)}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {isOwner && isEditOpen && (
        <CourseFormModal
          isOpen
          onClose={() => setIsEditOpen(false)}
          classId={course.classId}
          teacherId={user.id}
          course={course}
          onSaved={refresh}
        />
      )}

      {isOwner && (
        <ConfirmDialog
          isOpen={isDeleteOpen}
          title="Supprimer le cours"
          message={`Le cours "${course.title}", ses leçons, vidéos et supports seront définitivement supprimés pour tous les étudiants de la classe.`}
          confirmLabel="Supprimer définitivement"
          pendingLabel="Suppression..."
          isPending={isPending}
          onConfirm={handleDelete}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}

      {isOwner && isLessonFormOpen && (
        <LessonFormModal
          isOpen
          onClose={() => setIsLessonFormOpen(false)}
          courseId={course.id}
          classId={course.classId}
          teacherId={user.id}
          onSaved={refresh}
        />
      )}

      {isOwner && editingLesson && (
        <LessonFormModal
          isOpen
          onClose={() => setEditingLesson(null)}
          courseId={course.id}
          classId={course.classId}
          teacherId={user.id}
          lesson={editingLesson}
          onSaved={refresh}
        />
      )}

      {isOwner && (
        <ConfirmDialog
          isOpen={deletingLesson !== null}
          title="Supprimer la leçon"
          message={
            deletingLesson
              ? `La leçon "${deletingLesson.title}", sa vidéo et ses supports de cours seront définitivement supprimés.`
              : ''
          }
          confirmLabel="Supprimer définitivement"
          pendingLabel="Suppression..."
          isPending={isLessonPending}
          onConfirm={handleDeleteLesson}
          onClose={() => setDeletingLesson(null)}
        />
      )}
    </div>
  )
}
