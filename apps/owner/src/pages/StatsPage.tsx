import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DollarSign, Store, Users, PiggyBank, TrendingUp, Repeat } from 'lucide-react'
import { owner } from '@/lib/api'
import { useAuth } from '@/lib/store'
import { canSeeMrr } from '@/lib/rbac'
import { fmtCompact, fmtMoney, fmtNumber } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'

type Stats = Awaited<ReturnType<typeof owner.stats>>
type Trend = Awaited<ReturnType<typeof owner.mrrTrend>>['trend']

const ESTADO_LABEL: Record<string, string> = {
  activo: 'Activos',
  pending_payment: 'Esperando pago',
  suspendido: 'Suspendidos',
  cancelado: 'Cancelados',
}
const ESTADO_COLOR: Record<string, string> = {
  activo: '#16a34a',
  pending_payment: '#eab308',
  suspendido: '#f97316',
  cancelado: '#dc2626',
}
const ACCENT = '#ea580c'

export function StatsPage() {
  const auth = useAuth()
  const verMrr = canSeeMrr(auth.owner?.rol)
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<Trend>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([owner.stats(), verMrr ? owner.mrrTrend(90) : Promise.resolve({ ok: true, trend: [] as Trend })])
      .then(([s, t]) => {
        if (!alive) return
        setStats(s)
        setTrend(t.trend ?? [])
      })
      .catch((err: unknown) => {
        if (alive) setError((err as Error)?.message ?? 'Error cargando las estadísticas')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [verMrr])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    )
  }
  if (error || !stats) {
    return <div className="rounded-2xl bg-danger-bg px-4 py-6 text-sm font-semibold text-danger">{error ?? 'Sin datos'}</div>
  }

  const mrrTotalArs = stats.mrr.byCurrency['ARS'] ?? 0
  const estadoData = Object.entries(stats.comercios.porEstado)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ name: ESTADO_LABEL[k] ?? k, value: n, color: ESTADO_COLOR[k] ?? '#94a3b8' }))
  const canjesData = stats.canjesPorMes.map((m) => ({ mes: m.mes.slice(2), canjes: m.canjes, ahorro: Math.round(m.ahorro) }))
  const altasData = mergeAltas(stats.altas.comercios, stats.altas.vecinos)
  const trendData = trend.map((t) => ({ date: t.date.slice(5), mrr: t.mrrByCurrency['ARS'] ?? 0, comercios: t.comerciosActivos }))
  const convPct = stats.embudo.conTrial > 0 ? Math.round((stats.embudo.pagando / stats.embudo.conTrial) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Negocio" title="Estadísticas" subtitle="Toda la operación cross-ciudad, en vivo" />

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {verMrr && (
          <StatCard icon={DollarSign} label="MRR (ARS)" value={fmtMoney(mrrTotalArs, 'ARS')} hint={`${stats.resumen.suscripcionesActivas} suscripciones`} accent="accent" />
        )}
        <StatCard icon={Store} label="Comercios activos" value={fmtNumber(stats.resumen.comerciosActivos)} hint={`${stats.comercios.enTrial} en trial`} accent="success" />
        <StatCard icon={Users} label="Vecinos" value={fmtNumber(stats.resumen.vecinos)} hint={`${stats.resumen.appsActivas} ciudades activas`} />
        <StatCard icon={PiggyBank} label="Ahorro generado" value={fmtMoney(stats.resumen.ahorroTotal, 'ARS')} hint="histórico, todas las ciudades" />
      </section>

      {/* MRR trend + por ciudad */}
      {verMrr && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Tendencia de MRR" icon={TrendingUp} subtitle={trendData.length < 2 ? 'Se acumula a diario — todavía hay pocos puntos' : 'Últimos 90 días'}>
            {trendData.length === 0 ? (
              <Vacio texto="Aún no hay snapshots. La tendencia empieza a acumularse desde hoy." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => fmtMoney(Number(v), 'ARS')} />
                  <Line type="monotone" dataKey="mrr" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="MRR por ciudad" icon={DollarSign} subtitle="Suscripciones autorizadas">
            {stats.mrr.byCity.length === 0 ? (
              <Vacio texto="Sin suscripciones activas todavía." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.mrr.byCity} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="ciudad" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v, _n, p) => fmtMoney(Number(v), (p?.payload as { moneda?: string })?.moneda ?? 'ARS')} />
                  <Bar dataKey="mrr" fill={ACCENT} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      {/* Comercios por estado + canjes por mes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Comercios por estado" icon={Store}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={estadoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {estadoData.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-2">
              {estadoData.map((e) => (
                <li key={e.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    {e.name}
                  </span>
                  <strong className="tabular-nums">{fmtNumber(e.value)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Canjes y ahorro por mes" icon={Repeat}>
          {canjesData.length === 0 ? (
            <Vacio texto="Sin canjes todavía." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={canjesData} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v, n) => (n === 'ahorro' ? fmtMoney(Number(v), 'ARS') : fmtNumber(Number(v)))} />
                <Bar dataKey="canjes" fill={ACCENT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Altas + embudo */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Altas por mes" icon={TrendingUp} subtitle="Comercios y vecinos nuevos">
          {altasData.length === 0 ? (
            <Vacio texto="Sin altas registradas." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={altasData} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="comercios" fill={ACCENT} radius={[6, 6, 0, 0]} />
                <Bar dataKey="vecinos" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Embudo trial → pago" icon={DollarSign} subtitle="Conversión de comercios">
          <div className="flex h-[200px] flex-col items-center justify-center gap-3">
            <div className="text-center">
              <p className="text-5xl font-bold text-accent-700">{convPct}%</p>
              <p className="mt-1 text-sm text-neutral-500">de los comercios en trial ya pagan</p>
            </div>
            <div className="flex gap-6 text-center text-sm">
              <div>
                <p className="text-2xl font-bold tabular-nums">{fmtNumber(stats.embudo.conTrial)}</p>
                <p className="text-xs text-neutral-500">entraron a trial</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-success">{fmtNumber(stats.embudo.pagando)}</p>
                <p className="text-xs text-neutral-500">pagando</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tops */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopList title="Top ciudades por canjes" items={stats.topCiudades.map((c) => ({ label: c.ciudad, value: c.canjes }))} />
        <TopList title="Top comercios por canjes" items={stats.topComercios.map((m) => ({ label: m.nombre, value: m.canjes }))} />
      </div>
    </div>
  )
}

function mergeAltas(comercios: { mes: string; n: number }[], vecinos: { mes: string; n: number }[]) {
  const meses = [...new Set([...comercios.map((c) => c.mes), ...vecinos.map((v) => v.mes)])].sort()
  const cm = new Map(comercios.map((c) => [c.mes, c.n]))
  const vm = new Map(vecinos.map((v) => [v.mes, v.n]))
  return meses.map((mes) => ({ mes: mes.slice(2), comercios: cm.get(mes) ?? 0, vecinos: vm.get(mes) ?? 0 }))
}

function Card({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: typeof Store; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200">
      <header className="mb-4 flex items-start gap-2">
        <Icon size={15} className="mt-0.5 text-accent-700" />
        <div>
          <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
          {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <div className="flex h-[200px] items-center justify-center text-center text-sm text-neutral-400">{texto}</div>
}

function TopList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="mb-4 text-sm font-bold text-neutral-900">{title}</h2>
      {items.length === 0 ? (
        <Vacio texto="Sin datos." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold tabular-nums text-neutral-400">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-neutral-700">{i.label}</span>
                  <strong className="tabular-nums text-sm">{fmtNumber(i.value)}</strong>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${(i.value / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
