import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { createSubject, listAdminSubjects, updateSubject } from '../features/admin/adminRepository'
import type { Subject } from '../types/subject'

export function AdminSubjectsPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [name, setName] = useState('')
  const [matricule, setMatricule] = useState('')
  const [niveau, setNiveau] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function refresh() { setSubjects(await listAdminSubjects()) }
  useEffect(() => { void refresh() }, [])

  async function handleSave(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!user || !name.trim() || !matricule.trim() || !niveau.trim()) { setError('Le nom, le matricule et le niveau sont obligatoires.'); return }
    try {
      if (editingId) await updateSubject(editingId, { name: name.trim(), matricule: matricule.trim().toUpperCase(), niveau: niveau.trim(), description: description.trim() }, user.uid)
      else await createSubject({ name, matricule: matricule.trim().toUpperCase(), niveau: niveau.trim(), description, userId: user.uid })
      setName(''); setMatricule(''); setNiveau(''); setDescription(''); setEditingId(null); await refresh()
    } catch (err) { console.error(err); setError('Impossible d’enregistrer la matière.') }
  }

  function edit(subject: Subject) { setEditingId(subject.id); setName(subject.name); setMatricule(subject.matricule); setNiveau(subject.niveau); setDescription(subject.description); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Administration</p><h1>Matières</h1><p className="page-description">Gérez la bibliothèque globale des matières réutilisables.</p></div></div>
    <Card className="admin-form-card"><h2>{editingId ? 'Modifier la matière' : 'Créer une matière'}</h2>{error && <div className="form-error" role="alert">{error}</div>}<form className="auth-form" onSubmit={handleSave}><label>Nom<input value={name} onChange={e => setName(e.target.value)} placeholder="Mathématiques" /></label><label>Matricule / code<input value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="MAT-001" /></label><label>Niveau<input value={niveau} onChange={e => setNiveau(e.target.value)} placeholder="Niveau II" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></label><div className="admin-list-actions"><button className="ui-button ui-button-primary">{editingId ? 'Enregistrer' : 'Créer en brouillon'}</button>{editingId && <button type="button" className="ui-button ui-button-secondary" onClick={() => { setEditingId(null); setName(''); setMatricule(''); setNiveau(''); setDescription('') }}>Annuler</button>}</div></form></Card>
    <section className="admin-list-section"><h2>Bibliothèque</h2><div className="admin-list">{subjects.map(subject => <Card key={subject.id} className="admin-list-row"><div><strong>{subject.name}</strong><span>{subject.description || 'Aucune description'}</span></div><div className="admin-list-actions"><span className={`status-pill status-${subject.status}`}>{subject.status}</span><button className="ui-button ui-button-secondary" onClick={() => edit(subject)}>Modifier</button><Link className="ui-button ui-button-secondary" to={`/admin/content?subject=${subject.id}`}>Gérer le contenu</Link>{subject.status === 'draft' ? <button className="ui-button ui-button-secondary" onClick={() => user && void updateSubject(subject.id, { status: 'published' }, user.uid).then(refresh)}>Publier</button> : <button className="ui-button ui-button-secondary" onClick={() => user && void updateSubject(subject.id, { status: 'draft' }, user.uid).then(refresh)}>Dépublier</button>}</div></Card>)}</div></section>
  </Container>
}
