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
import { useAuth } from '../../features/auth/useAuth'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getClass } from '../../lib/firebase/classes'
import { deleteCourse, getCourse } from '../../lib/firebase/courses'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import { paths } from '../../routes/paths'
import { formatDate } from '../../utils/formatDate'
import type { Class, Course, User } from '../../types'
import styles from './CourseDetailPage.module.css'

interface CourseDetailData {
  course: Course | null
  classItem: Class | null
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
      return { course: null, classItem: null }
    }

    // Anyone allowed to read the course is also allowed to read its class,
    // so the class name can be shown without a second permission check.
    const classItem = await getClass(course.classId)
    return { course, classItem }
  }, [courseId])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)

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
  const isOwner = course.teacherId === user.id

  const handleDelete = async () => {
    setPendingError(null)
    setIsPending(true)

    try {
      await deleteCourse(course.id)
      navigate(classItem ? paths.classDetail(classItem.id) : paths.courses, { replace: true })
    } catch (error) {
      setPendingError(
        getFirestoreErrorMessage(error, "Le cours n'a pas pu être supprimé. Veuillez réessayer."),
      )
      setIsPending(false)
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
        <h2 className={styles.sectionTitle}>Leçons</h2>
        <Card>
          <EmptyState
            icon="icon-file"
            title="Aucune leçon pour le moment"
            description={
              isOwner
                ? 'Les leçons, vidéos et supports de cours arriveront dans une prochaine version.'
                : 'Les leçons de ce cours seront disponibles prochainement.'
            }
          />
        </Card>
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
          message={`Le cours "${course.title}" sera définitivement supprimé pour tous les étudiants de la classe.`}
          confirmLabel="Supprimer définitivement"
          pendingLabel="Suppression..."
          isPending={isPending}
          onConfirm={handleDelete}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </div>
  )
}
