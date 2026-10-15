import { Container } from './ui/Container'

const LEGACY_PLATFORM_URL = 'https://edu.e-saina.com/'

export function LegacyPlatformNotice() {
  return <div className="cav-legacy-notice" role="note" aria-label="Information sur l’ancienne plateforme">
    <Container className="cav-legacy-notice-inner">
      <span className="cav-legacy-notice-icon" aria-hidden="true">i</span>
      <p>
        <strong>Nouvelle plateforme !</strong>{' '}
        Si vous utilisiez l’ancienne version, vous pouvez toujours y accéder{' '}
        <a className="cav-legacy-notice-link" href={LEGACY_PLATFORM_URL} rel="noopener noreferrer" aria-label="ici, accéder à l’ancienne plateforme">ici <span aria-hidden="true">→</span></a>.
      </p>
    </Container>
  </div>
}
