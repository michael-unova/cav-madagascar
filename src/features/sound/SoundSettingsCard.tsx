import './sound.css'
import { useNotificationSound } from './soundContext'

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>}
    </svg>
  )
}

/** Sound preference, shown in the « Paramètres » page for administrators and students. */
export function SoundSettingsCard({ audience }: { audience: 'manager' | 'student' }) {
  const { enabled, message, toggle, test } = useNotificationSound()
  const label = enabled ? 'Son activé' : 'Activer le son'
  const hint = enabled
    ? 'Les notifications sonores sont activées. Cliquez pour les désactiver.'
    : 'Cliquez pour activer les notifications sonores.'

  return (
    <section className="panel cav-sound-card" aria-labelledby="cav-sound-title">
      <div className="eyebrow">NOTIFICATIONS</div>
      <h2 id="cav-sound-title">Notifications sonores</h2>
      <p>
        {audience === 'manager'
          ? 'Un signal sonore discret vous prévient d’un nouveau message, d’une nouvelle question d’étudiant ou d’un paiement à vérifier.'
          : 'Un signal sonore discret vous prévient d’une annonce, d’une réponse à votre commentaire ou d’un changement sur votre paiement.'}
        {' '}Le son ne retentit que lorsque CAV est ouvert dans votre navigateur.
      </p>
      <div className="cav-sound-actions">
        <button
          type="button"
          className={`cav-sound-toggle${enabled ? ' is-on' : ''}`}
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={`${label}. ${hint}`}
          title={hint}
        >
          <SpeakerIcon on={enabled} />
          <span>{label}</span>
        </button>
        {enabled && (
          <button type="button" className="cav-sound-test" onClick={test} title="Jouer un son de test pour vérifier votre volume">
            Tester le son
          </button>
        )}
      </div>
      <div className="cav-sound-status" role="status" aria-live="polite">{message}</div>
    </section>
  )
}
