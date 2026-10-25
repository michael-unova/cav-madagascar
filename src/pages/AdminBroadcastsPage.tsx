import { useEffect, useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { getFirebaseFunctions } from '../lib/firebase/functions'
import { useAuth } from '../features/auth'

const categories = [
  { value: 'bienvenue', label: 'Bienvenue' },
  { value: 'actualite', label: 'Actualité' },
  { value: 'annonce', label: 'Annonce' },
  { value: 'rappel', label: 'Rappel' },
  { value: 'evenement', label: 'Événement' },
  { value: 'maintenance', label: 'Maintenance' },
] as const

type Broadcast = {
  id: string
  title: string
  message: string
  category: string
  status: 'draft' | 'scheduled' | 'sent' | 'sending' | 'failed'
  sendAt?: string
  createdAt?: string
  recipientCount?: number
  createdByName?: string
  audienceType?: 'all' | 'course' | 'student'
  targetCourseId?: string
  targetUserId?: string
  skippedCount?: number
  createdByUid?: string
}

type TargetStudent = { id: string; displayName: string; email: string; createdAt?: string; courseIds: string[] }
type RecipientSort = 'alpha' | 'course' | 'registration_asc' | 'registration_desc'

type BroadcastReader = {
  userId: string
  recipientName: string
  read: boolean
  readAt?: string
}

type BroadcastReadStatus = {
  broadcastId: string
  recipientCount: number
  readCount: number
  unreadCount: number
  readers: BroadcastReader[]
}

function categoryLabel(value?: string) {
  return categories.find(item => item.value === value)?.label ?? 'Annonce'
}

function formatShortDate(value?: string) {
  if (!value) return 'Date inconnue'
  return new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'medium' })
}

function formatDate(value?: string) {
  if (!value) return 'À l’instant'
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AdminBroadcastsPage() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('annonce')
  const [audienceType, setAudienceType] = useState<'all' | 'course' | 'student'>('all')
  const [targetCourseId, setTargetCourseId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetCourses, setTargetCourses] = useState<Array<{ id: string; title: string }>>([])
  const [targetStudents, setTargetStudents] = useState<TargetStudent[]>([])
  const [receivedIds, setReceivedIds] = useState<Set<string>>(new Set())
  const [dedupMode, setDedupMode] = useState<'type' | 'content'>('content')
  const [skipAlreadyReceived, setSkipAlreadyReceived] = useState(true)
  const [recipientSort, setRecipientSort] = useState<RecipientSort>('registration_desc')
  const [historyType, setHistoryType] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [mode, setMode] = useState<'now' | 'schedule'>('now')
  const [sendAt, setSendAt] = useState('')
  const [items, setItems] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [readStatus, setReadStatus] = useState<BroadcastReadStatus | null>(null)
  const [readStatusLoading, setReadStatusLoading] = useState(false)

  async function loadTargets() {
    try {
      const fn = httpsCallable<{}, { courses: Array<{ id: string; title: string }>; students: TargetStudent[] }>(getFirebaseFunctions(), 'adminListBroadcastTargets')
      const result = await fn({})
      setTargetCourses(result.data.courses)
      setTargetStudents(result.data.students)
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les destinataires.')
    }
  }

  async function loadHistory() {
    setLoading(true)
    try {
      const fn = httpsCallable<{}, { items: Broadcast[] }>(getFirebaseFunctions(), 'adminListBroadcasts')
      const result = await fn({})
      setItems(result.data.items)
    } catch (err) {
      console.error(err)
      setError('Impossible de charger l’historique des annonces.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void Promise.all([loadHistory(), loadTargets()]) }, [])

  // Which students already received this message (same type for one-time types, same text otherwise).
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const fn = httpsCallable<{ category: string; title: string; message: string }, { mode: 'type' | 'content'; receivedUserIds: string[] }>(getFirebaseFunctions(), 'adminGetBroadcastRecipientStatus')
        const result = await fn({ category, title: title.trim(), message: message.trim() })
        setReceivedIds(new Set(result.data.receivedUserIds))
        setDedupMode(result.data.mode)
      } catch (err) {
        console.error(err)
        setReceivedIds(new Set())
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [category, title, message, success])

  const courseTitleById = useMemo(() => new Map(targetCourses.map(course => [course.id, course.title])), [targetCourses])

  const recipients = useMemo(() => {
    let list = targetStudents
    if (audienceType === 'course') list = targetStudents.filter(student => student.courseIds.includes(targetCourseId))
    else if (audienceType === 'student') list = targetStudents.filter(student => student.id === targetUserId)
    const courseLabel = (student: TargetStudent) => student.courseIds.map(id => courseTitleById.get(id) ?? '').filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr')).join(', ')
    const time = (student: TargetStudent) => student.createdAt ? new Date(student.createdAt).getTime() : 0
    const byName = (a: TargetStudent, b: TargetStudent) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })
    return list.map(student => ({ ...student, courseLabel: courseLabel(student) })).sort((a, b) => {
      if (recipientSort === 'registration_asc') return time(a) - time(b) || byName(a, b)
      if (recipientSort === 'registration_desc') return time(b) - time(a) || byName(a, b)
      if (recipientSort === 'course') {
        if (!a.courseLabel && b.courseLabel) return 1
        if (a.courseLabel && !b.courseLabel) return -1
        return a.courseLabel.localeCompare(b.courseLabel, 'fr') || byName(a, b)
      }
      return byName(a, b)
    })
  }, [targetStudents, audienceType, targetCourseId, targetUserId, recipientSort, courseTitleById])

  const alreadyReceivedCount = recipients.filter(student => receivedIds.has(student.id)).length
  const newRecipientCount = recipients.length - alreadyReceivedCount
  const visibleHistory = items.filter(item => (historyType === 'all' || item.category === historyType) && (!onlyMine || item.createdByUid === user?.uid))
  const sentTypes = [...new Set(items.map(item => item.category))]

  async function openReadStatus(item: Broadcast) {
    setError('')
    setReadStatusLoading(true)
    try {
      const fn = httpsCallable<{ broadcastId: string }, BroadcastReadStatus>(getFirebaseFunctions(), 'adminGetBroadcastReadStatus')
      const result = await fn({ broadcastId: item.id })
      setReadStatus(result.data)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible de charger les lectures de cette annonce.')
    } finally {
      setReadStatusLoading(false)
    }
  }

  async function submit() {
    setError('')
    setSuccess('')
    if (!title.trim() || !message.trim()) { setError('Veuillez renseigner le titre et le message.'); return }
    if (audienceType === 'course' && !targetCourseId) { setError('Choisissez le concours destinataire.'); return }
    if (audienceType === 'student' && !targetUserId) { setError('Choisissez l’étudiant destinataire.'); return }
    if (mode === 'schedule' && !sendAt) { setError('Choisissez une date et une heure.'); return }
    const date = mode === 'schedule' ? new Date(sendAt) : new Date()
    if (Number.isNaN(date.getTime()) || (mode === 'schedule' && date.getTime() <= Date.now())) { setError('La date programmée doit être dans le futur.'); return }
    setSending(true)
    try {
      const fn = httpsCallable<{ title: string; message: string; category: string; audienceType: 'all' | 'course' | 'student'; targetCourseId?: string; targetUserId?: string; sendAt?: string; skipAlreadyReceived: boolean }, { success: boolean; status: string; recipientCount?: number; skippedCount?: number }>(getFirebaseFunctions(), 'adminSendBroadcast')
      const result = await fn({ title: title.trim(), message: message.trim(), category, audienceType, targetCourseId: audienceType === 'course' ? targetCourseId : undefined, targetUserId: audienceType === 'student' ? targetUserId : undefined, sendAt: mode === 'schedule' ? date.toISOString() : undefined, skipAlreadyReceived })
      setTitle(''); setMessage(''); setSendAt(''); setMode('now'); setAudienceType('all'); setTargetCourseId(''); setTargetUserId('')
      setSuccess(result.data.status === 'scheduled' ? 'Annonce programmée avec succès.' : `Annonce envoyée à ${result.data.recipientCount ?? 0} étudiant(s)${result.data.skippedCount ? `, ${result.data.skippedCount} ignoré(s) car déjà reçue` : ''}.`)
      await loadHistory()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Impossible d’envoyer l’annonce.')
    } finally { setSending(false) }
  }

  return <Container className="page-container">
    <div className="page-header"><div><p className="eyebrow">Communication officielle</p><h1>Annonces CAV</h1><p className="page-description">Informez les étudiants depuis un canal officiel CAV Madagascar.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {success && <div className="form-success" role="status">✓ {success}</div>}
    <div className="broadcast-layout">
      <Card className="broadcast-compose-card">
        <div className="broadcast-card-head"><div><p className="eyebrow">NOUVELLE ANNONCE</p><h2>Communiquer avec les étudiants</h2></div><span className="broadcast-sender">CAV Madagascar</span></div>
        <label>Titre<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Ouverture des inscriptions" maxLength={120} /></label>
        <label>Catégorie<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Destinataires<select value={audienceType} onChange={e => { setAudienceType(e.target.value as 'all' | 'course' | 'student'); setTargetCourseId(''); setTargetUserId('') }}><option value="all">Tous les étudiants</option><option value="course">Un concours</option><option value="student">Un étudiant</option></select></label>
        {audienceType === 'course' && <label>Concours<select value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)}><option value="">Choisir un concours…</option>{targetCourses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>}
        {audienceType === 'student' && <label>Étudiant<select value={targetUserId} onChange={e => setTargetUserId(e.target.value)}><option value="">Choisir un étudiant…</option>{targetStudents.map(student => <option key={student.id} value={student.id}>{student.displayName} · {student.email}</option>)}</select></label>}
        <label>Message<textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Écrivez votre annonce…" maxLength={2000} rows={7} /></label>
        <div className="broadcast-recipients">
          <div className="broadcast-recipients-head">
            <div><strong>Destinataires ({recipients.length})</strong><small>{newRecipientCount} nouveau(x) · {alreadyReceivedCount} ont déjà reçu {dedupMode === 'type' ? `une annonce de type « ${categoryLabel(category)} »` : 'ce message'}</small></div>
            <label className="broadcast-recipients-sort">Trier par<select value={recipientSort} onChange={e => setRecipientSort(e.target.value as RecipientSort)}><option value="registration_desc">Inscription : plus récents</option><option value="registration_asc">Inscription : plus anciens</option><option value="alpha">Ordre alphabétique</option><option value="course">Par concours</option></select></label>
          </div>
          <label className="broadcast-skip-option"><input type="checkbox" checked={skipAlreadyReceived} onChange={e => setSkipAlreadyReceived(e.target.checked)} /><span>Ne pas renvoyer aux étudiants qui l’ont déjà reçue</span></label>
          {recipients.length === 0 ? <p className="broadcast-recipients-empty">Aucun destinataire pour cette sélection.</p> : <div className="broadcast-recipient-list">{recipients.map(student => { const received = receivedIds.has(student.id); return <div className="broadcast-recipient-row" key={student.id}><div><strong>{student.displayName}</strong><small>Inscrit le {formatShortDate(student.createdAt)}{student.courseLabel ? ` · ${student.courseLabel}` : ''}</small></div><span className={received ? (skipAlreadyReceived ? 'broadcast-received broadcast-received-skip' : 'broadcast-received') : 'broadcast-new'}>{received ? (skipAlreadyReceived ? 'Déjà reçu, ignoré' : 'Déjà reçu') : 'Nouveau'}</span></div> })}</div>}
        </div>
        <div className="broadcast-delivery"><button type="button" className={mode === 'now' ? 'is-active' : ''} onClick={() => setMode('now')}>Envoyer maintenant</button><button type="button" className={mode === 'schedule' ? 'is-active' : ''} onClick={() => setMode('schedule')}>Programmer</button></div>
        {mode === 'schedule' && <label>Date et heure<input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} /></label>}
        <div className="broadcast-compose-footer"><div><strong>Expéditeur</strong><span>CAV Madagascar</span></div><button className="primary" type="button" disabled={sending} onClick={() => void submit()}>{sending ? 'Envoi…' : mode === 'schedule' ? 'Programmer l’annonce' : 'Envoyer l’annonce'} <span>→</span></button></div>
      </Card>
      <Card className="broadcast-preview-card"><p className="eyebrow">APERÇU ÉTUDIANT</p><div className="broadcast-notification-preview"><div className="broadcast-preview-icon">CAV</div><div><small>CAV Madagascar · {categories.find(item => item.value === category)?.label}</small><h3>{title.trim() || 'Titre de votre annonce'}</h3><p>{message.trim() || 'Votre message apparaîtra ici avec l’identité officielle de CAV Madagascar.'}</p><span>🔔 Notification CAV</span></div></div></Card>
    </div>
    <Card className="broadcast-history-card"><div className="broadcast-card-head"><div><p className="eyebrow">HISTORIQUE</p><h2>Annonces envoyées et programmées</h2></div><div className="broadcast-history-filters"><select aria-label="Filtrer par type" value={historyType} onChange={e => setHistoryType(e.target.value)}><option value="all">Tous les types</option>{sentTypes.map(type => <option key={type} value={type}>{categoryLabel(type)}</option>)}</select><label className="broadcast-skip-option"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /><span>Mes envois uniquement</span></label></div></div>{loading ? <p>Chargement…</p> : visibleHistory.length === 0 ? <div className="catalogue-empty"><p>Aucune annonce pour le moment.</p></div> : <div className="broadcast-history-list">{visibleHistory.map(item => <div className="broadcast-history-row" key={item.id}><div><strong>{item.title} <span className="broadcast-type-badge">{categoryLabel(item.category)}</span></strong><p>{item.message}</p><small>{item.status === 'scheduled' ? `Programmée pour ${formatDate(item.sendAt)}` : `Envoyée ${formatDate(item.createdAt)}`} · {item.audienceType === 'course' ? 'Concours ciblé' : item.audienceType === 'student' ? 'Étudiant ciblé' : 'Tous les étudiants'}{item.createdByName ? ` · par ${item.createdByName}` : ''}{item.skippedCount ? ` · ${item.skippedCount} ignoré(s) (déjà reçu)` : ''}</small></div><div className="broadcast-history-actions"><div className={`broadcast-status broadcast-status-${item.status}`}>{item.status === 'scheduled' ? 'Programmée' : item.status === 'sent' ? `Envoyée · ${item.recipientCount ?? 0}` : item.status}</div>{item.status === 'sent' && <button type="button" className="ui-button ui-button-secondary broadcast-read-button" disabled={readStatusLoading} onClick={() => void openReadStatus(item)}>{readStatusLoading ? 'Chargement…' : 'Voir les lectures'}</button>}</div></div>)}</div>}</Card>
    {readStatus && <div className="broadcast-detail-backdrop" role="presentation" onClick={() => setReadStatus(null)}><div className="broadcast-read-modal" role="dialog" aria-modal="true" aria-labelledby="broadcast-read-title" onClick={event => event.stopPropagation()}><div className="broadcast-detail-brand"><div className="broadcast-preview-icon">✓</div><div><strong>Suivi de lecture</strong><small>{readStatus.readCount} lu(s) sur {readStatus.recipientCount} destinataire(s)</small></div><button type="button" className="link-button" onClick={() => setReadStatus(null)}>Fermer</button></div><h2 id="broadcast-read-title">Étudiants ayant lu l’annonce</h2><div className="broadcast-read-summary"><span><strong>{readStatus.readCount}</strong> lus</span><span><strong>{readStatus.unreadCount}</strong> non lus</span><span><strong>{readStatus.recipientCount}</strong> destinataires</span></div>{readStatus.readers.length === 0 ? <div className="catalogue-empty"><p>Aucun étudiant n’a encore ouvert cette annonce.</p></div> : <div className="broadcast-reader-list">{readStatus.readers.map(reader => <div className="broadcast-reader-row" key={reader.userId}><div className="avatar">{reader.recipientName.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]?.toUpperCase()).join('') || 'É'}</div><div><strong>{reader.recipientName}</strong><small>Lu {reader.readAt ? formatDate(reader.readAt) : 'à l’instant'}</small></div><span className="broadcast-read-check">✓ Lu</span></div>)}</div>}</div></div>}
  </Container>
}
