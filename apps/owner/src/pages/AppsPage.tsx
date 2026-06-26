import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppWindow, Plus, ExternalLink, Store, Users, Receipt } from 'lucide-react'
import { owner } from '@/lib/api'
import { useAuth } from '@/lib/store'
import { can } from '@/lib/rbac'
import { fmtDate, fmtNumber } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

type AppItem = Awaited<ReturnType<typeof owner.listApps>>['apps'][number]

export function AppsPage() {
  const auth = useAuth()
  const puedeCrear = can(auth.owner?.rol, 'apps', 'editar')
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await owner.listApps()
        setApps(res.apps)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando apps')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered =
    statusFilter === 'all' ? apps : apps.filter((a) => a.status === statusFilter)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenants"
        title="Apps"
        subtitle={`${apps.length} ${apps.length === 1 ? 'ciudad' : 'ciudades'} en operación`}
        actions={
          puedeCrear ? (
            <Link
              to="/apps/nueva"
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-white shadow shadow-accent-500/30 transition-all hover:-translate-y-0.5"
            >
              <Plus size={12} />
              Nueva app
            </Link>
          ) : null
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'active', 'pending', 'suspended', 'archived'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              statusFilter === s
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {s === 'all' ? 'Todas' : s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-white ring-1 ring-neutral-200"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={AppWindow}
          title={statusFilter === 'all' ? 'Sin apps todavía' : 'No hay apps con ese filtro'}
          description={
            statusFilter === 'all'
              ? 'Sumá tu primera ciudad para empezar a operar.'
              : 'Probá con otro filtro o creá una nueva app.'
          }
          action={
            statusFilter === 'all' && puedeCrear ? (
              <Link
                to="/apps/nueva"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-xs font-bold text-white"
              >
                <Plus size={12} /> Crear primera app
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  )
}

function AppCard({ app }: { app: AppItem }) {
  return (
    <Link
      to={`/apps/${app.id}`}
      className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-neutral-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-accent-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-neutral-900">{app.nombre}</h3>
          <p className="text-xs text-neutral-500">
            {app.ciudad} · {app.subdomain}.micuidad.com
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-4 text-xs">
        <Stat icon={Store} label="Comercios" value={app.cachedStats?.totalMerchants ?? 0} />
        <Stat icon={Users} label="Vecinos" value={app.cachedStats?.totalUsers ?? 0} />
        <Stat
          icon={Receipt}
          label="Canjes 30d"
          value={app.cachedStats?.redemptionsLast30Days ?? 0}
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
        <span>Creada {fmtDate(app.createdAt)}</span>
        <span className="inline-flex items-center gap-1 text-accent-700 opacity-0 transition-opacity group-hover:opacity-100">
          Ver detalle <ExternalLink size={10} />
        </span>
      </div>
    </Link>
  )
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
        <Icon size={12} />
      </span>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-neutral-900">{fmtNumber(value)}</p>
      <p className="text-[9px] uppercase tracking-widest text-neutral-400">{label}</p>
    </div>
  )
}
