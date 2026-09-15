import { Button } from '../../components/Button/Button'
import { paths } from '../../routes/paths'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Page introuvable</h1>
      <p className={styles.description}>
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Button to={paths.home}>Retour à l'accueil</Button>
    </div>
  )
}
