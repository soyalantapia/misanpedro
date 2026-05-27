import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ticket, Sparkles, RefreshCw, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { activationActions, useActivations, useUser } from '@/lib/stores'
import { getMerchant } from '@/data/mockData'
import { useCoupons } from '@/lib/couponsStore'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'

export function MisCuponesPage() {
  const allActivations = useActivations()
  const user = useUser()
  // Sólo mostramos activaciones del usuario actual. Si no hay user, mostramos
  // empty state (no filtramos vs el seed demo de otros vecinos).
  const activations = useMemo(
    () => (user ? allActivations.filter((a) => a.userId === user.id) : []),
    [allActivations, user],
  )
  const localCoupons = useCoupons()
  const apiCouponsRes = useApiCoupons()
  const apiMerchantsRes = useApiMerchants()

  const couponMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; titulo: string; porcentaje: number; merchantId: string }
    >()
    localCoupons.forEach((c) =>
      map.set(c.id, {
        id: c.id,
        titulo: c.titulo,
        porcentaje: c.porcentaje,
        merchantId: c.merchantId,
      }),
    )
    if (apiCouponsRes.data && apiMerchantsRes.data) {
      const idToSlug = new Map(apiMerchantsRes.data.map((m) => [m.id, m.slug]))
      apiCouponsRes.data.forEach((c) => {
        map.set(c.id, {
          id: c.id,
          titulo: c.titulo,
          porcentaje: c.porcentaje,
          merchantId: idToSlug.get(c.merchantId) ?? c.merchant?.slug ?? c.merchantId,
        })
      })
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
    return {
      id: apiM.slug,
      nombre: apiM.nombre,
      categoria: apiM.categoria as any,
      direccion: apiM.direccion,
      lat: apiM.lat ?? 0,
      lng: apiM.lng ?? 0,
      telefono: apiM.telefono,
      horarios: apiM.horarios,
      cover: apiM.cover,
      coverImageUrl: apiM.coverImageUrl,
      logoSeed: apiM.logoSeed,
    }
  }
  const navigate = useNavigate()
  const toast = useToast()

  const isLoading = apiCouponsRes.loading || apiMerchantsRes.loading

  const visible = useMemo(
    () =>
      activations.filter(
        (a) => a.status === 'activo' || a.status === 'expirado' || a.status === 'cancelado',
      ),
    [activations],
  )

  if (isLoading && localCoupons.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-accent-100" />
          <div className="h-9 w-48 animate-pulse rounded-2xl bg-neutral-200" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-white shadow-card" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  function handleReactivate(id: string) {
    const a = activationActions.reactivate(id)
    if (a) {
      toast.success('Cupón reactivado', 'Tenés 30 minutos para usarlo.')
      navigate(`/activacion/${a.id}`)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Ticket size={12} /> Pendientes de canjear
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Mis cupones
        </h1>
        <p className="text-sm text-neutral-500">
          Cada cupón activo tiene 30 minutos antes de expirar. Lo podés reactivar las veces que
          quieras.
        </p>
      </header>

      {visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Todavía no activaste ningún cupón"
          description="Cuando actives un descuento desde Descuentos, lo vas a ver acá con su QR y código."
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
        <div className="flex flex-col gap-3">
          {visible.map((a, i) => {
            const c = getCoupon(a.couponId)
            const m = c ? getMerchantBySlug(c.merchantId) : undefined
            if (!c || !m) return null

            const isActive = a.status === 'activo'
            const showAsActive = isActive

            return (
              <div
                key={a.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-up flex overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100"
              >
                <CardImage
                  categoria={m.categoria}
                  className="h-auto w-24 shrink-0"
                  size="sm"
                />
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        {m.nombre}
                      </p>
                      <p className="text-sm font-bold leading-tight text-neutral-900">
                        {c.titulo}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-accent-700 tabular-nums">
                      {c.porcentaje}%
                    </span>
                  </div>

                  <StatusLine status={a.status} />

                  <div className="mt-2 flex items-center gap-2">
                    {showAsActive ? (
                      <Link
                        to={`/activacion/${a.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-4 py-1.5 text-xs font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Ver QR <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(a.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-accent-700 ring-1 ring-accent-200 transition-all hover:-translate-y-0.5 hover:bg-accent-50"
                      >
                        <RefreshCw size={12} /> Reactivar
                      </button>
                    )}
                    <Link
                      to={`/cupon/${c.id}`}
                      className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
                    >
                      Detalle
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusLine({ status }: { status: string }) {
  if (status === 'cancelado') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
        <AlertCircle size={11} /> Cancelado · podés reactivarlo
      </p>
    )
  }
  if (status === 'expirado') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-status-error-fg">
        <AlertCircle size={11} /> Expirado · podés reactivarlo
      </p>
    )
  }
  if (status === 'activo') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-status-success-fg">
        <Clock size={11} /> Listo para canjear
      </p>
    )
  }
  return null
}
