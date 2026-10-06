import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listAdminCourses, listAdminSubjects } from '../features/admin/adminRepository'
import { attachSubject, deleteCourseSubject, listCourseSubjects, updateCourseSubject } from '../features/curriculum'
import type { Course, CourseSubject } from '../types/course'
import type { Subject } from '../types/subject'

export function AdminCurriculumPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState<CourseSubject[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')

  async function refreshCourses() { setCourses(await listAdminCourses()); setSubjects(await listAdminSubjects()) }
  async function refreshItems(id = selected) { if (id) setItems(await listCourseSubjects(id)) }
  useEffect(() => { void refreshCourses() }, [])
  useEffect(() => { void refreshItems() }, [selected])

  async function add(event: FormEvent) {
    event.preventDefault(); if (!user || !selected || !subjectId) return
    const subject = subjects.find(item => item.id === subjectId); if (!subject) return
    try { await attachSubject({ courseId: selected, subjectId, title: subject.name, description: subject.description, order: items.length, userId: user.uid }); setSubjectId(''); await refreshItems() }
    catch { setError('Impossible d’ajouter la matière.') }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!user || !editingId) return
    try { await updateCourseSubject(editingId, { title: editingTitle.trim(), description: editingDescription.trim() }, user.uid); setEditingId(null); await refreshItems() }
    catch { setError('Impossible de modifier la matière du concours.') }
  }

  function edit(item: CourseSubject) { setEditingId(item.id); setEditingTitle(item.title); setEditingDescription(item.description ?? '') }

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Programme</p><h1>Curriculum</h1><p className="page-description">Associez des matières réutilisables à chaque concours et préparez sa structure.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <Card className="admin-form-card"><h2>Choisir un concours</h2><select className="admin-select" value={selected} onChange={e => { setSelected(e.target.value); setEditingId(null) }}><option value="">Sélectionner...</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Card>
    {selected && <>
      <Card className="admin-form-card"><h2>Ajouter une matière</h2><form className="admin-form-grid" onSubmit={add}><select className="admin-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">Choisir une matière publiée</option>{subjects.filter(subject => subject.status === 'published').map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><button className="ui-button ui-button-primary" type="submit">Ajouter</button></form></Card>
      <section className="admin-list-section"><h2>Matières du concours</h2><div className="admin-list">{items.map((item, index) => <Card className="admin-list-row" key={item.id}><div><strong>{index + 1}. {item.title}</strong><span>{item.description || ''}</span></div><div className="admin-list-actions"><span className={`status-pill status-${item.status}`}>{item.status}</span><button className="ui-button ui-button-secondary" onClick={() => edit(item)}>Modifier</button><button className="ui-button ui-button-secondary" onClick={() => user && void updateCourseSubject(item.id, { status: item.status === 'published' ? 'draft' : 'published' }, user.uid).then(() => refreshItems())}>{item.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="ui-button ui-button-secondary" onClick={() => void deleteCourseSubject(item.id).then(() => refreshItems())}>Supprimer</button></div></Card>)}</div></section>
      {editingId && <Card className="admin-form-card"><h2>Modifier la matière du concours</h2><form className="auth-form" onSubmit={saveEdit}><label>Titre<input value={editingTitle} onChange={e => setEditingTitle(e.target.value)} /></label><label>Description<textarea rows={3} value={editingDescription} onChange={e => setEditingDescription(e.target.value)} /></label><div className="admin-list-actions"><button className="ui-button ui-button-primary">Enregistrer</button><button type="button" className="ui-button ui-button-secondary" onClick={() => setEditingId(null)}>Annuler</button></div></form></Card>}
    </>}
  </Container>
}
