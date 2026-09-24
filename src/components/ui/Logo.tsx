import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="CAV Madagascar - Accueil">
      <span className="logo-mark">C</span>
      <span>CAV Madagascar</span>
    </Link>
  )
}
