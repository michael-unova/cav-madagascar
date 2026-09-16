import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Card } from '../../components/Card/Card'
import { Button } from '../../components/Button/Button'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog'
import { LessonFormModal } from '../../features/lessons/LessonFormModal'
import { LessonVideoPanel } from '../../features/lessons/LessonVideoPanel'
import { LessonMaterialsPanel } from '../../features/lessons/LessonMaterialsPanel'
import { useAuth } from '../../features/auth/useAuth'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getCourse } from '../../lib/firebase/courses'
import { getLesson } from '../../lib/firebase/lessons'
import { listLessonMaterials } from '../../lib/firebase/lessonMaterials'
import { deleteLessonWithContent, getLessonFileUrl } from '../../lib/firebase/lessonStorage'
import { getStorageErrorMessage } from '../../lib/firebase/storageErrors'
import { paths } from '../../routes/paths'
import { formatDate } from '../../utils/formatDate'
import type { Course, Lesson, LessonMaterial, User } from '../../types'
import styles from './LessonDetailPage.module.css'

interface LessonDetailData {
  lesson: Lesson | null
  course: Course | null
  materials: LessonMaterial[]
  videoUrl: string | null
}

export function LessonDetailPage() {
  const { user } = useAuth()
  const { lessonId } = useParams<{ lessonId: string }>()

  if (!user || !lessonId) {
    return null
  }

  return <LessonDetailView user={user} lessonId={lessonId} />
}

function LessonDetailView({ user, lessonId }: { user: User; lessonId: string }) {
  const navigate = useNavigate()
  const { data, isLoading, errorMessage, refresh } = useAsyncData<LessonDetailData>(async () => {
    const lesson = await getLesson(lessonId)

    if (!lesson) {
      return { lesson: null, course: null, materials: [], videoUrl: null }
    }

    // Anyone allowed to read the lesson is also allowed to read its course
    // and its materials, so both load without a separate permission check.
    const [course, materials, videoUrl] = await Promise.all([
      getCourse(lesson.courseId),
      listLessonMaterials(lesson.id),
      lesson.videoPath ? getLessonFileUrl(lesson.videoPath).catch(() => null) : Promise.resolve(null),
    ])

    return { lesson, course, materials, videoUrl }
  }, [lessonId])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)

  if (isLoading) {
    return <LoadingState label="Chargement de la leçon" />
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

  const lesson = data?.lesson ?? null

  if (!lesson) {
    return (
      <EmptyState
        icon="icon-file"
        title="Leçon introuvable"
        description="Cette leçon a peut-être été supprimée, ou le lien utilisé est incorrect."
        action={
          <Button to={paths.courses} variant="secondary">
            Revenir aux cours
          </Button>
        }
      />
    )
  }

  const course = data?.course ?? null
  const materials = data?.materials ?? []
  const videoUrl = data?.videoUrl ?? null
  const isOwner = lesson.teacherId === user.id

  const handleDelete = async () => {
    setPendingError(null)
    setIsPending(true)

    try {
      await deleteLessonWithContent(lesson.id, lesson.videoPath)
      navigate(paths.courseDetail(lesson.courseId), { replace: true })
    } catch (error) {
      setPendingError(getStorageErrorMessage(error))
      setIsPending(false)
    }
  }

  return (
    <div>
      <Link to={paths.courseDetail(lesson.courseId)} className={styles.backLink}>
        <svg className={styles.backIcon} aria-hidden="true">
          <use href="/icons.svg#icon-chevron-right" />
        </svg>
        {course ? course.title : 'Le cours'}
      </Link>

      <PageHeader
        title={lesson.title}
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
        Leçon {lesson.order + 1}. Créée le {formatDate(lesson.createdAt)}.
      </p>

      {pendingError && <ErrorState title="Action impossible" description={pendingError} />}

      {lesson.description && (
        <Card className={styles.descriptionCard}>
          <p className={styles.description}>{lesson.description}</p>
        </Card>
      )}

      <LessonVideoPanel lesson={lesson} videoUrl={videoUrl} isOwner={isOwner} onChanged={refresh} />

      <LessonMaterialsPanel lesson={lesson} materials={materials} isOwner={isOwner} onChanged={refresh} />

      {isOwner && isEditOpen && (
        <LessonFormModal
          isOpen
          onClose={() => setIsEditOpen(false)}
          courseId={lesson.courseId}
          classId={lesson.classId}
          teacherId={user.id}
          lesson={lesson}
          onSaved={refresh}
        />
      )}

      {isOwner && (
        <ConfirmDialog
          isOpen={isDeleteOpen}
          title="Supprimer la leçon"
          message={`La leçon "${lesson.title}", sa vidéo et ses supports de cours seront définitivement supprimés.`}
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
