import { useEffect, useMemo, useRef, useState } from 'react'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { useAuth } from '../features/auth'
import { createLibraryBook, deleteLibraryBook, listAdminLibraryBooks, updateLibraryBook } from '../features/library'
import { listAdminCourses } from '../features/admin/adminRepository'
import type { Course } from '../types/course'
import type { LibraryBook, LibraryBookType, LibraryVisibility } from '../types/library'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase/storage'
import { confirmAction } from '../components/ConfirmDialog'

const emptyForm = { title: '', author: '', description: '', category: 'Culture générale', type: 'pdf' as LibraryBookType, resourceUrl: '', coverUrl: '', keywords: '', visibility: 'public' as LibraryVisibility, courseIds: [] as string[] }

export function AdminLibraryPage({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth()
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    setBooks(await listAdminLibraryBooks())
  }
  useEffect(() => {
    void Promise.all([refresh(), listAdminCourses()]).then(([, adminCourses]) => setCourses(adminCourses.filter(course => course.status === 'published'))).catch(err => { console.error(err); setError('Impossible de charger la librairie.') })
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr')
    return books.filter(book => !term || [book.title, book.author, book.category, book.description, ...book.keywords].join(' ').toLocaleLowerCase('fr').includes(term))
  }, [books, search])

  function resetForm() { setForm(emptyForm); setEditingId(null); setPdfFile(null); setCoverFile(null); if (pdfInput.current) pdfInput.current.value = ''; if (coverInput.current) coverInput.current.value = '' }
  function edit(book: LibraryBook) { setEditingId(book.id); setForm({ title: book.title, author: book.author, description: book.description, category: book.category, type: book.type, resourceUrl: book.resourceUrl, coverUrl: book.coverUrl, keywords: book.keywords.join(', '), visibility: book.visibility, courseIds: book.courseIds ?? (book.courseId ? [book.courseId] : []) }); setPdfFile(null); setCoverFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function uploadResource(file: File, path: string) {
    const storage = getFirebaseStorage()
    const target = ref(storage, path)
    await uploadBytes(target, file, { contentType: file.type, cacheControl: 'private,max-age=3600' })
    return path
  }

  async function uploadCover(file: File, path: string) {
    const storage = getFirebaseStorage()
    const target = ref(storage, path)
    await uploadBytes(target, file, { contentType: file.type, cacheControl: 'private,max-age=3600' })
    return getDownloadURL(target)
  }

  async function save(status: 'draft' | 'published' = 'draft') {
    setError(''); setMessage('')
    if (!user) return
    if (!form.title.trim()) { setError('Le titre du livre est obligatoire.'); return }
    if (form.type === 'link' && !form.resourceUrl.trim()) { setError('Ajoutez le lien du livre.'); return }
    if (form.type === 'pdf' && !editingId && !pdfFile) { setError('Sélectionnez le fichier PDF du livre.'); return }
    if (form.visibility === 'enrolled' && !form.courseIds.length) { setError('Sélectionnez au moins un concours qui donne accès à cette ressource.'); return }
    setSaving(true)
    try {
      let id = editingId
      if (!id) id = await createLibraryBook({ title: form.title, author: form.author, description: form.description, category: form.category, type: form.type, coverUrl: '', resourceUrl: form.type === 'link' ? form.resourceUrl : '', keywords: form.keywords.split(',').map(x => x.trim()).filter(Boolean), visibility: form.visibility, courseIds: form.visibility === 'enrolled' ? form.courseIds : undefined, userId: user.uid })
      let resourceUrl = form.resourceUrl.trim()
      let coverUrl = form.coverUrl.trim()
      if (form.type === 'pdf' && pdfFile && id) resourceUrl = await uploadResource(pdfFile, `library/${id}/resource`)
      if (coverFile && id) coverUrl = await uploadCover(coverFile, `library/${id}/cover`)
      await updateLibraryBook(id, { title: form.title, author: form.author, description: form.description, category: form.category || 'Général', type: form.type, resourceUrl, coverUrl, keywords: form.keywords.split(',').map(x => x.trim()).filter(Boolean), visibility: form.visibility, ...(form.visibility === 'enrolled' ? { courseIds: form.courseIds } : {}), status })
      await refresh()
      setMessage(status === 'published' ? 'Livre publié dans la librairie.' : 'Brouillon enregistré.')
      resetForm()
    } catch (err) { console.error(err); setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le livre.') } finally { setSaving(false) }
  }

  async function togglePublish(book: LibraryBook) { setError(''); setMessage(''); try { await updateLibraryBook(book.id, { status: book.status === 'published' ? 'draft' : 'published', visibility: book.visibility, ...(book.visibility === 'enrolled' ? { courseIds: book.courseIds ?? (book.courseId ? [book.courseId] : []) } : {}) }); await refresh(); setMessage(book.status === 'published' ? 'Livre retiré de la librairie.' : 'Livre publié dans la librairie.') } catch (err) { setError(err instanceof Error ? err.message : 'Action impossible.') } }
  async function remove(book: LibraryBook) { if (!(await confirmAction({ title: 'Supprimer ce livre ?', description: <>Le livre <strong>« {book.title} »</strong> sera supprimé définitivement.</> }))) return; setError(''); try { await deleteLibraryBook(book); await refresh(); if (editingId === book.id) resetForm(); setMessage('Livre supprimé.') } catch (err) { setError(err instanceof Error ? err.message : 'Suppression impossible.') } }

  return <Container className="page-container admin-library-page">
    <div className="page-title library-admin-title"><div><button className="back" onClick={onBack}>← Retour</button><div className="eyebrow">RESSOURCES</div><h1>Librairie</h1><p>Ajoutez une fois les ressources de référence et rendez-les disponibles aux étudiants connectés.</p></div><div className="library-admin-count"><strong>{books.length}</strong><span>ressources</span></div></div>
    {message && <div className="library-alert success" role="status">✓ {message}</div>}{error && <div className="library-alert" role="alert">{error}</div>}
    <div className="library-admin-layout">
      <Card className="library-form-card"><div className="library-form-head"><div><span className="eyebrow">{editingId ? 'MODIFIER' : 'NOUVELLE RESSOURCE'}</span><h2>{editingId ? 'Modifier le livre' : 'Ajouter un livre'}</h2><p>PDF hébergé par CAV ou lien vers un site externe.</p></div>{editingId && <button className="ui-button ui-button-secondary" onClick={resetForm}>Annuler</button>}</div>
        <div className="library-type-switch"><button className={form.type === 'pdf' ? 'selected' : ''} onClick={() => setForm(f => ({ ...f, type: 'pdf' }))}>📄 PDF CAV<span>Ouverture directe dans un nouvel onglet</span></button><button className={form.type === 'link' ? 'selected' : ''} onClick={() => setForm(f => ({ ...f, type: 'link' }))}>🔗 Lien externe<span>Vers le site officiel du livre</span></button></div>
        <div className="library-form-grid"><label>Titre *<input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex. Culture générale pour les concours" /></label><label>Auteur<input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Nom de l'auteur" /></label><label>Catégorie<select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option>Culture générale</option><option>Français</option><option>Mathématiques</option><option>Droit</option><option>Administration</option><option>Concours</option><option>Autre</option></select></label><label>Mots-clés<input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="police, concours, droit..." /></label></div>
        <div className="library-access-box">
          <label>Qui peut voir cette ressource ?
            <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value as LibraryVisibility, courseIds: e.target.value === 'public' ? [] : f.courseIds }))}>
              <option value="public">Tous les étudiants actifs</option>
              <option value="enrolled">Uniquement les étudiants inscrits à un ou plusieurs concours</option>
            </select>
          </label>
          {form.visibility === 'enrolled' && <div className="library-course-picker">
            <div className="library-course-picker-head"><strong>Concours autorisés *</strong><span>{form.courseIds.length} sélectionné{form.courseIds.length > 1 ? 's' : ''}</span></div>
            <div className="library-course-options">
              {courses.map(course => {
                const selected = form.courseIds.includes(course.id)
                return <label className={`library-course-option${selected ? ' selected' : ''}`} key={course.id}>
                  <input type="checkbox" checked={selected} onChange={() => setForm(f => ({ ...f, courseIds: selected ? f.courseIds.filter(id => id !== course.id) : [...f.courseIds, course.id] }))} />
                  <span className="library-course-check">{selected ? '✓' : ''}</span><span>{course.title}</span>
                </label>
              })}
            </div>
          </div>}
          <p>Une ressource restreinte n'apparaît que pour les étudiants ayant un accès actif et non expiré à au moins un des concours sélectionnés.</p>
        </div>
        <label>Description<textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Une courte description pour aider l'étudiant à choisir cette ressource." /></label>
        {form.type === 'pdf' ? <div className="library-upload-box"><input ref={pdfInput} type="file" accept="application/pdf,.pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} /><strong>{pdfFile ? pdfFile.name : editingId ? 'Remplacer le PDF (facultatif)' : 'Choisir le PDF'}</strong><span>PDF uniquement · la ressource sera protégée par l’authentification CAV.</span></div> : <label>Lien du livre *<input type="url" value={form.resourceUrl} onChange={e => setForm(f => ({ ...f, resourceUrl: e.target.value }))} placeholder="https://..." /></label>}
        <div className="library-cover-upload"><div>{form.coverUrl ? <img src={form.coverUrl} alt="Couverture actuelle" /> : <div className="library-cover-mini">📚</div>}</div><div><strong>Couverture</strong><p>JPG, PNG ou WebP. Une couverture rend la librairie plus agréable.</p><input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} /></div></div>
        <div className="library-form-actions"><button className="ui-button ui-button-secondary" onClick={() => save('draft')} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button><button className="ui-button ui-button-primary" onClick={() => save('published')} disabled={saving}>{saving ? 'Publication…' : 'Publier dans la librairie'}</button></div>
      </Card>

      <section className="library-admin-list"><div className="library-list-head"><div><span className="eyebrow">CATALOGUE</span><h2>Ressources</h2></div><div className="library-admin-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." /></div></div>
        {filtered.length === 0 ? <Card className="library-empty"><h3>Aucune ressource</h3><p>Ajoutez votre premier livre ou lien.</p></Card> : <div className="library-admin-books">{filtered.map(book => <Card className="library-admin-row" key={book.id}><div className="library-admin-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>📚</span>}</div><div className="library-admin-info"><div><span className={`status-pill ${book.status === 'published' ? 'status-published' : 'status-draft'}`}>{book.status === 'published' ? 'Publié' : 'Brouillon'}</span><span className="library-row-type">{book.type === 'pdf' ? 'PDF' : 'Lien'}</span></div><h3>{book.title}</h3><p>{book.author || 'Auteur non renseigné'} · {book.category} · {book.visibility === 'enrolled' ? `Accès : ${(book.courseIds ?? (book.courseId ? [book.courseId] : [])).map(id => courses.find(course => course.id === id)?.title).filter(Boolean).join(', ') || 'concours sélectionnés'}` : 'Accès : tous les étudiants'}</p></div><div className="library-admin-actions"><button onClick={() => edit(book)}>Modifier</button><button onClick={() => void togglePublish(book)}>{book.status === 'published' ? 'Dépublier' : 'Publier'}</button><button className="danger" onClick={() => void remove(book)}>Supprimer</button></div></Card>)}</div>}
      </section>
    </div>
  </Container>
}
