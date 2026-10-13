import './sound.css'

type Props = {
  enabled: boolean
  toast: string | null
  onToggle: () => void
  onTest: () => void
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>}
    </svg>
  )
}

export function SoundControl({ enabled, toast, onToggle, onTest }: Props) {
  const label = enabled ? 'Son activé' : 'Activer le son'
  const hint = enabled
    ? 'Les notifications sonores sont activées. Cliquez pour les désactiver.'
    : 'Cliquez pour activer les notifications sonores (nouveaux messages, questions, paiements, annonces).'

  return (
    <div className="cav-sound-dock">
      <div className="cav-sound-toast" role="status" aria-live="polite">{toast}</div>
      <div className="cav-sound-row">
        {enabled && (
          <button type="button" className="cav-sound-test" onClick={onTest} title="Jouer un son de test pour vérifier votre volume">
            Tester le son
          </button>
        )}
        <button
          type="button"
          className={`cav-sound-toggle${enabled ? ' is-on' : ''}`}
          onClick={onToggle}
          aria-pressed={enabled}
          aria-label={`${label}. ${hint}`}
          title={hint}
        >
          <SpeakerIcon on={enabled} />
          <span>{label}</span>
        </button>
      </div>
    </div>
  )
}
