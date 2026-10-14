import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { RichLessonEditor, sanitizeLessonHtml } from '../components/RichLessonEditor'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listAdminSubjects } from '../features/admin/adminRepository'
import { createSharedContentBlock, createSharedContentNode, deleteContentBlock, deleteContentNode, listContentBlocks, listSubjectContentNodes, updateContentBlock, updateContentNode } from '../features/curriculum'
import { listCourseSubjectsBySubjectId } from '../features/curriculum'
import type { Subject } from '../types/subject'
import type { ContentNode, ContentBlock, ContentBlockType } from '../types/content'
import type { CourseSubject } from '../types/course'
import { confirmAction } from '../components/ConfirmDialog'

export function AdminContentPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [searchParams] = useSearchParams()
  const [subjectId, setSubjectId] = useState('')
  const [associations, setAssociations] = useState<CourseSubject[]>([])
  const [nodes, setNodes] = useState<ContentNode[]>([])
  const [nodeId, setNodeId] = useState('')
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [blockType, setBlockType] = useState<ContentBlockType>('text')
  const [blockText, setBlockText] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refreshNodes(id = subjectId) {
    if (!id) { setNodes([]); return }
    setNodes(await listSubjectContentNodes(id, false))
  }

  async function refreshBlocks(id = nodeId) {
    if (!id) { setBlocks([]); return }
    setBlocks(await listContentBlocks(id, false))
  }

  useEffect(() => { void listAdminSubjects().then(items => { setSubjects(items); const requested = searchParams.get('subject'); if (requested && items.some(item => item.id === requested)) setSubjectId(requested) }) }, [searchParams])
  useEffect(() => {
    if (!subjectId) { setAssociations([]); setNodes([]); setNodeId(''); return }
    void Promise.all([refreshNodes(subjectId), listCourseSubjectsBySubjectId(subjectId)]).then(([, items]) => setAssociations(items))
  }, [subjectId])
  useEffect(() => { void refreshBlocks() }, [nodeId])

  const selectedNode = useMemo(() => nodes.find(node => node.id === nodeId), [nodes, nodeId])
  const rootNodes = useMemo(() => nodes.filter(node => !node.parentId), [nodes])
  const childNodes = useMemo(() => nodes.filter(node => node.parentId === nodeId), [nodes, nodeId])

  function resetNodeForm() {
    setEditingNodeId(null); setTitle(''); setDescription(''); setParentId('')
  }

  function resetBlockForm() {
    setEditingBlockId(null); setBlockText(''); setMediaUrl(''); setBlockType('text')
  }

  async function saveNode(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!user || !subjectId || !title.trim()) { setError('La matière et le titre sont obligatoires.'); return }
    try {
      if (editingNodeId) {
        await updateContentNode(editingNodeId, { title: title.trim(), description: description.trim(), type: parentId ? 'chapter' : 'topic', parentId: parentId || undefined }, user.uid)
        setMessage('Élément modifié.')
      } else {
        const parent = parentId ? nodes.find(item => item.id === parentId) : undefined
        const result = await createSharedContentNode({ subjectId, parentSharedKey: parent?.sharedKey, type: parentId ? 'chapter' : 'topic', title: title.trim(), description: description.trim(), order: nodes.length, userId: user.uid })
        setNodeId(result.nodeIds[0] ?? '')
        setMessage('Élément créé en brouillon. Vous pouvez maintenant ajouter son contenu.')
      }
      resetNodeForm(); await refreshNodes()
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible d’enregistrer l’élément.') }
  }

  async function saveBlock(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!user || !selectedNode) { setError('Sélectionnez un chapitre.'); return }
    try {
      const content = blockType === 'text' ? { html: sanitizeLessonHtml(blockText) } : { html: blockText.trim() }
      const media = ['video', 'image', 'file'].includes(blockType) && mediaUrl.trim() ? { url: mediaUrl.trim() } : undefined
      if (editingBlockId) await updateContentBlock(editingBlockId, { type: blockType, content, ...(media ? { media } : {}) }, user.uid)
      else await createSharedContentBlock({ nodeSharedKey: selectedNode.sharedKey ?? '', type: blockType, order: blocks.length, content, ...(media ? { media } : {}), userId: user.uid })
      resetBlockForm(); await refreshBlocks(); setMessage('Contenu enregistré en brouillon.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le contenu.') }
  }

  function editNode(node: ContentNode) {
    setEditingNodeId(node.id); setTitle(node.title); setDescription(node.description ?? ''); setParentId(node.parentId ?? '')
  }

  function editBlock(block: ContentBlock) {
    setEditingBlockId(block.id); setBlockType(block.type); setBlockText(String(block.content.html ?? block.content.text ?? '')); setMediaUrl(String(block.media?.url ?? '')); setPreview(false)
  }

  async function publishNode() {
    if (!user || !selectedNode) return
    try {
      await updateContentNode(selectedNode.id, { status: 'published' }, user.uid)
      await Promise.all(blocks.map(block => updateContentBlock(block.id, { status: 'published' }, user.uid)))
      await refreshNodes(); await refreshBlocks(); setMessage('Chapitre publié avec son contenu.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de publier le chapitre.') }
  }

  async function unpublishNode() {
    if (!user || !selectedNode) return
    try {
      await updateContentNode(selectedNode.id, { status: 'draft' }, user.uid)
      await Promise.all(blocks.map(block => updateContentBlock(block.id, { status: 'draft' }, user.uid)))
      await refreshNodes(); await refreshBlocks(); setMessage('Chapitre dépublié.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de dépublier le chapitre.') }
  }

  async function deleteNode(node: ContentNode) {
    if (!(await confirmAction({ title: 'Supprimer cet élément ?', description: <><strong>« {node.title} »</strong> et tout son contenu seront supprimés définitivement.</> }))) return
    try { await deleteContentNode(node.id); if (nodeId === node.id) { setNodeId(''); setBlocks([]) }; await refreshNodes(); setMessage('Élément supprimé.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Impossible de supprimer l’élément.') }
  }

  async function deleteBlock(block: ContentBlock) {
    if (!(await confirmAction({ title: 'Supprimer ce contenu ?', description: 'Ce contenu sera supprimé définitivement.' }))) return
    try { await deleteContentBlock(block.id); await refreshBlocks(); setMessage('Contenu supprimé.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Impossible de supprimer le contenu.') }
  }

  return <Container className="page-container">
    <Link className="back-link" to="/admin">← Tableau de bord</Link>
    <div className="page-header"><div><p className="eyebrow">Éditeur pédagogique</p><h1>Contenus & leçons</h1><p className="page-description">Choisissez une Matière pour gérer son contenu partagé dans tous les concours qui l’utilisent.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="form-success">{message}</div>}

    <Card className="admin-form-card">
      <h2>1. Choisir une Matière</h2>
      <div className="admin-form-grid">
        <label>Matière<select className="admin-select" value={subjectId} onChange={e => { setSubjectId(e.target.value); setNodeId(''); resetNodeForm(); resetBlockForm(); setPreview(false) }}><option value="">Sélectionner une matière...</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        {subjectId && <div><strong>Utilisée dans {associations.length} concours</strong><p className="page-description">{associations.length ? associations.map(item => item.title).join(' · ') : 'Aucun concours pour le moment. Vous pouvez quand même préparer son contenu.'}</p></div>}
      </div>
    </Card>

    {subjectId && <>
      <Card className="admin-form-card">
        <h2>2. Organiser le programme</h2>
        <p className="page-description">Créez un thème, puis ajoutez ses chapitres. Le contenu est ajouté à chaque chapitre.</p>
        <form className="admin-form-grid" onSubmit={saveNode}>
          <label>Titre<input value={title} onChange={e => setTitle(e.target.value)} placeholder={parentId ? "Ex. Divisibilité" : "Ex. Arithmétique dans Z"} /></label>
          <div className="admin-form-help"><strong>{parentId ? 'Chapitre' : 'Thème'}</strong><span>{parentId ? 'Un chapitre est une leçon à l’intérieur du thème sélectionné.' : 'Un thème regroupe plusieurs chapitres / leçons.'}</span></div>
          <label>Élément parent<select className="admin-select" value={parentId} onChange={e => setParentId(e.target.value)}><option value="">Aucun, niveau racine</option>{rootNodes.filter(node => node.id !== editingNodeId).map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <label className="admin-form-full">Description<textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel" /></label>
          <div className="admin-list-actions"><button className="ui-button ui-button-primary">{editingNodeId ? 'Enregistrer' : 'Créer'}</button>{editingNodeId && <button type="button" className="ui-button ui-button-secondary" onClick={resetNodeForm}>Annuler</button>}</div>
        </form>
      </Card>

      <section className="admin-list-section"><h2>Programme</h2><div className="admin-list">{rootNodes.map(node => <Card className="admin-list-row" key={node.id}><div><strong>{node.title}</strong><span>Thème · {nodes.filter(child => child.parentId === node.id).length} chapitre(s)</span></div><div className="admin-list-actions"><span className={`status-pill status-${node.status}`}>{node.status}</span><button className="ui-button ui-button-secondary" onClick={() => { setNodeId(node.id); setPreview(false) }}>Ouvrir</button><button className="ui-button ui-button-secondary" onClick={() => editNode(node)}>Modifier</button><button className="ui-button ui-button-secondary" onClick={() => void deleteNode(node)}>Supprimer</button></div></Card>)}{rootNodes.length === 0 && <Card className="catalogue-empty"><p>Aucun chapitre. Créez votre première structure.</p></Card>}</div></section>

      {selectedNode && <Card className="admin-form-card">
        <div className="page-header compact-header"><div><p className="eyebrow">Édition</p><h2>{selectedNode.title}</h2><p className="page-description">{selectedNode.parentId ? 'Ajoutez le contenu de cette leçon.' : 'Sélectionnez un chapitre pour ajouter son contenu.'}</p></div><div className="admin-list-actions"><button type="button" className="ui-button ui-button-secondary" onClick={() => setPreview(!preview)}>{preview ? 'Revenir à l’édition' : 'Aperçu étudiant'}</button>{selectedNode.status === 'published' ? <button type="button" className="ui-button ui-button-secondary" onClick={() => void unpublishNode()}>Dépublier</button> : <button type="button" className="ui-button ui-button-primary" onClick={() => void publishNode()}>Publier</button>}</div></div>
        {childNodes.length > 0 && <div className="admin-subitems"><strong>Chapitres :</strong> {childNodes.map(child => <button key={child.id} className="ui-button ui-button-secondary" onClick={() => { setNodeId(child.id); setPreview(false) }}>{child.title}</button>)}</div>}

        {preview ? <div className="lesson-student-preview"><p className="eyebrow">APERÇU CÔTÉ ÉTUDIANT</p><h2>{selectedNode.title}</h2>{blocks.length === 0 && <p className="page-description">Aucun contenu pour le moment.</p>}{blocks.map(block => <Card key={block.id} className="learning-block">{block.type === 'video' && block.media?.url ? <video controls width="100%" src={block.media.url} /> : block.type === 'image' && block.media?.url ? <img src={block.media.url} alt="Illustration" style={{ maxWidth: '100%' }} /> : block.type === 'file' && block.media?.url ? <a className="text-link" href={block.media.url} target="_blank" rel="noreferrer">Ouvrir le document</a> : <div className="lesson-preview lesson-editor-surface" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(String(block.content.html ?? block.content.text ?? '')) }} />}</Card>)}</div> : <>
          {selectedNode.parentId ? <>
          <form className="auth-form" onSubmit={saveBlock}>
            <h3>{editingBlockId ? 'Modifier le contenu' : 'Ajouter du contenu'}</h3>
            <label>Type<select className="admin-select" value={blockType} onChange={e => setBlockType(e.target.value as ContentBlockType)}><option value="text">Texte riche / Word</option><option value="video">Vidéo</option><option value="image">Image</option><option value="file">Fichier / document</option></select></label>
            {blockType === 'text' ? <RichLessonEditor value={blockText} onChange={setBlockText} storageFolder={`content-subjects/${subjectId}/${selectedNode.id}`} /> : <label>URL du média<input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." /></label>}
            <div className="admin-list-actions"><button className="ui-button ui-button-primary">{editingBlockId ? 'Enregistrer' : 'Ajouter au chapitre'}</button>{editingBlockId && <button type="button" className="ui-button ui-button-secondary" onClick={resetBlockForm}>Annuler</button>}</div>
          </form>
          <div className="admin-list-section"><h3>Contenu du chapitre</h3><div className="admin-list">{blocks.map((block, index) => <Card className="admin-list-row" key={block.id}><div><strong>{index + 1}. {block.type === 'text' ? 'Texte riche' : block.type}</strong><span>{String(block.content.html ?? block.content.text ?? block.media?.url ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Contenu multimédia'}</span></div><div className="admin-list-actions"><span className={`status-pill status-${block.status}`}>{block.status}</span><button className="ui-button ui-button-secondary" onClick={() => editBlock(block)}>Modifier</button><button className="ui-button ui-button-secondary" onClick={() => void deleteBlock(block)}>Supprimer</button></div></Card>)}{blocks.length === 0 && <Card className="catalogue-empty"><p>Ce chapitre est encore vide. Ajoutez du texte, collez votre document Word ou ajoutez un média.</p></Card>}</div></div>
          </> : <div className="catalogue-empty"><p>Ce thème organise les chapitres. Sélectionnez un chapitre pour ajouter ou modifier son contenu.</p></div>}
        </>}
      </Card>}
    </>}
  </Container>
}
