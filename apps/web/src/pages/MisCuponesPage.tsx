import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ticket, Sparkles, RefreshCw, ArrowRight, Clock, AlertCircle, WifiOff, RotateCw } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { activationActions, demoStoreActions, useActivations, useUser } from '@/lib/stores'
import type { Activation } from '@/lib/types'
import { getMerchant } from '@/data/mockData'
import { useCoupons } from '@/lib/couponsStore'
import { verActivacion } from '@/lib/activacionVista'
import { api, ApiError } from '@/lib/api'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { syncMyActivations } from '@/lib/syncActivations'

export function MisCuponesPage() {
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
    const map = new Map<
      string,
      { id: string; titulo: string; porcentaje: number; merchantId: string }
    >()
    // PM-elite T4: en PROD el catálogo mock no resuelve detalles (datos fantasma);
    // solo lo usamos en dev/demo. Las activaciones del vecino (su billetera) son
    // reales/locales y se siguen mostrando igual.
    if (!import.meta.env.PROD) {
      localCoupons.forEach((c) =>
        map.set(c.id, {
          id: c.id,
          titulo: c.titulo,
          porcentaje: c.porcentaje,
          merchantId: c.merchantId,
        }),
      )
    }
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
    // PM-elite T4: en PROD no usamos el merchant mock; solo datos del API.
    if (!import.meta.env.PROD) {
      const local = getMerchant(slug)
      if (local) return local
    }
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
  const [reactivating, setReactivating] = useState<string | null>(null)

  const isLoading = apiCouponsRes.loading || apiMerchantsRes.loading
  // PM-elite T4: en PROD no hay fallback mock. Si el API falló, sin estos datos
  // las tarjetas quedarían en skeleton infinito → mostramos "sin conexión".
  const apiError = apiCouponsRes.error || apiMerchantsRes.error
  const apiFailed = import.meta.env.PROD && !!apiError && localCoupons.length === 0

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
          <div className="h-4 w-32 animate-pulse rounded-full bg-fin-surface2" />
          <div className="h-9 w-48 animate-pulse rounded-2xl bg-fin-surface2" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-fin-surface" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (apiFailed) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-16 pb-8 sm:px-6">
        <EmptyState
          icon={WifiOff}
          title="Sin conexión"
          description="No pudimos cargar tus cupones. Revisá tu conexión y reintentá."
          action={
            <button
              type="button"
              onClick={() => {
                apiCouponsRes.refetch()
                apiMerchantsRes.refetch()
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-fin-lime px-5 py-3 text-sm font-bold text-fin-bg transition-all hover:-translate-y-0.5"
            >
              <RotateCw size={16} /> Reintentar
            </button>
          }
        />
      </div>
    )
  }

  async function handleReactivate(activationId: string, couponId: string) {
    if (reactivating) return
    setReactivating(activationId)
    const isMongoId = /^[0-9a-f]{24}$/i.test(couponId)
    if (isMongoId) {
      try {
        const res = await api.activations.create(couponId)
        const a = res.activation
        const local: Activation = {
          id: a.id,
          couponId: a.couponId,
          userId: a.userId,
          codigoNumerico: a.codigoNumerico,
          qrPayload: a.qrPayload,
          activatedAt: a.activatedAt,
          expiresAt: a.expiresAt ?? undefined,
          status: a.status,
          redeemedAt: a.redeemedAt,
          ahorroEstimado: a.ahorroEstimado,
          montoTicket: a.montoTicket,
        }
        demoStoreActions.upsertActivation(local)
        toast.success('Cupón reactivado', 'Tenés el código listo para usar.')
        navigate(`/activacion/${a.id}`)
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'No se pudo reactivar el cupón. Revisá tu conexión.'
        toast.error('No disponible', msg)
      } finally {
        setReactivating(null)
      }
    } else {
      const a = activationActions.reactivate(activationId)
      setReactivating(null)
      if (a) {
        toast.success('Cupón reactivado', 'Tenés el código listo para usar.')
        navigate(`/activacion/${a.id}`)
      }
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-fin-ink sm:text-4xl">
          Mis cupones
        </h1>
        <p className="text-sm text-fin-soft">
          Acá ves los cupones que activaste y todavía no canjeaste. Si alguno expiró, lo
          podés reactivar.
        </p>
      </header>

      {visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Todavía no activaste ningún cupón"
          description="Cuando actives un cupón desde Cupones, lo vas a ver acá con su QR y código."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime px-5 py-2.5 text-sm font-bold text-fin-bg shadow-fin-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <Sparkles size={14} /> Ver cupones
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((a, i) => {
            const c = getCoupon(a.couponId)
            const m = c ? getMerchantBySlug(c.merchantId) : undefined
            // El catálogo trae SOLO cupones activos y vigentes. Si el comercio borró
            // o pausó el cupón, acá antes se devolvía un esqueleto `animate-pulse`
            // que latía para siempre: el vecino veía una tarjeta gris eterna en su
            // billetera. El snapshot de la activación resuelve el caso (mismo patrón
            // que ya usaba CanjeadosPage). Ver lib/activacionVista.ts. [cazabug loop2]
            const vista = verActivacion({
              cupon: c,
              comercio: m,
              activacion: a,
              catalogoCargando: apiCouponsRes.loading || apiMerchantsRes.loading,
            })
            if (vista.tipo === 'cargando') {
              return (
                <div
                  key={a.id}
                  className="h-24 animate-pulse rounded-3xl bg-fin-surface ring-1 ring-fin-line"
                />
              )
            }
            if (vista.tipo === 'sin-datos') {
              return (
                <div
                  key={a.id}
                  className="rounded-3xl bg-fin-surface p-4 ring-1 ring-fin-line"
                >
                  <p className="text-sm font-bold text-fin-ink">Cupón ya no disponible</p>
                  <p className="mt-0.5 text-xs text-fin-soft">
                    El comercio lo dio de baja. Tu código {a.codigoNumerico} ya no se puede usar.
                  </p>
                </div>
              )
            }

            const isActive = a.status === 'activo'
            const showAsActive = isActive

            return (
              <div
                key={a.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-up flex overflow-hidden rounded-3xl bg-fin-surface ring-1 ring-fin-line shadow-fin-card"
              >
                <CardImage
                  categoria={m?.categoria ?? a.merchantCategoria ?? 'otro'}
                  className="h-auto w-24 shrink-0"
                  size="sm"
                />
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-fin-faint">
                        {vista.merchantNombre}
                      </p>
                      <p className="text-sm font-bold leading-tight text-fin-ink">{vista.titulo}</p>
                    </div>
                    <span className="shrink-0 font-bold text-fin-lime tabular-nums">
                      {vista.porcentaje}%
                    </span>
                  </div>

                  <StatusLine status={a.status} />

                  <div className="mt-2 flex items-center gap-2">
                    {showAsActive ? (
                      <Link
                        to={`/activacion/${a.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime px-4 py-1.5 text-xs font-bold text-fin-bg shadow-fin-glow transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Ver QR <ArrowRight size={12} />
                      </Link>
                    ) : vista.cuponVigente ? (
                      <button
                        type="button"
                        onClick={() => handleReactivate(a.id, a.couponId)}
                        disabled={reactivating === a.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-fin-surface2 px-4 py-1.5 text-xs font-bold text-fin-lime ring-1 ring-fin-line transition-all hover:-translate-y-0.5 hover:text-fin-ink disabled:opacity-60"
                      >
                        <RefreshCw size={12} className={reactivating === a.id ? 'animate-spin' : ''} />
                        {reactivating === a.id ? 'Activando…' : 'Reactivar'}
                      </button>
                    ) : (
                      // Sin cupón vigente, "Reactivar" siempre falla ("cupón no
                      // disponible"): se lo decimos en vez de ofrecer un botón roto.
                      <span className="text-xs font-semibold text-fin-faint">
                        Ya no disponible
                      </span>
                    )}
                    {vista.cuponVigente && c ? (
                      <Link
                        to={`/cupon/${c.id}`}
                        className="text-xs font-semibold text-fin-soft hover:text-fin-ink"
                      >
                        Detalle
                      </Link>
                    ) : null}
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
      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-fin-faint">
        <AlertCircle size={11} /> Cancelado · podés reactivarlo
      </p>
    )
  }
  if (status === 'expirado') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-fin-danger">
        <AlertCircle size={11} /> Expirado · podés reactivarlo
      </p>
    )
  }
  if (status === 'activo') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-fin-up">
        <Clock size={11} /> Listo para canjear
      </p>
    )
  }
  return null
}
