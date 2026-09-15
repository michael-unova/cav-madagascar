import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Button } from '../../components/Button/Button'
import { DashboardSectionCard } from './DashboardSectionCard'
import { DashboardItemList } from './DashboardItemList'
import { countCoursesByClass, useClassesAndCourses } from '../../features/classes/useClassesAndCourses'
import { useAuth } from '../../features/auth/useAuth'
import { paths } from '../../routes/paths'
import type { User } from '../../types'
import styles from './DashboardPage.module.css'

const PREVIEW_LIMIT = 5

export function AdminDashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <AdminDashboardView user={user} />
}

function AdminDashboardView({ user }: { user: User }) {
  const { data, isLoading, errorMessage } = useClassesAndCourses(user)

  const classes = data?.classes ?? []
  const courses = data?.courses ?? []
  const courseCounts = countCoursesByClass(courses)
  const classNamesById = Object.fromEntries(classes.map((item) => [item.id, item.name]))

  return (
    <div>
      <PageHeader
        title="Vue d'ensemble"
        description="Supervisez les comptes, les classes et les cours de la plateforme."
      />
      <div className={styles.grid}>
        <DashboardSectionCard
          title="Classes"
          icon="icon-shield"
          emptyTitle="Aucune classe à afficher"
          emptyDescription="Les classes créées par les enseignants apparaîtront ici."
          isLoading={isLoading}
          errorMessage={errorMessage}
          action={
            classes.length > PREVIEW_LIMIT ? (
              <Button to={paths.classes} variant="ghost" size="sm">
                Voir les {classes.length} classes
              </Button>
            ) : undefined
          }
        >
          {classes.length > 0 && (
            <DashboardItemList
              items={classes.slice(0, PREVIEW_LIMIT).map((classItem) => ({
                id: classItem.id,
                label: classItem.name,
                meta: `${classItem.teacherName}, ${
                  (courseCounts[classItem.id] ?? 0) === 1
                    ? '1 cours'
                    : `${courseCounts[classItem.id] ?? 0} cours`
                }`,
                to: paths.classDetail(classItem.id),
              }))}
            />
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title="Cours"
          icon="icon-book"
          emptyTitle="Aucun cours à afficher"
          emptyDescription="Les cours publiés sur la plateforme apparaîtront ici."
          isLoading={isLoading}
          errorMessage={errorMessage}
          action={
            courses.length > PREVIEW_LIMIT ? (
              <Button to={paths.courses} variant="ghost" size="sm">
                Voir les {courses.length} cours
              </Button>
            ) : undefined
          }
        >
          {courses.length > 0 && (
            <DashboardItemList
              items={courses.slice(0, PREVIEW_LIMIT).map((course) => ({
                id: course.id,
                label: course.title,
                meta: classNamesById[course.classId],
                to: paths.courseDetail(course.id),
              }))}
            />
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title="Utilisateurs"
          icon="icon-users"
          emptyTitle="Aucun utilisateur à afficher"
          emptyDescription="La gestion des comptes sera disponible dans une prochaine version."
        />

        <DashboardSectionCard
          title="Enseignants"
          icon="icon-graduation"
          emptyTitle="Aucun enseignant à afficher"
          emptyDescription="La gestion des comptes enseignants sera disponible dans une prochaine version."
        />

        <DashboardSectionCard
          title="Étudiants"
          icon="icon-user"
          emptyTitle="Aucun étudiant à afficher"
          emptyDescription="La gestion des comptes étudiants sera disponible dans une prochaine version."
        />
      </div>
    </div>
  )
}
