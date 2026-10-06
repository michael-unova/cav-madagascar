import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { createCourse, listAdminCourses, updateCourse } from '../features/admin/adminRepository'
import { getFirebaseStorage } from '../lib/firebase/storage'
import type { Course } from '../types/course'

export function AdminCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [removeThumbnail, setRemoveThumbnail] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() { setCourses(await listAdminCourses()) }
  useEffect(() => { void refresh() }, [])

  function reset() {
    setEditingId(null)
    setTitle('')
    setSlug('')
    setDescription('')
    setPrice('0')
    setThumbnailUrl('')
    setThumbnailFile(null)
    setThumbnailPreview('')
    setRemoveThumbnail(false)
  }

  function edit(course: Course) {
    setEditingId(course.id)
    setTitle(course.title)
    setSlug(course.slug)
    setDescription(course.description)
    setPrice(String(course.price))
    setThumbnailUrl(course.thumbnailUrl ?? '')
    setThumbnailFile(null)
    setThumbnailPreview(course.thumbnailUrl ?? '')
    setRemoveThumbnail(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadCourseThumbnail(courseId: string, file: File) {
    if (!file.type.startsWith('image/')) throw new Error('Le fichier doit être une image.')
    if (file.size > 5 * 1024 * 1024) throw new Error('L’image ne doit pas dépasser 5 Mo.')
    const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
    const target = storageRef(getFirebaseStorage(), `courses/${courseId}/thumbnails/thumbnail.${extension}`)
    await uploadBytes(target, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' })
    return getDownloadURL(target)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!user || !title.trim() || !slug.trim()) {
      setError('Le titre et le slug sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      const payload = { title, slug, description, price: Number(price) || 0 }
      if (editingId) {
        let nextThumbnail = thumbnailUrl
        if (removeThumbnail) nextThumbnail = ''
        if (thumbnailFile) nextThumbnail = await uploadCourseThumbnail(editingId, thumbnailFile)
        await updateCourse(editingId, { ...payload, thumbnailUrl: nextThumbnail || null }, user.uid)
      } else {
        const courseId = await createCourse({ ...payload, userId: user.uid })
        if (thumbnailFile) {
          const uploadedUrl = await uploadCourseThumbnail(courseId, thumbnailFile)
          await updateCourse(courseId, { thumbnailUrl: uploadedUrl }, user.uid)
        }
      }
      reset()
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le concours.')
    } finally {
      setSaving(false)
    }
  }

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Administration</p><h1>Concours</h1><p className="page-description">Créez et gérez les préparations disponibles sur CAV Madagascar.</p></div></div>
    <Card className="admin-form-card">
      <h2>{editingId ? 'Modifier le concours' : 'Créer un concours'}</h2>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form className="auth-form admin-form-grid" onSubmit={handleSave}>
        <label>Titre<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Inspecteur de police" /></label>
        <label>Slug<input value={slug} onChange={e => setSlug(e.target.value)} placeholder="inspecteur-police" /></label>
        <label>Prix (MGA)<input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label className="admin-form-full">Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} /></label>
        <div className="admin-form-full concours-image-field">
          <div><strong>Image du concours <span className="form-optional">facultatif</span></strong><p className="page-description">L’image sera utilisée sur les cartes du concours. Sans image, CAV affiche automatiquement son visuel neutre.</p></div>
          {thumbnailPreview ? <div className="concours-image-preview"><img src={thumbnailPreview} alt="Aperçu du concours" /><div><span>{thumbnailFile ? 'Nouvelle image sélectionnée' : 'Image actuelle'}</span><button type="button" className="ui-button ui-button-secondary" onClick={() => { setThumbnailFile(null); setThumbnailPreview(''); setThumbnailUrl(''); setRemoveThumbnail(true) }}>Supprimer l’image</button></div></div> : <label className="concours-image-drop"><input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0] ?? null; if (!file) return; setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file)); setRemoveThumbnail(false) }} /><span>Ajouter une image</span><small>JPG, PNG ou WebP · 5 Mo maximum</small></label>}
        </div>
        <div className="admin-list-actions"><button className="ui-button ui-button-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer en brouillon'}</button>{editingId && <button type="button" className="ui-button ui-button-secondary" onClick={reset}>Annuler</button>}</div>
      </form>
    </Card>
    <section className="admin-list-section"><h2>Concours existants</h2><div className="admin-list">{courses.map(course => <Card key={course.id} className="admin-list-row"><div><strong>{course.title}</strong><span>{course.slug} · {course.price.toLocaleString('fr-FR')} MGA</span></div><div className="admin-list-actions"><span className={`status-pill status-${course.status}`}>{course.status}</span><button className="ui-button ui-button-secondary" onClick={() => edit(course)}>Modifier</button>{course.status === 'draft' ? <button className="ui-button ui-button-secondary" onClick={() => user && void updateCourse(course.id, { status: 'published' }, user.uid).then(refresh)}>Publier</button> : <button className="ui-button ui-button-secondary" onClick={() => user && void updateCourse(course.id, { status: 'draft' }, user.uid).then(refresh)}>Dépublier</button>}</div></Card>)}</div></section>
  </Container>
}
