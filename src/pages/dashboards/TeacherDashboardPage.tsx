import { PageHeader } from '../../components/PageHeader/PageHeader'
import { DashboardSectionCard } from './DashboardSectionCard'
import styles from './DashboardPage.module.css'

export function TeacherDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Bienvenue"
        description="Gérez vos classes, vos cours et suivez l'activité de vos étudiants."
      />
      <div className={styles.grid}>
        <DashboardSectionCard
          title="Mes classes"
          icon="icon-graduation"
          emptyTitle="Aucune classe créée"
          emptyDescription="Créez votre première classe pour commencer à inviter des étudiants."
        />
        <DashboardSectionCard
          title="Mes cours"
          icon="icon-book"
          emptyTitle="Aucun cours publié"
          emptyDescription="Les cours que vous créez apparaîtront ici."
        />
        <DashboardSectionCard
          title="Mes étudiants"
          icon="icon-users"
          emptyTitle="Aucun étudiant inscrit"
          emptyDescription="La liste de vos étudiants s'affichera une fois vos classes créées."
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
