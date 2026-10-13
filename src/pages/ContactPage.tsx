import { Container } from '../components/ui/Container'
import { PageHeader } from '../components/ui/PageHeader'

const FACEBOOK_URL = 'https://web.facebook.com/profile.php?id=100065575115845'

export function ContactPage() {
  return (
    <Container className="page-container narrow">
      <PageHeader
        eyebrow="Contact"
        title="Contactez CAV Madagascar"
        description="Une question sur nos préparations aux concours ? Retrouvez-nous via notre page Facebook ou rendez-nous visite à Antananarivo."
      />
      <div className="contact-page-options">
        <a className="ui-card contact-page-option" href={FACEBOOK_URL} target="_blank" rel="noreferrer">
          <span className="contact-page-icon" aria-hidden="true">f</span>
          <span>
            <strong>Facebook</strong>
            <span>Suivez-nous et envoyez-nous un message sur notre page officielle.</span>
          </span>
          <span className="contact-page-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="ui-card contact-page-option">
          <span className="contact-page-icon contact-page-pin" aria-hidden="true">⌖</span>
          <span>
            <strong>Notre adresse</strong>
            <span>80 rue Pasteur Rabeony, Antananarivo</span>
          </span>
        </div>
      </div>
    </Container>
  )
}
