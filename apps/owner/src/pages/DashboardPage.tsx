import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AppWindow,
  Store,
  Users,
  Receipt,
  CircleDollarSign,
  RefreshCw,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { owner } from '@/lib/api'
import { fmtCompact, fmtMoney, fmtNumber } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'

type GlobalMetrics = Awaited<ReturnType<typeof owner.metrics>>['metrics']
type AppItem = Awaited<ReturnType<typeof owner.listApps>>['apps'][number]

export function DashboardPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null)
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setError(null)
    try {
      const [m, a] = await Promise.all([owner.metrics(), owner.listApps()])
      setMetrics(m.metrics)
      setApps(a.apps)
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando métricas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
  }

  const statusBreakdown = apps.reduce<Record<string, number>>(
    (acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }),
    {},
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vista general"
        title="Dashboard"
        subtitle="KPIs cross-tenant de Mi San Pedro"
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {/* KPIs hero */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={CircleDollarSign}
          label="MRR"
          value={metrics ? fmtMoney(metrics.revenue.mrrARS) : '—'}
          hint="Suscripciones activas × precio"
          accent="success"
        />
        <StatCard
          icon={AppWindow}
          label="Apps activas"
          value={metrics ? `${metrics.apps.active} / ${metrics.apps.total}` : '—'}
          hint={loading ? 'Cargando…' : 'En operación'}
        />
        <StatCard
          icon={Store}
          label="Comercios"
          value={metrics ? fmtNumber(metrics.merchants.total) : '—'}
          hint={metrics ? `${metrics.merchants.active} activos` : ''}
        />
        <StatCard icon={Users} label="Vecinos" value={metrics ? fmtNumber(metrics.users.total) : '—'} />
        <StatCard
          icon={Receipt}
          label="Canjes 30 días"
          value={metrics ? fmtNumber(metrics.redemptions.last30Days) : '—'}
          accent="accent"
        />
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Canjes 30 días por ciudad</h2>
            <Link to="/apps" className="text-xs font-semibold text-accent-700 hover:underline">
              Ver todas →
            </Link>
          </div>
          {apps.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              Sumá la primera app para ver datos.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={apps.map((a) => ({
                  name: a.ciudad,
                  canjes: a.cachedStats?.redemptionsLast30Days ?? 0,
                }))}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke="#e7e6e7" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#605a5e' }}
                  axisLine={{ stroke: '#d2cfd1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#605a5e' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtCompact}
                />
                <Tooltip
                  cursor={{ fill: '#f0eefd' }}
                  contentStyle={{
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="canjes" fill="#695ede" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200">
          <h2 className="mb-4 text-sm font-bold text-neutral-900">Apps por status</h2>
          {Object.keys(statusBreakdown).length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Sin apps aún.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={Object.entries(statusBreakdown).map(([name, value]) => ({ name, value }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {Object.entries(statusBreakdown).map(([name], i) => {
                    const COLOR_MAP: Record<string, string> = {
                      active: '#695ede',
                      pending: '#f59e0b',
                      suspended: '#dc2626',
                      archived: '#b2aeb1',
                    }
                    return <Cell key={i} fill={COLOR_MAP[name] ?? '#b2aeb1'} />
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <ul className="mt-3 space-y-1.5 text-xs">
            {Object.entries(statusBreakdown).map(([name, value]) => (
              <li key={name} className="flex items-center justify-between">
                <span className="capitalize text-neutral-600">{name}</span>
                <span className="font-bold tabular-nums text-neutral-900">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA — Sumar app */}
      <section className="rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 p-6 text-white shadow-lg shadow-accent-500/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Próximo paso
            </p>
            <h3 className="mt-1 text-xl font-bold">Sumá una nueva ciudad</h3>
            <p className="mt-1 text-sm text-white/80">
              En 30 segundos creás un nuevo tenant con su subdomain y branding.
            </p>
          </div>
          <Link
            to="/apps/nueva"
            className="group inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-accent-700 transition-all hover:-translate-y-0.5"
          >
            Crear app
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
