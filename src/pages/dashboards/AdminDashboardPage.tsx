import { PageHeader } from '../../components/PageHeader/PageHeader'
import { DashboardSectionCard } from './DashboardSectionCard'
import styles from './DashboardPage.module.css'

export function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Vue d'ensemble"
        description="Supervisez les comptes, les classes et les cours de la plateforme."
      />
      <div className={styles.grid}>
        <DashboardSectionCard
          title="Utilisateurs"
          icon="icon-users"
          emptyTitle="Aucun utilisateur à afficher"
          emptyDescription="La liste des comptes créés sur la plateforme apparaîtra ici."
        />
        <DashboardSectionCard
          title="Enseignants"
          icon="icon-graduation"
          emptyTitle="Aucun enseignant à afficher"
          emptyDescription="Les comptes enseignants apparaîtront ici une fois créés."
        />
        <DashboardSectionCard
          title="Étudiants"
          icon="icon-user"
          emptyTitle="Aucun étudiant à afficher"
          emptyDescription="Les comptes étudiants apparaîtront ici une fois créés."
        />
        <DashboardSectionCard
          title="Cours"
          icon="icon-book"
          emptyTitle="Aucun cours à afficher"
          emptyDescription="Les cours publiés sur la plateforme apparaîtront ici."
        />
        <DashboardSectionCard
          title="Classes"
          icon="icon-shield"
          emptyTitle="Aucune classe à afficher"
          emptyDescription="Les classes créées par les enseignants apparaîtront ici."
        />
      </div>
    </div>
  )
}
