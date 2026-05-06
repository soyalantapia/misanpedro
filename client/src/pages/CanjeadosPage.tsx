import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, TrendingUp, Sparkles } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { EmptyState } from '@/components/EmptyState'
import { useActivations } from '@/lib/stores'
import { getCoupon, getMerchant } from '@/data/mockData'
import { formatMoney, formatRedeemedDate } from '@/lib/format'

export function CanjeadosPage() {
  const activations = useActivations()
  const redemptions = useMemo(
    () =>
      activations
        .filter((a) => a.status === 'canjeado' && a.redeemedAt)
        .sort((a, b) =>
          new Date(b.redeemedAt!).getTime() - new Date(a.redeemedAt!).getTime(),
        ),
    [activations],
  )

  const summary = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = redemptions.filter(
      (r) => new Date(r.redeemedAt!).getTime() >= startOfMonth.getTime(),
    )
    const totalAhorro = thisMonth.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
    const merchants = new Set(
      thisMonth.map((r) => getCoupon(r.couponId)?.merchantId).filter(Boolean) as string[],
    )
    return {
      count: thisMonth.length,
      ahorro: totalAhorro,
      merchants: merchants.size,
    }
  }, [redemptions])

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <CheckCircle2 size={12} /> Historial
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Canjeados
        </h1>
        <p className="text-sm text-neutral-500">
          Acá aparece cada cupón que usaste en un comercio adherido.
        </p>
      </header>

      {redemptions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin canjes todavía"
          description="Cuando uses tu primer descuento en un comercio, va a aparecer acá con la fecha y cuánto ahorraste."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-5 py-2.5 text-sm font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5"
            >
              <Sparkles size={14} /> Ver descuentos
            </Link>
          }
        />
      ) : (
        <>
          <div className="bg-violet-mesh rounded-3xl bg-accent-700 p-5 text-white shadow-floating">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-50 backdrop-blur">
              <TrendingUp size={12} /> Este mes
            </div>
            <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
              {formatMoney(summary.ahorro)}
            </p>
            <p className="mt-1 text-sm text-accent-100">
              Ahorraste con {summary.count} {summary.count === 1 ? 'cupón' : 'cupones'} en{' '}
              {summary.merchants} {summary.merchants === 1 ? 'comercio' : 'comercios'}.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {redemptions.map((r, i) => {
              const c = getCoupon(r.couponId)
              const m = c ? getMerchant(c.merchantId) : undefined
              if (!c || !m || !r.redeemedAt) return null
              return (
                <div
                  key={r.id}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-up flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100"
                >
                  <CardImage
                    categoria={m.categoria}
                    className="h-12 w-12 rounded-xl"
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{m.nombre}</p>
                    <p className="text-xs text-neutral-500">
                      {formatRedeemedDate(r.redeemedAt)} · {c.titulo}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-status-success-fg">
                      −{formatMoney(r.ahorroEstimado ?? 0)}
                    </p>
                    <p className="text-[11px] font-semibold text-neutral-400">
                      {c.porcentaje}% off
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
