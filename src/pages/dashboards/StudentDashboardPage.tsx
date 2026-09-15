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

export function StudentDashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <StudentDashboardView user={user} />
}

function StudentDashboardView({ user }: { user: User }) {
  const { data, isLoading, errorMessage } = useClassesAndCourses(user)

  const classes = data?.classes ?? []
  const courses = data?.courses ?? []
  const courseCounts = countCoursesByClass(courses)
  const classNamesById = Object.fromEntries(classes.map((item) => [item.id, item.name]))

  return (
    <div>
      <PageHeader
        title="Bienvenue"
        description="Retrouvez vos cours, votre progression et les dernières annonces de vos classes."
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
          emptyTitle="Aucune classe rejointe"
          emptyDescription="Saisissez le code communiqué par votre enseignant pour rejoindre une classe."
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
          emptyTitle="Aucun cours pour le moment"
          emptyDescription="Les cours de vos classes apparaîtront ici une fois que vous serez inscrit."
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
          title="Ma progression"
          icon="icon-chart"
          emptyTitle="Rien à suivre pour l'instant"
          emptyDescription="Votre progression s'affichera ici dès que vous commencerez un cours."
        />

        <DashboardSectionCard
          title="Prochains travaux"
          icon="icon-file"
          emptyTitle="Aucun travail à rendre"
          emptyDescription="Les devoirs et échéances à venir apparaîtront ici."
        />

        <DashboardSectionCard
          title="Annonces"
          icon="icon-bell"
          emptyTitle="Aucune annonce"
          emptyDescription="Les annonces publiées par vos enseignants s'afficheront ici."
        />
      </div>
    </div>
  )
}
