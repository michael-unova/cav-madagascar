import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { useAuth } from '../features/auth'
import { listPendingPayments, reviewPayment } from '../features/enrollment'
import type { Payment } from '../types/enrollment'

export function AdminPaymentsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Payment[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const refresh = () => listPendingPayments().then(setItems).catch(() => setError('Impossible de charger les paiements.'))
  useEffect(() => { void refresh() }, [])

  async function act(payment: Payment, approved: boolean) {
    if (!user) return
    setProcessing(payment.id); setError('')
    try {
      await reviewPayment({
        paymentId: payment.id,
        approved,
        rejectionReason: approved ? undefined : 'Paiement rejeté par l’administration',
      })
      await refresh()
    } catch (err) {
      console.error(err)
      setError('Impossible de traiter ce paiement. Vérifiez votre connexion puis réessayez.')
    } finally { setProcessing(null) }
  }

  return <Container className="page-container"><div className="page-header"><div><p className="eyebrow">Paiements</p><h1>Vérification MVola</h1><p className="page-description">Comparez la référence fournie avec le SMS reçu sur le numéro MVola de l’administration, puis validez ou rejetez le paiement.</p></div></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="admin-list">{items.map(payment => <Card className="admin-list-row" key={payment.id}><div><strong>{payment.reference}</strong><span>{payment.amount.toLocaleString('fr-FR')} MGA · utilisateur {payment.userId} · concours {payment.courseId}</span><small>{payment.submittedAt ? `Soumis le ${payment.submittedAt.toLocaleString('fr-FR')}` : ''}</small></div><div className="admin-list-actions"><button className="ui-button ui-button-primary" disabled={processing === payment.id} onClick={() => void act(payment, true)}>Valider</button><button className="ui-button ui-button-secondary" disabled={processing === payment.id} onClick={() => void act(payment, false)}>Rejeter</button></div></Card>)}{items.length === 0 && <Card className="catalogue-empty"><p>Aucun paiement en attente.</p></Card>}</div></Container>
}
