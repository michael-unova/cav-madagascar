import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { getFirebaseFirestore } from '../lib/firebase/firestore'
import { getFirebaseFunctions } from '../lib/firebase/functions'
import { httpsCallable } from 'firebase/functions'
import type { UserRole, UserStatus } from '../types/user'

type AdminUser = { id: string; displayName: string; email: string; role: UserRole; status: UserStatus; createdAt?: Date; lastSeenAt?: Date }

function toDate(value: unknown) { return value && typeof value === 'object' && 'toDate' in value ? (value as { toDate: () => Date }).toDate() : undefined }

export function AdminUsersPage() {
  const db = getFirebaseFirestore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [filter, setFilter] = useState<'all' | 'student' | 'content_manager' | 'super_admin'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    const snapshot = await getDocs(collection(db, 'users'))
    const mapped = snapshot.docs.map(d => ({
      id: d.id,
      displayName: String(d.data().displayName ?? 'Sans nom'),
      email: String(d.data().email ?? ''),
      role: (d.data().role ?? 'student') as UserRole,
      status: (d.data().status ?? 'active') as UserStatus,
      createdAt: toDate(d.data().createdAt),
      lastSeenAt: toDate(d.data().lastSeenAt),
    })).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    setUsers(mapped)
  }

  useEffect(() => { void refresh().catch(() => setError('Impossible de charger les utilisateurs.')).finally(() => setLoading(false)) }, [db])

  async function toggleStatus(item: AdminUser) {
    setError('')
    try {
      const setUserStatus = httpsCallable<{ userId: string; status: 'active' | 'suspended' }, { success: boolean }>(getFirebaseFunctions(), 'setUserStatus')
      await setUserStatus({ userId: item.id, status: item.status === 'active' ? 'suspended' : 'active' })
      await refresh()
    } catch (err) {
      console.error(err)
      setError('Impossible de modifier le statut de cet utilisateur.')
    }
  }

  const filtered = filter === 'all' ? users : users.filter(item => item.role === filter)

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Administration</p><h1>Utilisateurs</h1><p className="page-description">Consultez les comptes et contrôlez leur statut d’accès.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="user-filters"><button className={`ui-button ${filter === 'all' ? 'ui-button-primary' : 'ui-button-secondary'}`} onClick={() => setFilter('all')}>Tous</button><button className={`ui-button ${filter === 'student' ? 'ui-button-primary' : 'ui-button-secondary'}`} onClick={() => setFilter('student')}>Étudiants</button><button className={`ui-button ${filter === 'content_manager' ? 'ui-button-primary' : 'ui-button-secondary'}`} onClick={() => setFilter('content_manager')}>Content managers</button><button className={`ui-button ${filter === 'super_admin' ? 'ui-button-primary' : 'ui-button-secondary'}`} onClick={() => setFilter('super_admin')}>Super admins</button></div>
    {loading ? <div className="catalogue-state">Chargement...</div> : <div className="admin-list">{filtered.map(item => <Card className="admin-list-row" key={item.id}><div><strong>{item.displayName}</strong><span>{item.email} · {item.role}</span><small>{item.createdAt ? `Inscrit le ${item.createdAt.toLocaleDateString('fr-FR')}` : ''}{item.lastSeenAt ? ` · Dernière activité : ${item.lastSeenAt.toLocaleString('fr-FR')}` : ''}</small></div><div className="admin-list-actions"><span className={`status-pill status-${item.status === 'active' ? 'published' : 'archived'}`}>{item.status === 'active' ? 'Actif' : 'Suspendu'}</span>{item.role !== 'super_admin' && <button className="ui-button ui-button-secondary" onClick={() => void toggleStatus(item)}>{item.status === 'active' ? 'Suspendre' : 'Réactiver'}</button>}</div></Card>)}{filtered.length === 0 && <Card className="catalogue-empty"><p>Aucun utilisateur dans ce filtre.</p></Card>}</div>}
  </Container>
}
