import { Link } from 'react-router-dom'
import { ArrowUpRight, Flame, Sparkles, TicketCheck } from 'lucide-react'
import { useApiMyActivations } from '@/lib/apiQueries'
import { tokens } from '@/lib/api'

function ars(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function tier(total: number): { label: string; next: number | null } {
  if (total >= 50000) return { label: 'Leyenda del barrio', next: null }
  if (total >= 20000) return { label: 'Ahorrador Oro', next: 50000 }
  if (total >= 8000) return { label: 'Ahorrador Plata', next: 20000 }
  if (total >= 2000) return { label: 'Ahorrador Bronce', next: 8000 }
  return { label: 'Recién empezás', next: 2000 }
}

/** Sparkline minimalista (ahorro acumulado) en SVG, sin deps. */
function Sparkline({ values }: { values: number[] }) {
  const w = 120
  const h = 36
  if (values.length < 2) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <line x1="0" y1={h - 4} x2={w} y2={h - 4} stroke="var(--color-fin-line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = i * step
    const y = h - 4 - ((v - min) / span) * (h - 8)
    return [x, y] as const
  })
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${d} L${w} ${h} L0 ${h} Z`
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-fin-lime)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-fin-lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={d} fill="none" stroke="var(--color-fin-lime)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--color-fin-lime)" />
    </svg>
  )
}

function SavingsCta() {
  return (
    <Link
      to="/"
      className="bg-fin-mesh group relative block overflow-hidden rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card"
    >
      <div className="bg-fin-grid absolute inset-0 opacity-60" />
      <div className="relative flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fin-lime text-fin-bg shadow-fin-glow">
          <Sparkles size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">Tu billetera de ahorro</p>
          <p className="mt-0.5 text-lg font-extrabold leading-tight text-fin-ink">
            Canjeá tu primer descuento
          </p>
          <p className="text-xs text-fin-soft">Activá un cupón y mirá cuánto vas juntando. Sin registro.</p>
        </div>
        <ArrowUpRight size={20} className="text-fin-soft transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

export function SavingsWallet() {
  const loggedIn = !!(tokens.get('user').access || tokens.get('user').refresh)
  const { data } = useApiMyActivations('canjeado', loggedIn)

  if (!loggedIn) return <SavingsCta />

  const canjeados = data ?? []
  const total = canjeados.reduce((s, a) => s + (a.ahorroEstimado ?? 0), 0)
  const count = canjeados.length
  const now = new Date()
  const monthTotal = canjeados
    .filter((a) => {
      const d = a.redeemedAt ? new Date(a.redeemedAt) : null
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, a) => s + (a.ahorroEstimado ?? 0), 0)

  const chrono = [...canjeados].sort(
    (a, b) => new Date(a.redeemedAt ?? 0).getTime() - new Date(b.redeemedAt ?? 0).getTime(),
  )
  let acc = 0
  const cumulative = chrono.map((a) => (acc += a.ahorroEstimado ?? 0))
  const t = tier(total)
  const progress = t.next ? Math.min(100, Math.round((total / t.next) * 100)) : 100

  return (
    <div className="bg-fin-mesh relative overflow-hidden rounded-3xl bg-fin-surface p-5 ring-1 ring-fin-line shadow-fin-card">
      <div className="bg-fin-grid absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
              Ahorrado en San Pedro
            </p>
            <p className="animate-count-pop mt-1 flex items-baseline gap-1 font-black tabular-nums text-fin-ink">
              <span className="text-2xl text-fin-soft">$</span>
              <span className="text-6xl leading-none tracking-tight">{ars(total)}</span>
            </p>
          </div>
          <Sparkline values={cumulative} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fin-surface2 px-3 py-1.5 text-xs font-bold text-fin-ink ring-1 ring-fin-line">
            <TicketCheck size={13} className="text-fin-lime" />
            {count} {count === 1 ? 'canje' : 'canjes'}
          </span>
          {monthTotal > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fin-surface2 px-3 py-1.5 text-xs font-bold text-fin-up ring-1 ring-fin-line">
              <Flame size={13} /> +${ars(monthTotal)} este mes
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime/15 px-3 py-1.5 text-xs font-bold text-fin-lime ring-1 ring-fin-lime/30">
            {t.label}
          </span>
        </div>

        {t.next && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fin-surface2">
              <div
                className="h-full rounded-full bg-fin-lime transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-fin-soft">
              Te faltan <span className="font-bold text-fin-ink">${ars(t.next - total)}</span> para el próximo nivel
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
