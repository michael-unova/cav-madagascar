import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="CAV Madagascar - Accueil">
      <img src="/assets/cav-logo.png" alt="CAV Madagascar" />
    </Link>
  )
}
