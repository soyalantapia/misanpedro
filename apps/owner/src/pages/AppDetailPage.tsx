import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Receipt, Store, Ticket, Users } from 'lucide-react'
import { owner } from '@/lib/api'
import { fmtDate, fmtNumber } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'

export function AppDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [app, setApp] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [appRes, metricsRes] = await Promise.all([
          owner.getApp(id),
          owner.appMetrics(id),
        ])
        setApp(appRes.app)
        setMetrics(metricsRes.metrics)
      } catch (err: any) {
        setError(err?.message ?? 'No pudimos cargar la app')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="rounded-2xl bg-danger-bg px-4 py-6 text-sm font-semibold text-danger">
        {error ?? 'App no encontrada'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Slug: ${app.slug}`}
        title={app.nombre}
        subtitle={`${app.ciudad} · ${app.provincia ?? 'Argentina'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/apps"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              <ArrowLeft size={12} /> Volver
            </Link>
            <a
              href={`https://${app.subdomain}.cuponcito.app`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
            >
              Abrir <ExternalLink size={10} />
            </a>
          </div>
        }
      />

      <section className="flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-neutral-200">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${app.brand?.primaryColor ?? '#695ede'}, ${app.brand?.accentColor ?? '#4239a3'})`,
          }}
        >
          {app.ciudad?.[0]?.toUpperCase() ?? 'C'}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={app.status} />
            <span className="text-xs text-neutral-500">Plan {app.plan}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            <strong>{app.subdomain}.cuponcito.app</strong>
            {app.customDomain && ` · custom: ${app.customDomain}`}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">Creada {fmtDate(app.createdAt)}</p>
        </div>
      </section>

      {metrics && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Store}
            label="Comercios"
            value={fmtNumber(metrics.merchants.total)}
            hint={`${metrics.merchants.active} activos`}
          />
          <StatCard
            icon={Users}
            label="Vecinos"
            value={fmtNumber(metrics.users.total)}
            accent="success"
          />
          <StatCard
            icon={Ticket}
            label="Cupones"
            value={fmtNumber(metrics.coupons.total)}
            hint={`${metrics.coupons.active} activos`}
          />
          <StatCard
            icon={Receipt}
            label="Canjes 30d"
            value={fmtNumber(metrics.redemptions.last30Days)}
            hint={`${metrics.redemptions.last7Days} en 7d`}
            accent="accent"
          />
        </section>
      )}

      <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="text-sm font-bold text-neutral-900">Drill-down</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Ver datos cross-app filtrados a esta ciudad.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            to={`/comercios?appId=${app._id ?? id}`}
            className="group flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-accent-50 hover:text-accent-700"
          >
            Ver comercios de {app.ciudad}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <Link
            to={`/vecinos?appId=${app._id ?? id}`}
            className="group flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-accent-50 hover:text-accent-700"
          >
            Ver vecinos de {app.ciudad}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </section>
    </div>
  )
}
