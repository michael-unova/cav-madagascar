import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Card } from '../../components/Card/Card'
import { Button } from '../../components/Button/Button'
import { Avatar } from '../../components/Avatar/Avatar'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog'
import { ClassCodePanel } from '../../features/classes/ClassCodePanel'
import { ClassFormModal } from '../../features/classes/ClassFormModal'
import { CourseCard } from '../../features/courses/CourseCard'
import { CourseFormModal } from '../../features/courses/CourseFormModal'
import { useAuth } from '../../features/auth/useAuth'
import { useAsyncData } from '../../hooks/useAsyncData'
import { deleteClassWithContent, getClass } from '../../lib/firebase/classes'
import { listCoursesByClass } from '../../lib/firebase/courses'
import { listEnrollmentsByClass, removeEnrollment } from '../../lib/firebase/enrollments'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import { paths } from '../../routes/paths'
import { formatDate } from '../../utils/formatDate'
import type { Class, Course, Enrollment, User } from '../../types'
import styles from './ClassDetailPage.module.css'

interface ClassDetailData {
  classItem: Class | null
  courses: Course[]
  enrollments: Enrollment[]
}

export function ClassDetailPage() {
  const { user } = useAuth()
  const { classId } = useParams<{ classId: string }>()

  if (!user || !classId) {
    return null
  }

  return <ClassDetailView user={user} classId={classId} />
}

function ClassDetailView({ user, classId }: { user: User; classId: string }) {
  const navigate = useNavigate()
  const { data, isLoading, errorMessage, refresh } = useAsyncData<ClassDetailData>(async () => {
    // Each read is tagged before rethrowing so the console shows exactly
    // which one failed, instead of one generic error that could be any of
    // the three. Temporary-in-spirit but harmless to leave permanently:
    // it only ever fires on the error path, never on success.
    const classItem = await getClass(classId).catch((error: unknown) => {
      console.error('[ClassDetailPage] getClass failed:', error)
      throw error
    })

    if (!classItem) {
      return { classItem: null, courses: [], enrollments: [] }
    }

    // Students may only read their own enrollment document, so the roster
    // is requested for the people entitled to see it and skipped for
    // everyone else rather than failing the whole page.
    const canSeeRoster = classItem.teacherId === user.id || user.role === 'admin'

    const [courses, enrollments] = await Promise.all([
      listCoursesByClass(classId).catch((error: unknown) => {
        console.error('[ClassDetailPage] listCoursesByClass failed:', error)
        throw error
      }),
      canSeeRoster
        ? listEnrollmentsByClass(classId).catch((error: unknown) => {
            console.error('[ClassDetailPage] listEnrollmentsByClass failed:', error)
            throw error
          })
        : Promise.resolve([]),
    ])

    return { classItem, courses, enrollments }
  }, [classId, user.id, user.role])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCourseFormOpen, setIsCourseFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isLeaveOpen, setIsLeaveOpen] = useState(false)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  if (isLoading) {
    return <LoadingState label="Chargement de la classe" />
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

  const classItem = data?.classItem ?? null

  if (!classItem) {
    return (
      <EmptyState
        icon="icon-graduation"
        title="Classe introuvable"
        description="Cette classe a peut-être été supprimée, ou le lien utilisé est incorrect."
        action={
          <Button to={paths.classes} variant="secondary">
            Revenir aux classes
          </Button>
        }
      />
    )
  }

  const courses = data?.courses ?? []
  const enrollments = data?.enrollments ?? []
  const isOwner = classItem.teacherId === user.id
  const isAdmin = user.role === 'admin'
  const canSeeCode = isOwner || isAdmin

  const handleDeleteClass = async () => {
    setPendingError(null)
    setIsPending(true)

    try {
      await deleteClassWithContent(classItem.id)
      navigate(paths.classes, { replace: true })
    } catch (error) {
      setPendingError(
        getFirestoreErrorMessage(error, "La classe n'a pas pu être supprimée. Veuillez réessayer."),
      )
      setIsPending(false)
    }
  }

  const handleLeaveClass = async () => {
    setPendingError(null)
    setIsPending(true)

    try {
      await removeEnrollment(classItem.id, user.id)
      navigate(paths.classes, { replace: true })
    } catch (error) {
      setPendingError(
        getFirestoreErrorMessage(error, "Vous n'avez pas pu quitter cette classe. Veuillez réessayer."),
      )
      setIsPending(false)
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    setPendingError(null)

    try {
      await removeEnrollment(classItem.id, studentId)
      refresh()
    } catch (error) {
      setPendingError(
        getFirestoreErrorMessage(error, "L'étudiant n'a pas pu être retiré. Veuillez réessayer."),
      )
    }
  }

  return (
    <div>
      <Link to={paths.classes} className={styles.backLink}>
        <svg className={styles.backIcon} aria-hidden="true">
          <use href="/icons.svg#icon-chevron-right" />
        </svg>
        Toutes les classes
      </Link>

      <PageHeader
        title={classItem.name}
        description={classItem.description || undefined}
        action={
          isOwner ? (
            <div className={styles.headerActions}>
              <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
                Modifier
              </Button>
              <Button type="button" onClick={() => setIsCourseFormOpen(true)}>
                Créer un cours
              </Button>
            </div>
          ) : user.role === 'student' ? (
            <Button type="button" variant="secondary" onClick={() => setIsLeaveOpen(true)}>
              Quitter la classe
            </Button>
          ) : undefined
        }
      />

      <p className={styles.subMeta}>
        Enseignant : {classItem.teacherName}. Classe créée le {formatDate(classItem.createdAt)}.
      </p>

      {pendingError && <ErrorState title="Action impossible" description={pendingError} />}

      {canSeeCode && (
        <div className={styles.codeSlot}>
          <ClassCodePanel code={classItem.id} />
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Cours</h2>
          {isOwner && courses.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCourseFormOpen(true)}>
              Ajouter un cours
            </Button>
          )}
        </div>

        {courses.length === 0 ? (
          <Card>
            <EmptyState
              icon="icon-book"
              title="Aucun cours dans cette classe"
              description={
                isOwner
                  ? 'Créez un premier cours pour organiser vos leçons et vos supports.'
                  : 'Les cours publiés par votre enseignant apparaîtront ici.'
              }
              action={
                isOwner ? (
                  <Button type="button" onClick={() => setIsCourseFormOpen(true)}>
                    Créer un cours
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className={styles.courseList}>
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      {(isOwner || isAdmin) && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              Étudiants{enrollments.length > 0 ? ` (${enrollments.length})` : ''}
            </h2>
          </div>

          {enrollments.length === 0 ? (
            <Card>
              <EmptyState
                icon="icon-users"
                title="Aucun étudiant inscrit"
                description="Partagez le code de la classe pour que vos étudiants la rejoignent."
              />
            </Card>
          ) : (
            <Card>
              <ul className={styles.studentList}>
                {enrollments.map((enrollment) => (
                  <li key={enrollment.id} className={styles.studentRow}>
                    <Avatar name={enrollment.studentName} size="sm" />
                    <div className={styles.studentInfo}>
                      <p className={styles.studentName}>{enrollment.studentName}</p>
                      <p className={styles.studentEmail}>{enrollment.studentEmail}</p>
                    </div>
                    {isOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStudent(enrollment.studentId)}
                      >
                        Retirer
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {isOwner && (
        <section className={styles.dangerZone}>
          <div>
            <h2 className={styles.sectionTitle}>Supprimer la classe</h2>
            <p className={styles.dangerText}>
              La classe, ses cours et les inscriptions de ses étudiants seront définitivement
              supprimés.
            </p>
          </div>
          <Button type="button" variant="danger" onClick={() => setIsDeleteOpen(true)}>
            Supprimer la classe
          </Button>
        </section>
      )}

      {isOwner && isEditOpen && (
        <ClassFormModal
          isOpen
          onClose={() => setIsEditOpen(false)}
          teacher={user}
          classItem={classItem}
          onSaved={refresh}
        />
      )}

      {isOwner && isCourseFormOpen && (
        <CourseFormModal
          isOpen
          onClose={() => setIsCourseFormOpen(false)}
          classId={classItem.id}
          teacherId={user.id}
          onSaved={refresh}
        />
      )}

      {isOwner && (
        <ConfirmDialog
          isOpen={isDeleteOpen}
          title="Supprimer la classe"
          message={`La classe "${classItem.name}", ses ${courses.length} cours et ses ${enrollments.length} inscriptions seront supprimés. Cette action est définitive.`}
          confirmLabel="Supprimer définitivement"
          pendingLabel="Suppression..."
          isPending={isPending}
          onConfirm={handleDeleteClass}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}

      {user.role === 'student' && (
        <ConfirmDialog
          isOpen={isLeaveOpen}
          title="Quitter la classe"
          message={`Vous perdrez l'accès aux cours de la classe "${classItem.name}". Vous pourrez la rejoindre à nouveau avec son code.`}
          confirmLabel="Quitter la classe"
          pendingLabel="En cours..."
          isPending={isPending}
          onConfirm={handleLeaveClass}
          onClose={() => setIsLeaveOpen(false)}
        />
      )}
    </div>
  )
}
