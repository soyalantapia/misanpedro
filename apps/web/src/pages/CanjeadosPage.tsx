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
  useEffect(() => {
    void syncMyActivations()
  }, [])
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
    // Bug #21: el conteo de comercios depende de couponMap (catálogo), así que
    // va en deps; y con fallback al nombre del snapshot para no decir "0
    // comercios" cuando el catálogo aún no cargó o el cupón se borró.
    const allMerchants = new Set(
      redemptions
        .map((r) => getCoupon(r.couponId)?.merchantId ?? r.merchantNombre)
        .filter(Boolean) as string[],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redemptions, couponMap])

  if (isLoading && localCoupons.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 animate-pulse rounded-full bg-fin-surface2" />
          <div className="h-9 w-36 animate-pulse rounded-2xl bg-fin-surface2" />
        </div>
        <div className="h-44 animate-pulse rounded-3xl bg-fin-surface" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-fin-surface" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-fin-ink sm:text-4xl">
          Canjeados
        </h1>
        <p className="text-sm text-fin-soft">
          Acá aparece cada cupón que usaste en un comercio adherido.
        </p>
      </header>

      {redemptions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin canjes todavía"
          description="Cuando uses tu primer cupón en un comercio, va a aparecer acá con la fecha y cuánto ahorraste."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-strong px-5 py-2.5 text-sm font-bold text-on-brand shadow-cta transition-all duration-200 hover:-translate-y-0.5"
            >
              <Sparkles size={14} /> Ver cupones
            </Link>
          }
        />
      ) : (
        <>
          <div className="bg-fin-mesh relative overflow-hidden rounded-3xl bg-fin-surface p-6 ring-1 ring-fin-line shadow-fin-card">
            <div className="absolute -right-6 -top-6 grid h-28 w-28 place-items-center rounded-full bg-fin-lime/10">
              <PiggyBank size={56} className="text-fin-lime/30" strokeWidth={1.4} />
            </div>
            <div className="relative">
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fin-surface2 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fin-lime">
                <PiggyBank size={11} /> Dinero ahorrado
              </div>
              <p className="mt-3 text-5xl font-black tabular-nums tracking-tight text-fin-ink sm:text-6xl">
                {formatMoney(summary.total)}
              </p>
              <p className="mt-1 text-sm text-fin-soft">
                Total acumulado con {summary.totalCount}{' '}
                {summary.totalCount === 1 ? 'canje' : 'canjes'} en {summary.totalMerchants}{' '}
                {summary.totalMerchants === 1 ? 'comercio' : 'comercios'}.
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-fin-line pt-3">
                <TrendingUp size={14} className="text-fin-lime" />
                <p className="text-xs text-fin-soft">
                  Este mes:{' '}
                  <span className="font-bold tabular-nums text-fin-ink">
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
              if (!r.redeemedAt) return null
              // Bug #3: si el cupón/comercio ya no está en el catálogo activo
              // (borrado/pausado/vencido), resolvemos desde el snapshot embebido
              // en la activación, así el canje histórico no desaparece.
              const titulo = c?.titulo ?? r.couponTitulo
              const porcentaje = c?.porcentaje ?? r.couponPorcentaje
              const merchantNombre = m?.nombre ?? r.merchantNombre
              const merchantCategoria = (m?.categoria ?? r.merchantCategoria) as any
              if (!titulo || !merchantNombre) {
                return isLoading ? (
                  <div key={r.id} className="h-20 animate-pulse rounded-2xl bg-fin-surface ring-1 ring-fin-line" />
                ) : null
              }
              const ahorro = r.ahorroEstimado ?? 0
              const ticket = r.montoTicket ?? 0
              const pagado = ticket > 0 ? Math.max(0, ticket - ahorro) : 0
              return (
                <div
                  key={r.id}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-up flex flex-col gap-2 rounded-2xl bg-fin-surface p-3 ring-1 ring-fin-line shadow-fin-card"
                >
                  <div className="flex items-center gap-3">
                    <CardImage categoria={merchantCategoria} className="h-12 w-12 rounded-xl" size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-fin-ink">{merchantNombre}</p>
                      <p className="text-xs text-fin-soft">
                        {formatRedeemedDate(r.redeemedAt)} · {titulo}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-fin-up">−{formatMoney(ahorro)}</p>
                      {porcentaje != null && (
                        <p className="text-[11px] font-semibold text-fin-faint">{porcentaje}% off</p>
                      )}
                    </div>
                  </div>
                  {ticket > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-fin-surface2 px-3 py-2 text-[11px]">
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-fin-faint">Ticket</span>
                        <span className="tabular-nums font-bold text-fin-soft">{formatMoney(ticket)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-fin-faint">Pagaste</span>
                        <span className="tabular-nums font-bold text-fin-ink">{formatMoney(pagado)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold uppercase tracking-wider text-fin-faint">Ahorraste</span>
                        <span className="tabular-nums font-bold text-fin-up">{formatMoney(ahorro)}</span>
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
