import { Card } from '../../components/Card/Card'
import { Avatar } from '../../components/Avatar/Avatar'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const { user } = useAuth()

  return (
    <div>
      <PageHeader title="Profil" description="Gérez les informations de votre compte." />

      <Card padding="lg" className={styles.card}>
        <div className={styles.identity}>
          <Avatar name={user?.displayName ?? ''} size="lg" />
          <div>
            <p className={styles.name}>{user?.displayName}</p>
            <p className={styles.hint}>La modification du profil sera disponible dans une prochaine version.</p>
          </div>
        </div>

        <form className={styles.form}>
          <Input label="Nom complet" type="text" value={user?.displayName ?? ''} disabled />
          <Input label="Adresse e-mail" type="email" icon="icon-mail" value={user?.email ?? ''} disabled />
          <Button type="button" disabled>
            Enregistrer les modifications
          </Button>
        </form>
      </Card>
    </div>
  )
}
