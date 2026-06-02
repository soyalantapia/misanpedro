import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  Repeat,
  CalendarDays,
  Tag,
  Crown,
  Info,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { useApiMerchantStatsAsesor } from '@/lib/apiQueries'
import type { MerchantStatsPeriodo, ApiMerchantStatsAsesor } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

const PERIODOS: { id: MerchantStatsPeriodo; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: '7dias', label: 'Últimos 7 días' },
  { id: 'mesPasado', label: 'Mes pasado' },
  { id: 'todo', label: 'Todo' },
]

const PREV_LABEL: Record<MerchantStatsPeriodo, string> = {
  mes: 'vs el mes pasado',
  '7dias': 'vs los 7 días previos',
  mesPasado: 'vs el mes anterior',
  todo: '',
}

const DIA_LABEL: Record<string, { corto: string; largo: string }> = {
  lun: { corto: 'Lun', largo: 'los lunes' },
  mar: { corto: 'Mar', largo: 'los martes' },
  mie: { corto: 'Mié', largo: 'los miércoles' },
  jue: { corto: 'Jue', largo: 'los jueves' },
  vie: { corto: 'Vie', largo: 'los viernes' },
  sab: { corto: 'Sáb', largo: 'los sábados' },
  dom: { corto: 'Dom', largo: 'los domingos' },
}

export function AdminEstadisticasPage() {
  const [periodo, setPeriodo] = useState<MerchantStatsPeriodo>('mes')
  const { data, loading, error, refetch } = useApiMerchantStatsAsesor(periodo)

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          <BarChart3 size={12} /> Estadísticas
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Cuánto te trae la app
        </h1>
        <p className="text-sm text-ink-soft">
          La plata y la gente que Mi San Pedro le acerca a tu comercio, y qué conviene hacer.
        </p>
      </header>

      {/* Selector de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            aria-pressed={periodo === p.id}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
              periodo === p.id
                ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta'
                : 'bg-surface text-ink-soft ring-1 ring-line hover:bg-surface-2',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <StatsSkeleton />}

      {!loading && error && <ErrorState onRetry={refetch} />}

      {!loading && !error && data && (
        data.totalClientes === 0 ? <EmptyState /> : <StatsBody data={data} periodo={periodo} />
      )}
    </div>
  )
}

function StatsBody({ data, periodo }: { data: ApiMerchantStatsAsesor; periodo: MerchantStatsPeriodo }) {
  const navigate = useNavigate()
  const prevLabel = PREV_LABEL[periodo]

  // ③ insight: día más flojo (menor conteo) — solo si hubo canjes en el período.
  const hayCanjesPeriodo = data.cuandoVienen.some((d) => d.canjes > 0)
  const diaFlojo = hayCanjesPeriodo
    ? data.cuandoVienen.reduce((min, d) => (d.canjes < min.canjes ? d : min), data.cuandoVienen[0])
    : null
  const maxDia = Math.max(1, ...data.cuandoVienen.map((d) => d.canjes))

  // ④ insight cupones
  const topCupon = data.cupones[0]
  const maxCupon = Math.max(1, ...data.cupones.map((c) => c.canjes))

  return (
    <div className="flex flex-col gap-4">
      {/* ① EL RETORNO */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card padding="md" className="flex flex-col gap-1.5 bg-gradient-to-br from-brand to-brand-strong text-on-brand ring-0">
          <div className="flex items-center gap-1.5">
            <Receipt size={13} className="text-on-brand/80" />
            <EstimadoTag />
          </div>
          <p className="text-3xl font-bold tabular-nums leading-none">{formatMoney(data.ventas)}</p>
          <p className="text-[11px] font-medium leading-snug text-on-brand/85">
            en ventas que te trajo la app
          </p>
          <Growth pct={data.crecimiento.ventasPct} prevLabel={prevLabel} onBrand />
        </Card>

        <Card padding="md" className="flex flex-col gap-1.5">
          <Users size={13} className="text-brand-strong" />
          <p className="text-3xl font-bold tabular-nums leading-none text-ink">{data.clientes}</p>
          <p className="text-[11px] font-medium leading-snug text-ink-soft">
            {data.clientes === 1 ? 'cliente vino' : 'clientes vinieron'}
            {data.nuevos > 0 && (
              <span className="font-bold text-brand-strong"> · {data.nuevos} {data.nuevos === 1 ? 'nuevo' : 'nuevos'}</span>
            )}
          </p>
          <Growth pct={data.crecimiento.clientesPct} prevLabel={prevLabel} />
        </Card>
      </div>

      {/* ② VOLVIERON (lifetime) */}
      <Card padding="lg" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            <Repeat size={16} />
          </span>
          <p className="text-sm text-ink">
            <strong className="text-ink">{data.volvieron}</strong> {data.volvieron === 1 ? 'cliente te visitó' : 'clientes te visitaron'} más de una vez
            <span className="text-ink-faint"> · de {data.totalClientes} en total</span>
          </p>
        </div>
        <SplitBar volvieron={data.volvieron} unaSolaVez={data.unaSolaVez} />
      </Card>

      {/* ③ ¿CUÁNDO VIENE LA GENTE? */}
      <Card padding="lg" className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <CalendarDays size={11} /> ¿Cuándo viene la gente?
        </p>
        <div className="flex items-end justify-between gap-1.5">
          {data.cuandoVienen.map((d) => {
            const h = Math.round((d.canjes / maxDia) * 100)
            const esFlojo = diaFlojo?.dia === d.dia
            return (
              <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-ink-soft">{d.canjes}</span>
                <div className="flex h-20 w-full items-end">
                  <div
                    className={cn(
                      'w-full rounded-md transition-all',
                      esFlojo ? 'bg-surface-2 ring-1 ring-line' : 'bg-gradient-to-t from-brand to-brand-strong',
                    )}
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-ink-faint">{DIA_LABEL[d.dia]?.corto}</span>
              </div>
            )
          })}
        </div>
        {diaFlojo && (
          <Insight
            text={<>Tus <strong>{DIA_LABEL[diaFlojo.dia]?.largo.replace('los ', '')}</strong> están flojos.</>}
            cta="Armá un cupón de ese día"
            onClick={() => navigate(`/admin/cupones/nuevo?dia=${diaFlojo.dia}`)}
          />
        )}
      </Card>

      {/* ④ TUS CUPONES */}
      <Card padding="lg" className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <Tag size={11} /> Tus cupones
        </p>
        {data.cupones.length === 0 ? (
          <p className="text-xs text-ink-soft">No hubo canjes de cupones en este período.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {data.cupones.map((c, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{c.titulo}</span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-brand-strong">
                      {c.canjes} {c.canjes === 1 ? 'canje' : 'canjes'}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-strong"
                      style={{ width: `${Math.round((c.canjes / maxCupon) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {topCupon && (
              <Insight text={<>Tu mejor cupón es <strong>{topCupon.titulo}</strong>. Hacé más como ese.</>} />
            )}
          </>
        )}
      </Card>

      {/* ⑤ TUS MEJORES CLIENTES */}
      <Card padding="lg" className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <Crown size={11} /> Tus mejores clientes
        </p>
        <ul className="flex flex-col gap-1.5">
          {data.mejoresClientes.map((m, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-3 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-strong">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm font-semibold text-ink">{m.nombre}</span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
                {m.visitas} {m.visitas === 1 ? 'visita' : 'visitas'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-center text-[11px] leading-snug text-ink-faint">
        Las ventas son un estimado: se calculan del monto que cargás al confirmar cada canje.
        El resto (clientes, visitas, días) son exactos.
      </p>
    </div>
  )
}

// ─── Piezas ──────────────────────────────────────────────────────────────

function EstimadoTag() {
  return (
    <span
      title="Se calcula del monto que cargás al confirmar el canje. Puede no ser exacto."
      className="inline-flex items-center gap-1 rounded-full bg-surface/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-brand/90"
    >
      <Info size={9} /> estimado
    </span>
  )
}

function Growth({ pct, prevLabel, onBrand }: { pct: number | null; prevLabel: string; onBrand?: boolean }) {
  if (pct == null) return <span className="h-3.5" />
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-bold',
        onBrand
          ? 'text-on-brand/90'
          : up
            ? 'text-status-success-fg'
            : 'text-ink-soft',
      )}
    >
      <Icon size={12} /> {up ? '+' : ''}{pct}% <span className="font-medium opacity-80">{prevLabel}</span>
    </span>
  )
}

function SplitBar({ volvieron, unaSolaVez }: { volvieron: number; unaSolaVez: number }) {
  const total = volvieron + unaSolaVez
  const pctVolvieron = total === 0 ? 0 : Math.round((volvieron / total) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-gradient-to-r from-brand to-brand-strong" style={{ width: `${pctVolvieron}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-brand-strong">Volvieron · {volvieron}</span>
        <span className="text-ink-faint">Una sola vez · {unaSolaVez}</span>
      </div>
    </div>
  )
}

function Insight({
  text,
  cta,
  onClick,
}: {
  text: React.ReactNode
  cta?: string
  onClick?: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-brand-soft p-3 ring-1 ring-brand/15 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-1.5 text-xs leading-snug text-brand-strong">
        <Sparkles size={13} className="mt-0.5 shrink-0" /> <span>{text}</span>
      </p>
      {cta && onClick && (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand to-brand-strong px-3 py-2 text-xs font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
        >
          {cta} <ArrowRight size={13} />
        </button>
      )}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-28 rounded-3xl bg-surface-2" />
        <div className="h-28 rounded-3xl bg-surface-2" />
      </div>
      <div className="h-24 rounded-3xl bg-surface-2" />
      <div className="h-44 rounded-3xl bg-surface-2" />
      <div className="h-40 rounded-3xl bg-surface-2" />
      <div className="h-40 rounded-3xl bg-surface-2" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card padding="lg" variant="brand" className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-brand-strong shadow-card">
        <BarChart3 size={22} />
      </span>
      <p className="max-w-xs text-sm font-medium leading-snug text-brand-strong">
        Cuando tengas tu primer canje vas a ver acá cuánta gente y cuánta plata te trae la app.
      </p>
    </Card>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm font-medium text-ink-soft">No pudimos cargar tus estadísticas.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-line transition-all hover:bg-line"
      >
        <RefreshCw size={14} /> Reintentar
      </button>
    </Card>
  )
}
