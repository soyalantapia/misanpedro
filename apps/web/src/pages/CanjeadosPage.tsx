import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, TrendingUp, Sparkles, PiggyBank } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { EmptyState } from '@/components/EmptyState'
import { useActivations, useUser } from '@/lib/stores'
import { getMerchant } from '@/data/mockData'
import { useCoupons } from '@/lib/couponsStore'
import { formatMoney, formatRedeemedDate } from '@/lib/format'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { syncMyActivations } from '@/lib/syncActivations'

export function CanjeadosPage() {
  const allActivations = useActivations()
  const user = useUser()
  // V10: refrescar las activaciones desde el backend al entrar. Sin esto, un
  // canje confirmado por el comercio mientras el vecino no estaba en la pantalla
  // del cupón activo (donde corre el polling) no aparecía hasta recargar la app.
  useEffect(() => {
    void syncMyActivations()
  }, [])
  // Filtramos por user actual; sin login mostramos empty state.
  const activations = useMemo(
    () => (user ? allActivations.filter((a) => a.userId === user.id) : []),
    [allActivations, user],
  )
  const localCoupons = useCoupons()
  const apiCouponsRes = useApiCoupons()
  const apiMerchantsRes = useApiMerchants()

  const couponMap = useMemo(() => {
    const map = new Map<string, { titulo: string; porcentaje: number; merchantId: string }>()
    localCoupons.forEach((c) => map.set(c.id, c))
    if (apiCouponsRes.data && apiMerchantsRes.data) {
      const idToSlug = new Map(apiMerchantsRes.data.map((m) => [m.id, m.slug]))
      apiCouponsRes.data.forEach((c) =>
        map.set(c.id, {
          titulo: c.titulo,
          porcentaje: c.porcentaje,
          merchantId: idToSlug.get(c.merchantId) ?? c.merchant?.slug ?? c.merchantId,
        }),
      )
    }
    return map
  }, [localCoupons, apiCouponsRes.data, apiMerchantsRes.data])
  const getCoupon = (id: string) => couponMap.get(id)
  const getMerchantBySlug = (slug: string | undefined) => {
    if (!slug) return undefined
    const local = getMerchant(slug)
    if (local) return local
    const apiM = apiMerchantsRes.data?.find((m) => m.slug === slug)
    if (!apiM) return undefined
    return { id: apiM.slug, nombre: apiM.nombre, categoria: apiM.categoria as any } as any
  }
  const isLoading = apiCouponsRes.loading || apiMerchantsRes.loading
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const totalAhorro = redemptions.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
    const allMerchants = new Set(
      redemptions.map((r) => getCoupon(r.couponId)?.merchantId).filter(Boolean) as string[],
    )
    const thisMonth = redemptions.filter(
      (r) => new Date(r.redeemedAt!).getTime() >= startOfMonth,
    )
    const monthAhorro = thisMonth.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
    return {
      total: totalAhorro,
      totalCount: redemptions.length,
      totalMerchants: allMerchants.size,
      monthAhorro,
      monthCount: thisMonth.length,
    }
  }, [redemptions])

  if (isLoading && localCoupons.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 animate-pulse rounded-full bg-accent-100" />
          <div className="h-9 w-36 animate-pulse rounded-2xl bg-neutral-200" />
        </div>
        <div className="h-44 animate-pulse rounded-3xl bg-accent-100" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white shadow-card" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

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
          <div className="bg-violet-mesh relative overflow-hidden rounded-3xl bg-accent-700 p-6 text-white shadow-floating">
            <div className="absolute -right-6 -top-6 grid h-28 w-28 place-items-center rounded-full bg-white/10">
              <PiggyBank size={56} className="text-white/30" strokeWidth={1.4} />
            </div>
            <div className="relative">
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-50 backdrop-blur">
                <PiggyBank size={11} /> Dinero ahorrado
              </div>
              <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
                {formatMoney(summary.total)}
              </p>
              <p className="mt-1 text-sm text-accent-100">
                Total acumulado con {summary.totalCount}{' '}
                {summary.totalCount === 1 ? 'canje' : 'canjes'} en {summary.totalMerchants}{' '}
                {summary.totalMerchants === 1 ? 'comercio' : 'comercios'}.
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-white/15 pt-3">
                <TrendingUp size={14} className="text-accent-100" />
                <p className="text-xs text-accent-100">
                  Este mes:{' '}
                  <span className="font-bold tabular-nums text-white">
                    {formatMoney(summary.monthAhorro)}
                  </span>{' '}
                  · {summary.monthCount}{' '}
                  {summary.monthCount === 1 ? 'cupón' : 'cupones'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {redemptions.map((r, i) => {
              const c = getCoupon(r.couponId)
              const m = c ? getMerchantBySlug(c.merchantId) : undefined
              // Mientras el API carga, mostramos skeleton en lugar de silenciar la fila
              if (!r.redeemedAt) return null
              if (!c || !m) {
                return isLoading ? (
                  <div key={r.id} className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-neutral-100" />
                ) : null
              }
              const ahorro = r.ahorroEstimado ?? 0
              const ticket = r.montoTicket ?? 0
              // montoTicket en backend = precio sin descuento (bruto).
              // Lo que el vecino realmente pagó = bruto - ahorro.
              const pagado = ticket > 0 ? Math.max(0, ticket - ahorro) : 0
              return (
                <div
                  key={r.id}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-up flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100"
                >
                  <div className="flex items-center gap-3">
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
                        −{formatMoney(ahorro)}
                      </p>
                      <p className="text-[11px] font-semibold text-neutral-400">
                        {c.porcentaje}% off
                      </p>
                    </div>
                  </div>
                  {ticket > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-primary-50 px-3 py-2 text-[11px]">
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-neutral-400">
                          Ticket
                        </span>
                        <span className="tabular-nums font-bold text-neutral-700">
                          {formatMoney(ticket)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-neutral-400">
                          Pagaste
                        </span>
                        <span className="tabular-nums font-bold text-neutral-900">
                          {formatMoney(pagado)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-neutral-400">
                          Ahorraste
                        </span>
                        <span className="tabular-nums font-bold text-status-success-fg">
                          {formatMoney(ahorro)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
