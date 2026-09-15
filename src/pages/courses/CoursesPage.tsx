import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Button } from '../../components/Button/Button'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { CourseCard } from '../../features/courses/CourseCard'
import { useClassesAndCourses } from '../../features/classes/useClassesAndCourses'
import { useAuth } from '../../features/auth/useAuth'
import { paths } from '../../routes/paths'
import type { User, UserRole } from '../../types'
import styles from './CoursesPage.module.css'

interface RoleCopy {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}

const copy: Record<UserRole, RoleCopy> = {
  teacher: {
    title: 'Mes cours',
    description: 'Tous les cours que vous avez créés, toutes classes confondues.',
    emptyTitle: 'Aucun cours pour le moment',
    emptyDescription: 'Ouvrez une de vos classes pour y créer votre premier cours.',
  },
  student: {
    title: 'Mes cours',
    description: 'Les cours des classes que vous avez rejointes.',
    emptyTitle: 'Aucun cours disponible',
    emptyDescription:
      'Rejoignez une classe avec son code : les cours de cette classe apparaîtront ici.',
  },
  admin: {
    title: 'Cours',
    description: 'Tous les cours publiés sur la plateforme.',
    emptyTitle: 'Aucun cours sur la plateforme',
    emptyDescription: 'Les cours créés par les enseignants apparaîtront ici.',
  },
}

export function CoursesPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <CoursesView user={user} />
}

function CoursesView({ user }: { user: User }) {
  const { data, isLoading, errorMessage, refresh } = useClassesAndCourses(user)

  const text = copy[user.role]
  const courses = data?.courses ?? []
  const classNamesById = Object.fromEntries(
    (data?.classes ?? []).map((classItem) => [classItem.id, classItem.name]),
  )

  return (
    <div>
      <PageHeader title={text.title} description={text.description} />

      {isLoading && <LoadingState label="Chargement des cours" />}

      {!isLoading && errorMessage && (
        <ErrorState
          title="Chargement impossible"
          description={errorMessage}
          action={
            <Button type="button" variant="secondary" onClick={refresh}>
              Réessayer
            </Button>
          }
        />
      )}

      {!isLoading && !errorMessage && courses.length === 0 && (
        <EmptyState
          icon="icon-book"
          title={text.emptyTitle}
          description={text.emptyDescription}
          action={
            user.role === 'admin' ? undefined : (
              <Button to={paths.classes} variant="secondary">
                Voir mes classes
              </Button>
            )
          }
        />
      )}

      {!isLoading && !errorMessage && courses.length > 0 && (
        <div className={styles.list}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} className={classNamesById[course.classId]} />
          ))}
        </div>
      )}
    </div>
  )
}
