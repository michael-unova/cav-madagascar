import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'

export function HomePage() {
  return <div className="redesign-public-home">
    <section className="redesign-home-hero"><Container><div className="redesign-home-copy"><p className="redesign-eyebrow">CAV Madagascar</p><h1>Préparez votre concours avec <em>clarté</em> et confiance.</h1><p>Des cours structurés, des entraînements et une progression simple à suivre, réunis dans une seule plateforme.</p><div className="redesign-home-actions"><Link className="redesign-primary-button compact" to="/courses">Découvrir les concours →</Link><Link className="redesign-home-secondary" to="/register">Créer un compte</Link></div></div><div className="redesign-home-visual"><img src="/assets/cav-learning.jpg" alt="Étudier avec CAV Madagascar" /><div className="redesign-floating-note"><strong>Apprendre. S’entraîner.</strong><span>Progresser à votre rythme.</span></div></div></Container></section>
    <section className="redesign-public-section"><Container><div className="redesign-section-heading"><div><p className="redesign-eyebrow">Pourquoi CAV</p><h2>Tout ce dont vous avez besoin pour avancer.</h2></div></div><div className="redesign-feature-grid"><Card><span className="redesign-feature-icon">▣</span><h3>Cours structurés</h3><p>Chaque concours est organisé en matières, chapitres et leçons faciles à parcourir.</p></Card><Card><span className="redesign-feature-icon">✓</span><h3>Entraînez-vous</h3><p>Testez vos connaissances avec des exercices et des entraînements adaptés.</p></Card><Card><span className="redesign-feature-icon">◒</span><h3>Suivez vos progrès</h3><p>Reprenez là où vous vous êtes arrêté et visualisez votre progression.</p></Card></div></Container></section>
  </div>
}
