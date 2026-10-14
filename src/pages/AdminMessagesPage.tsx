import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { deleteContactMessage, listContactMessages, markContactMessageRead, markContactMessageUnread } from '../features/contact'
import type { ContactMessage } from '../types/contact'
import { confirmAction } from '../components/ConfirmDialog'

function formatDate(value: ContactMessage['createdAt']) {
  if (!value) return 'Date en cours d’enregistrement'
  return value.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AdminMessagesPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ContactMessage[]>([])
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try { setItems(await listContactMessages()) } catch (err) { console.error(err); setError('Impossible de charger les messages.') } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  if (profile?.role !== 'super_admin' && profile?.role !== 'content_manager') {
    return <Container className="page-container"><Card><p className="eyebrow">Messages</p><h1>Accès réservé</h1><p>La gestion des messages de contact est réservée aux administrateurs autorisés.</p></Card></Container>
  }

  async function openMessage(item: ContactMessage) {
    setSelected(item)
    if (item.status === 'unread') {
      try {
        await markContactMessageRead(item.id)
        const refreshed = await listContactMessages()
        setItems(refreshed)
        setSelected(refreshed.find(message => message.id === item.id) ?? item)
      } catch (err) { console.error(err); setError('Impossible de marquer ce message comme lu.') }
    }
  }

  async function toggleRead(item: ContactMessage) {
    try {
      if (item.status === 'unread') await markContactMessageRead(item.id)
      else await markContactMessageUnread(item.id)
      await refresh()
      if (selected?.id === item.id) setSelected(current => current ? { ...current, status: item.status === 'unread' ? 'read' : 'unread' } : current)
    } catch (err) { console.error(err); setError('Impossible de modifier le statut du message.') }
  }

  async function remove(item: ContactMessage) {
    if (!(await confirmAction({ title: 'Supprimer ce message ?', description: 'Ce message sera supprimé définitivement.' }))) return
    try {
      await deleteContactMessage(item.id)
      if (selected?.id === item.id) setSelected(null)
      await refresh()
    } catch (err) { console.error(err); setError('Impossible de supprimer ce message.') }
  }

  return <Container className="page-container">
    <div className="page-header"><div><p className="eyebrow">Communication</p><h1>Messages</h1><p className="page-description">Consultez les demandes envoyées depuis le formulaire de contact.</p></div><div className="messages-count"><strong>{items.filter(item => item.status === 'unread').length}</strong><span>non lu(s)</span></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="messages-layout">
      <section className="messages-list">
        {loading ? <Card><p>Chargement des messages...</p></Card> : items.length === 0 ? <Card className="catalogue-empty"><p>Aucun message pour le moment.</p></Card> : items.map(item => <button key={item.id} className={`message-row ${item.status === 'unread' ? 'is-unread' : ''}`} onClick={() => void openMessage(item)}>
          <span className="message-status-dot" aria-hidden="true" />
          <span className="message-row-main"><strong>{item.firstName} {item.lastName}</strong><b>{item.subject}</b><small>{formatDate(item.createdAt)}</small></span>
          <span className="message-row-status">{item.status === 'unread' ? 'Non lu' : 'Lu'}</span>
        </button>)}
      </section>
      <section className="message-detail">
        {selected ? <Card>
          <div className="message-detail-head"><div><p className="eyebrow">{selected.status === 'unread' ? 'NON LU' : 'MESSAGE'}</p><h2>{selected.subject}</h2></div><button className="ui-button ui-button-secondary message-read-toggle" onClick={() => void toggleRead(selected)}>{selected.status === 'unread' ? 'Marquer comme lu' : 'Marquer comme non lu'}</button></div>
          <div className="message-sender"><strong>{selected.firstName} {selected.lastName}</strong><a href={`mailto:${selected.email}`}>{selected.email}</a>{selected.phone && <a href={`tel:${selected.phone}`}>{selected.phone}</a>}</div>
          <div className="message-meta"><span>Reçu le {formatDate(selected.createdAt)}</span>{selected.readAt && <span>Lu le {formatDate(selected.readAt)}</span>}</div>
          <div className="message-body">{selected.message.split('\n').map((line, index) => <p key={index}>{line || '\u00a0'}</p>)}</div>
          <div className="message-actions"><a className="ui-button ui-button-primary message-reply-button" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}>Répondre par e-mail</a><button className="ui-button ui-button-danger message-delete-button" onClick={() => void remove(selected)}>Supprimer</button></div>
        </Card> : <Card className="catalogue-empty"><p>Sélectionnez un message pour le consulter.</p></Card>}
      </section>
    </div>
  </Container>
}
