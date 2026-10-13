import { useCallback, useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from '../lib/firebase/functions'

type ServiceCost = { service: string; amount: number; currency: string }
type BillingResponse = {
  configured: boolean
  month: string
  currency?: string
  currentMonth?: number
  previousMonth?: number
  lastUpdated?: string
  services?: ServiceCost[]
  daily?: { date: string; amount: number }[]
  message?: string
}

const money = (amount: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`
  }
}

function BillingIcon({ name }: { name: 'cloud' | 'refresh' | 'money' | 'calendar' | 'trend' | 'bars' | 'pie' | 'info' | 'external' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths = {
    cloud: <><path d="M7.5 18.2h9.7a4.3 4.3 0 0 0 .3-8.6A6.1 6.1 0 0 0 5.8 8.4a4.9 4.9 0 0 0 1.7 9.8Z" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4.7 10a7.5 7.5 0 0 1 12.6-4L20 7" /><path d="M4 17v-5h5" /><path d="M19.3 14a7.5 7.5 0 0 1-12.6 4L4 17" /></>,
    money: <><path d="M12 2v20" /><path d="M17 6.5c-.7-1.4-2.3-2.1-4.8-2.1-2.7 0-4.4 1.3-4.4 3.2 0 5.1 9.4 2.1 9.4 7.2 0 2-1.8 3.4-4.8 3.4-2.6 0-4.5-.9-5.4-2.7" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    trend: <><path d="m3 17 6-6 4 3 7-8" /><path d="M14 6h6v6" /><path d="M4 21h16" /></>,
    bars: <><path d="M4 20V12M10 20V5M16 20v-8M22 20V2" /></>,
    pie: <><path d="M12 3v9h9A9 9 0 1 1 12 3Z" /><path d="M16 3.8A9 9 0 0 1 20.2 8H16Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function EmptyState({ kind, children }: { kind: 'daily' | 'services'; children: string }) {
  return <div className="billing-empty-state">
    <div className={`billing-empty-art ${kind}`} aria-hidden="true">
      {kind === 'daily' ? <><span className="art-bar bar-one" /><span className="art-bar bar-two" /><span className="art-bar bar-three" /><span className="art-bar bar-four" /></> : <><span className="art-row" /><span className="art-row" /><span className="art-row" /><span className="art-pie"><i /></span></>}
    </div>
    <p>{children}</p>
  </div>
}

export function AdminBillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const call = httpsCallable<Record<string, never>, BillingResponse>(getFirebaseFunctions(), 'adminGetGoogleBillingSummary')
      const result = await call({})
      setData(result.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les données de facturation.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const services = data?.services ?? []
  const daily = data?.daily ?? []
  const maxService = Math.max(1, ...services.map(service => Math.abs(service.amount)))
  const maxDaily = Math.max(1, ...daily.map(item => Math.abs(item.amount)))
  const currentMonth = data?.currentMonth ?? 0
  const previousMonth = data?.previousMonth ?? 0
  const change = previousMonth === 0 ? null : ((currentMonth - previousMonth) / Math.abs(previousMonth)) * 100
  const lastUpdated = data?.lastUpdated && !Number.isNaN(new Date(data.lastUpdated).getTime())
    ? new Date(data.lastUpdated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return <main className="page billing-dashboard">
    <div className="billing-breadcrumb" aria-label="Fil d’Ariane"><span>Administration</span><span aria-hidden="true">›</span><span>Coûts</span><span aria-hidden="true">›</span><strong>Facturation Google Cloud</strong></div>

    <header className="billing-page-header">
      <div className="billing-heading-main">
        <div className="billing-cloud-mark"><BillingIcon name="cloud" /></div>
        <div>
          <div className="eyebrow">ADMINISTRATION · COÛTS</div>
          <h1>Facturation Google Cloud</h1>
          <p>Comprenez les dépenses de CAV sur Google Cloud sans devoir lire les détails techniques de la console Google Cloud.</p>
        </div>
      </div>
      <div className="billing-header-actions">
        <button type="button" className="billing-refresh" onClick={() => void load()} disabled={loading}>
          <BillingIcon name="refresh" />{loading ? 'Actualisation…' : 'Actualiser'}
        </button>
        <div className="billing-updated">Dernière mise à jour : <strong>{lastUpdated ?? 'En attente des données'}</strong></div>
        <div className="billing-period-label">Période : <strong>{data?.month ?? new Date().toISOString().slice(0, 7)}</strong></div>
      </div>
    </header>

    {error && <div className="billing-alert" role="alert"><span className="billing-alert-icon"><BillingIcon name="info" /></span><div><strong>Connexion à la facturation impossible</strong><p>{error}</p><small>Vérifiez que la fonction backend est déployée et que son compte de service peut lire les données de facturation.</small></div></div>}

    {loading && !data ? <div className="billing-loading" role="status"><span className="billing-spinner" />Chargement des données de facturation Google Cloud…</div>
      : data && !data.configured ? <section className="billing-setup-card">
        <div className="billing-setup-symbol"><BillingIcon name="info" /></div><h2>Connectez les données de facturation</h2>
        <p>Le tableau de bord est prêt. Pour afficher les coûts détaillés, configurez l’export de facturation Google Cloud vers BigQuery.</p>
        <ol><li>Dans Google Cloud Console, activez <strong>l’export de facturation vers BigQuery</strong> pour le compte de facturation de CAV.</li><li>Configurez la variable backend <code>BILLING_EXPORT_TABLE</code> avec le nom complet de la table d’export.</li><li>Accordez au compte de service les rôles BigQuery Job User et BigQuery Data Viewer nécessaires.</li></ol>
        <p className="billing-security-note">Sécurité : les identifiants et les données sensibles de facturation restent côté serveur.</p>
      </section> : data && <>
        <section className="billing-kpi-grid" aria-label="Résumé des dépenses">
          <article className="billing-kpi-card">
            <div className="billing-kpi-icon blue"><BillingIcon name="money" /></div>
            <div className="billing-kpi-content"><div className="billing-kpi-label">Dépenses ce mois-ci <span title="Coût enregistré dans l’export Google Cloud"><BillingIcon name="info" /></span></div><strong>{money(currentMonth, data.currency)}</strong><small>Coût enregistré par Google Cloud</small></div>
          </article>
          <article className="billing-kpi-card">
            <div className="billing-kpi-icon violet"><BillingIcon name="calendar" /></div>
            <div className="billing-kpi-content"><div className="billing-kpi-label">Mois précédent <span title="Coût enregistré le mois précédent"><BillingIcon name="info" /></span></div><strong>{money(previousMonth, data.currency)}</strong><small>Pour comparer les dépenses</small></div>
          </article>
          <article className="billing-kpi-card">
            <div className="billing-kpi-icon green"><BillingIcon name="trend" /></div>
            <div className="billing-kpi-content"><div className="billing-kpi-label">Évolution mensuelle <span title="Variation par rapport au mois précédent"><BillingIcon name="info" /></span></div><strong className={change === null ? '' : change > 0 ? 'billing-change-up' : change < 0 ? 'billing-change-down' : ''}>{change === null ? 'N/D' : `${change > 0 ? '+' : ''}${change.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}</strong><small>Par rapport au mois précédent</small></div>
          </article>
        </section>

        <section className="billing-chart-grid" aria-label="Détail des dépenses">
          <article className="billing-chart-panel">
            <div className="billing-panel-heading"><div className="billing-panel-icon"><BillingIcon name="bars" /></div><div><h2>Évolution quotidienne</h2><p>Dépenses enregistrées chaque jour du mois en cours.</p></div></div>
            <div className="billing-panel-body">{daily.length ? <div className="billing-daily-chart" role="img" aria-label="Graphique des dépenses quotidiennes">{daily.map(item => <div className="billing-daily-column" key={item.date} title={`${item.date} : ${money(item.amount, data.currency)}`}><span className="billing-daily-bar" style={{ height: `${Math.max(3, Math.abs(item.amount) / maxDaily * 100)}%` }} /><small>{item.date.slice(-2)}</small></div>)}</div> : <EmptyState kind="daily">Les données de dépenses ne sont pas encore disponibles pour cette période.</EmptyState>}</div>
          </article>
          <article className="billing-chart-panel">
            <div className="billing-panel-heading"><div className="billing-panel-icon"><BillingIcon name="pie" /></div><div><h2>Répartition par service</h2><p>Dépenses regroupées par service Google Cloud.</p></div></div>
            <div className="billing-panel-body">{services.length ? <div className="billing-service-list">{services.map(service => <div className="billing-service" key={service.service}><div className="billing-service-top"><strong>{service.service || 'Autre service'}</strong><strong>{money(service.amount, service.currency || data.currency)}</strong></div><div className="billing-track"><span style={{ width: `${Math.max(2, Math.abs(service.amount) / maxService * 100)}%` }} /></div></div>)}</div> : <EmptyState kind="services">Aucune dépense détaillée n’est disponible pour cette période.</EmptyState>}</div>
          </article>
        </section>

        <aside className="billing-info-banner">
          <div className="billing-info-icon"><BillingIcon name="info" /></div>
          <div className="billing-info-copy"><strong>Les données proviennent de l’export de facturation Google Cloud et peuvent être retardées.</strong><p>Il peut falloir plusieurs heures avant que les données apparaissent dans BigQuery après l’activation de l’export. Consultez la console Google Cloud pour les factures officielles et les ajustements fiscaux.</p></div>
          <a className="billing-console-link" href="https://console.cloud.google.com/billing/export" target="_blank" rel="noreferrer"><BillingIcon name="external" />Ouvrir la console Google Cloud</a>
        </aside>
      </>}
  </main>
}
