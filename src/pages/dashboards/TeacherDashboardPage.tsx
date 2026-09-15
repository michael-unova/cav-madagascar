import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Button } from '../../components/Button/Button'
import { DashboardSectionCard } from './DashboardSectionCard'
import { DashboardItemList } from './DashboardItemList'
import { countCoursesByClass, useClassesAndCourses } from '../../features/classes/useClassesAndCourses'
import { useAuth } from '../../features/auth/useAuth'
import { paths } from '../../routes/paths'
import type { User } from '../../types'
import styles from './DashboardPage.module.css'

const PREVIEW_LIMIT = 4

export function TeacherDashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <TeacherDashboardView user={user} />
}

function TeacherDashboardView({ user }: { user: User }) {
  const { data, isLoading, errorMessage } = useClassesAndCourses(user)

  const classes = data?.classes ?? []
  const courses = data?.courses ?? []
  const courseCounts = countCoursesByClass(courses)
  const classNamesById = Object.fromEntries(classes.map((item) => [item.id, item.name]))

  return (
    <div>
      <PageHeader
        title="Bienvenue"
        description="Gérez vos classes, vos cours et suivez l'activité de vos étudiants."
        action={
          <Button to={paths.classes} variant="secondary">
            Voir mes classes
          </Button>
        }
      />
      <div className={styles.grid}>
        <DashboardSectionCard
          title="Mes classes"
          icon="icon-graduation"
          emptyTitle="Aucune classe créée"
          emptyDescription="Créez votre première classe pour commencer à inviter des étudiants."
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
                meta:
                  (courseCounts[classItem.id] ?? 0) === 1
                    ? '1 cours'
                    : `${courseCounts[classItem.id] ?? 0} cours`,
                to: paths.classDetail(classItem.id),
              }))}
            />
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title="Mes cours"
          icon="icon-book"
          emptyTitle="Aucun cours publié"
          emptyDescription="Les cours que vous créez apparaîtront ici."
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
          title="Mes étudiants"
          icon="icon-users"
          emptyTitle="Liste par classe"
          emptyDescription="Ouvrez une classe pour consulter les étudiants qui l'ont rejointe."
        />

        <DashboardSectionCard
          title="Activité récente"
          icon="icon-activity"
          emptyTitle="Aucune activité récente"
          emptyDescription="Les rendus, questions et échanges récents apparaîtront ici."
        />
      </div>
    </div>
  )
}
