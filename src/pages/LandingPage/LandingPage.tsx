import { Button } from '../../components/Button/Button'
import { Card } from '../../components/Card/Card'
import { paths } from '../../routes/paths'
import styles from './LandingPage.module.css'

const steps = [
  {
    title: 'Créer une classe',
    description: "L'enseignant crée une classe et y invite ses étudiants.",
  },
  {
    title: 'Publier des cours et des leçons',
    description: 'Vidéos, supports et exercices sont organisés cours par cours.',
  },
  {
    title: 'Suivre la progression',
    description: "Étudiants et enseignants suivent l'avancement au même endroit.",
  },
]

const features = [
  {
    icon: 'icon-book',
    title: 'Cours structurés',
    description:
      'Organisez chaque classe en cours et en leçons, du premier chapitre jusqu\u2019à la validation des acquis.',
  },
  {
    icon: 'icon-graduation',
    title: 'Leçons vidéo',
    description: 'Publiez des vidéos et des supports consultables en ligne, à tout moment.',
  },
  {
    icon: 'icon-message',
    title: 'Échanges enseignants et étudiants',
    description: 'Annonces et discussions gardent la classe connectée entre les séances.',
  },
  {
    icon: 'icon-chart',
    title: 'Suivi de progression',
    description: 'Chacun voit ce qui est fait, ce qui reste à faire et ce qui doit être rendu.',
  },
]

const roles = [
  {
    title: 'Enseignants',
    description: 'Créent leurs classes et leurs cours, publient des leçons et suivent leurs étudiants.',
    items: ['Créer des classes et des cours', 'Publier des leçons et des supports', 'Suivre les étudiants et leurs rendus'],
  },
  {
    title: 'Étudiants',
    description: 'Accèdent à leurs cours, avancent à leur rythme et gardent une vue claire sur leur travail.',
    items: ['Regarder les leçons et lire les supports', 'Rendre les travaux demandés', 'Suivre leur progression'],
  },
  {
    title: 'Administrateurs',
    description: "Gèrent les comptes et gardent une vue d'ensemble sur l'activité de la plateforme.",
    items: ['Gérer les enseignants et les étudiants', "Garder une vue d'ensemble des classes", 'Superviser les cours publiés'],
  },
]

export function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>Apprendre. Enseigner. Progresser.</h1>
          <p className={styles.heroSubtitle}>
            Nova Études réunit enseignants et étudiants dans un même espace pour organiser les
            classes, publier des cours et suivre chaque progression.
          </p>
          <div className={styles.heroActions}>
            <Button to={paths.register} size="md">
              Commencer
            </Button>
            <Button to={paths.login} variant="secondary" size="md">
              Se connecter
            </Button>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <span className={styles.heroCardTitle}>Introduction aux fonctions</span>
              <span className={styles.heroCardTag}>Mathématiques</span>
            </div>
            <div className={styles.heroProgressTrack}>
              <div className={styles.heroProgressFill} />
            </div>
            <ul className={styles.heroLessonList}>
              <li className={styles.heroLessonDone}>
                <svg className={styles.heroLessonIcon} aria-hidden="true">
                  <use href="/icons.svg#icon-check-circle" />
                </svg>
                Notion de fonction
              </li>
              <li className={styles.heroLessonDone}>
                <svg className={styles.heroLessonIcon} aria-hidden="true">
                  <use href="/icons.svg#icon-check-circle" />
                </svg>
                Représentation graphique
              </li>
              <li className={styles.heroLessonActive}>
                <svg className={styles.heroLessonIcon} aria-hidden="true">
                  <use href="/icons.svg#icon-book" />
                </svg>
                Fonctions affines
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comment ça marche</h2>
        <div className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <div key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Tout ce qu'il faut pour une classe en ligne</h2>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <Card key={feature.title} className={styles.featureCard}>
                <span className={styles.featureIconWrapper}>
                  <svg className={styles.featureIcon} aria-hidden="true">
                    <use href={`/icons.svg#${feature.icon}`} />
                  </svg>
                </span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Un espace pensé pour chaque rôle</h2>
        <div className={styles.roleGrid}>
          {roles.map((role) => (
            <Card key={role.title} padding="lg" className={styles.roleCard}>
              <h3 className={styles.roleTitle}>{role.title}</h3>
              <p className={styles.roleDescription}>{role.description}</p>
              <ul className={styles.roleList}>
                {role.items.map((item) => (
                  <li key={item} className={styles.roleListItem}>
                    <svg className={styles.roleListIcon} aria-hidden="true">
                      <use href="/icons.svg#icon-check-circle" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Prêt à organiser votre première classe ?</h2>
          <p className={styles.ctaDescription}>
            Créez un compte et configurez votre espace en quelques minutes.
          </p>
          <Button to={paths.register} size="md">
            Commencer
          </Button>
        </div>
      </section>
    </div>
  )
}
