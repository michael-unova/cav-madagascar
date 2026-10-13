import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listAdminCourses, listAdminSubjects } from '../features/admin/adminRepository'
import { getFirebaseFirestore } from '../lib/firebase/firestore'
import type { Course } from '../types/course'
import type { Subject } from '../types/subject'

export function AdminDashboardPage() {
  const { profile } = useAuth()
  const db = getFirebaseFirestore()
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [pendingPayments, setPendingPayments] = useState(0)
  const [users, setUsers] = useState(0)
  const [enrollments, setEnrollments] = useState(0)

  useEffect(() => {
    void Promise.all([
      listAdminCourses(),
      listAdminSubjects(),
      getCountFromServer(query(collection(db, 'payments'), where('status', '==', 'pending'))),
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(query(collection(db, 'enrollments'), where('status', '==', 'active'))),
    ]).then(([c, s, payments, userCount, enrollmentCount]) => {
      setCourses(c)
      setSubjects(s)
      setPendingPayments(payments.data().count)
      setUsers(userCount.data().count)
      setEnrollments(enrollmentCount.data().count)
    }).catch(console.error)
  }, [db])

  return <Container className="page-container">
    <div className="dashboard-header"><div><p className="eyebrow">Administration</p><h1>Tableau de bord</h1><p className="page-description">Bienvenue dans l’espace de gestion CAV Madagascar.</p></div><span className="admin-role-badge">{String(profile?.role ?? '')}</span></div>
    <div className="admin-stat-grid admin-stat-grid-wide"><Card><span className="admin-stat-label">Concours</span><strong>{courses.length}</strong><small>{courses.filter(c => c.status === 'published').length} publiés</small></Card><Card><span className="admin-stat-label">Matières</span><strong>{subjects.length}</strong></Card><Card><span className="admin-stat-label">Utilisateurs</span><strong>{users}</strong></Card><Card><span className="admin-stat-label">Inscriptions actives</span><strong>{enrollments}</strong></Card><Card><span className="admin-stat-label">Paiements en attente</span><strong>{pendingPayments}</strong></Card></div>
    <div className="admin-action-grid"><Card><h2>Concours</h2><p>Créer, modifier et publier les préparations.</p><Link className="ui-button ui-button-primary" to="/admin/courses">Gérer</Link></Card><Card><h2>Curriculum</h2><p>Associer les matières et préparer la structure.</p><Link className="ui-button ui-button-primary" to="/admin/curriculum">Gérer</Link></Card><Card><h2>Contenu</h2><p>Créer les chapitres et coller les leçons depuis Word.</p><Link className="ui-button ui-button-primary" to="/admin/content">Gérer</Link></Card><Card><h2>Questions & entraînements</h2><p>Créer la banque de questions et les entraînements.</p><Link className="ui-button ui-button-primary" to="/admin/questions">Gérer</Link></Card><Card><h2>Paiements</h2><p>Vérifier les références MVola et activer les accès.</p><Link className="ui-button ui-button-primary" to="/admin/payments">Gérer</Link></Card><Card><h2>{profile?.role === 'super_admin' ? 'Utilisateurs & analytics' : 'Utilisateurs'}</h2><p>Suivre l’activité et gérer les comptes.</p><div className="admin-list-actions"><Link className="ui-button ui-button-secondary" to="/admin/users">Utilisateurs</Link>{profile?.role === 'super_admin' && <Link className="ui-button ui-button-secondary" to="/admin/analytics">Analytics</Link>}</div></Card></div>
  </Container>
}
