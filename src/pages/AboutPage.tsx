import { Container } from '../components/ui/Container'
import { PageHeader } from '../components/ui/PageHeader'

export function AboutPage() {
  return (
    <Container className="page-container narrow">
      <PageHeader
        eyebrow="À propos"
        title="CAV Madagascar"
        description="Une plateforme numérique dédiée à la préparation aux concours à Madagascar."
      />
      <div className="prose">
        <p>
          Notre objectif est de rendre la préparation plus accessible, structurée et
          pratique grâce à des cours, des entraînements et un suivi de progression réunis au
          même endroit.
        </p>
      </div>
    </Container>
  )
}
