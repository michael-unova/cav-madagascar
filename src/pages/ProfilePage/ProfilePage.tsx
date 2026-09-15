import { Card } from '../../components/Card/Card'
import { Avatar } from '../../components/Avatar/Avatar'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profil" description="Gérez les informations de votre compte." />

      <Card padding="lg" className={styles.card}>
        <div className={styles.identity}>
          <Avatar name="Compte de démonstration" size="lg" />
          <div>
            <p className={styles.name}>Compte de démonstration</p>
            <p className={styles.hint}>
              La connexion et la modification du profil seront disponibles avec l'authentification.
            </p>
          </div>
        </div>

        <form className={styles.form}>
          <Input label="Nom complet" type="text" placeholder="Prénom et nom" disabled />
          <Input label="Adresse e-mail" type="email" icon="icon-mail" placeholder="vous@exemple.com" disabled />
          <Button type="button" disabled>
            Enregistrer les modifications
          </Button>
        </form>
      </Card>
    </div>
  )
}
