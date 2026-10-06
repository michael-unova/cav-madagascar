import { useState, type FormEvent } from 'react'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { createContactMessage } from '../features/contact'

const subjects = [
  'Demande d’information',
  'Question sur un concours',
  'Inscription et paiement',
  'Problème technique',
  'Autre',
]

export function ContactPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState(subjects[0])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !subject || !message.trim()) {
      setError('Veuillez renseigner tous les champs obligatoires.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Veuillez renseigner une adresse email valide.')
      return
    }

    setSubmitting(true)
    try {
      await createContactMessage({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject,
        message: message.trim(),
      })
      setSent(true)
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setSubject(subjects[0])
      setMessage('')
    } catch (err) {
      console.error(err)
      setError('Impossible d’envoyer votre message pour le moment. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Container className="page-container contact-page">
    <div className="contact-header">
      <div>
        <p className="eyebrow">Contact</p>
        <h1>Contactez-nous</h1>
        <p className="page-description">Une question sur une préparation, une inscription ou la plateforme ? Écrivez-nous.</p>
      </div>
      <div className="contact-details">
        <strong>CAV Madagascar</strong>
        <span>80 rue Pasteur Rabeony, Antananarivo</span>
        <a href="mailto:Service@cav.mg">Service@cav.mg</a>
        <a href="tel:+261347020222">+261 34 70 202 22</a>
        <a href="tel:+261345320222">+261 34 53 202 22</a>
      </div>
    </div>

    <Card className="contact-form-card">
      {sent ? <div className="contact-success" role="status">
        <div className="contact-success-icon">✓</div>
        <p className="eyebrow">Message envoyé</p>
        <h2>Merci pour votre message.</h2>
        <p>Votre demande a bien été enregistrée. L’équipe CAV Madagascar pourra la consulter et vous répondre.</p>
        <button className="ui-button ui-button-primary" onClick={() => setSent(false)}>Envoyer un autre message</button>
      </div> : <form onSubmit={submit} noValidate>
        <div className="contact-form-heading"><div><p className="eyebrow">VOTRE DEMANDE</p><h2>Écrivez-nous</h2></div><span>Les champs marqués d’un * sont obligatoires.</span></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="admin-form-grid contact-form-grid">
          <label>Prénom *<input value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" placeholder="Votre prénom" /></label>
          <label>Nom *<input value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" placeholder="Votre nom" /></label>
          <label>Email *<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="vous@exemple.com" /></label>
          <label>Téléphone<input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" placeholder="+261 ..." /></label>
          <label className="admin-form-full">Objet *<select value={subject} onChange={event => setSubject(event.target.value)}>{subjects.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="admin-form-full">Message *<textarea value={message} onChange={event => setMessage(event.target.value)} rows={8} placeholder="Écrivez votre message..." /></label>
        </div>
        <div className="contact-form-actions"><span>Votre message sera transmis à l’administration de CAV Madagascar.</span><button className="ui-button ui-button-primary" type="submit" disabled={submitting}>{submitting ? 'Envoi...' : 'Envoyer ma demande'}</button></div>
      </form>}
    </Card>
  </Container>
}
