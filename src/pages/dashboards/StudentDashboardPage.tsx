import { PageHeader } from '../../components/PageHeader/PageHeader'
import { DashboardSectionCard } from './DashboardSectionCard'
import styles from './DashboardPage.module.css'

export function StudentDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Bienvenue"
        description="Retrouvez vos cours, votre progression et les dernières annonces de vos classes."
      />
      <div className={styles.grid}>
        <DashboardSectionCard
          title="Mes cours"
          icon="icon-book"
          emptyTitle="Aucun cours pour le moment"
          emptyDescription="Les cours de vos classes apparaîtront ici une fois que vous serez inscrit."
        />
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
