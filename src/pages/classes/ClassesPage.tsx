import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { Button } from '../../components/Button/Button'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { ClassCard } from '../../features/classes/ClassCard'
import { ClassFormModal } from '../../features/classes/ClassFormModal'
import { JoinClassModal } from '../../features/classes/JoinClassModal'
import { countCoursesByClass, useClassesAndCourses } from '../../features/classes/useClassesAndCourses'
import { useAuth } from '../../features/auth/useAuth'
import { paths } from '../../routes/paths'
import type { User, UserRole } from '../../types'
import styles from './ClassesPage.module.css'

interface RoleCopy {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}

const copy: Record<UserRole, RoleCopy> = {
  teacher: {
    title: 'Mes classes',
    description: "Créez vos classes, partagez leur code et regroupez vos cours par groupe d'étudiants.",
    emptyTitle: 'Aucune classe pour le moment',
    emptyDescription:
      'Créez votre première classe, puis partagez son code pour que vos étudiants la rejoignent.',
  },
  student: {
    title: 'Mes classes',
    description: 'Retrouvez les classes que vous avez rejointes et les cours qui leur sont associés.',
    emptyTitle: "Vous n'avez rejoint aucune classe",
    emptyDescription: 'Demandez son code à votre enseignant, puis saisissez-le pour rejoindre la classe.',
  },
  admin: {
    title: 'Classes',
    description: 'Toutes les classes créées sur la plateforme.',
    emptyTitle: 'Aucune classe sur la plateforme',
    emptyDescription: 'Les classes créées par les enseignants apparaîtront ici.',
  },
}

export function ClassesPage() {
  const { user } = useAuth()

  // This page always renders behind ProtectedRoute, which resolves the
  // signed-in user before rendering its children.
  if (!user) {
    return null
  }

  return <ClassesView user={user} />
}

function ClassesView({ user }: { user: User }) {
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const { data, isLoading, errorMessage, refresh } = useClassesAndCourses(user)

  const text = copy[user.role]
  const classes = data?.classes ?? []
  const courseCounts = countCoursesByClass(data?.courses ?? [])

  const primaryAction =
    user.role === 'teacher' ? (
      <Button type="button" onClick={() => setIsCreateOpen(true)}>
        Créer une classe
      </Button>
    ) : user.role === 'student' ? (
      <Button type="button" onClick={() => setIsJoinOpen(true)}>
        Rejoindre une classe
      </Button>
    ) : undefined

  return (
    <div>
      <PageHeader title={text.title} description={text.description} action={primaryAction} />

      {isLoading && <LoadingState label="Chargement des classes" />}

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

      {!isLoading && !errorMessage && classes.length === 0 && (
        <EmptyState
          icon="icon-graduation"
          title={text.emptyTitle}
          description={text.emptyDescription}
          action={primaryAction}
        />
      )}

      {!isLoading && !errorMessage && classes.length > 0 && (
        <div className={styles.grid}>
          {classes.map((classItem) => (
            <ClassCard
              key={classItem.id}
              classItem={classItem}
              courseCount={courseCounts[classItem.id] ?? 0}
            />
          ))}
        </div>
      )}

      {user.role === 'teacher' && isCreateOpen && (
        <ClassFormModal
          isOpen
          onClose={() => setIsCreateOpen(false)}
          teacher={user}
          onSaved={(classId) => navigate(paths.classDetail(classId))}
        />
      )}

      {user.role === 'student' && isJoinOpen && (
        <JoinClassModal
          isOpen
          onClose={() => setIsJoinOpen(false)}
          student={user}
          onJoined={(classId) => navigate(paths.classDetail(classId))}
        />
      )}
    </div>
  )
}
