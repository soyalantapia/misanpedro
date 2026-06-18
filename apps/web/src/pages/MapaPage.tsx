import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { MapPin, WifiOff, RotateCw } from 'lucide-react'
import { useApiMerchants, useApiCoupons } from '@/lib/apiQueries'
import { useGeolocation } from '@/lib/geo'
import { useTenant } from '@/lib/tenant'
import { CATEGORIAS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import type { ApiMerchant, ApiCoupon } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/cn'

const MerchantsMap = lazy(() => import('@/components/MerchantsMap'))

function apiMerchantToLocal(m: ApiMerchant): Merchant {
  return {
    id: m.slug,
    nombre: m.nombre,
    categoria: m.categoria as Categoria,
    direccion: m.direccion,
    lat: m.lat ?? 0,
    lng: m.lng ?? 0,
    telefono: m.telefono,
    horarios: m.horarios,
    horariosDetalle: m.horariosDetalle,
    cover: m.cover,
    coverImageUrl: m.coverImageUrl,
    mapsUrl: m.mapsUrl,
    logoSeed: m.logoSeed,
    destacado: m.destacado,
  }
}

function apiCouponToLocal(c: ApiCoupon, merchantSlug: string): Coupon {
  return {
    id: c.id,
    merchantId: merchantSlug,
    titulo: c.titulo,
    descripcion: c.descripcion,
    condiciones: c.condiciones ?? '',
    porcentaje: c.porcentaje,
    vigenciaHasta: c.vigenciaHasta,
    imagenSeed: 'custom',
    imagenUrl: c.imagenUrl ?? undefined,
    estado: c.estado as Coupon['estado'],
    diasAplica: c.diasAplica,
  }
}

export function MapaPage() {
  const tenant = useTenant()
  const { state: geo } = useGeolocation()
  const userCoords = geo.status === 'granted' ? geo.coords : null
  const merchantsRes = useApiMerchants()
  const couponsRes = useApiCoupons()

  const { merchants, coupons } = useMemo(() => {
    if (!merchantsRes.data || !couponsRes.data) {
      return { merchants: [] as Merchant[], coupons: [] as Coupon[] }
    }
    const ms = merchantsRes.data.map(apiMerchantToLocal)
    const idToSlug = new Map(merchantsRes.data.map((m) => [m.id, m.slug]))
    const cs = couponsRes.data
      .map((c) => {
        const slug = idToSlug.get(c.merchantId) ?? c.merchant?.slug
        return slug ? apiCouponToLocal(c, slug) : null
      })
      .filter((c): c is Coupon => c !== null)
    return { merchants: ms, coupons: cs }
  }, [merchantsRes.data, couponsRes.data])

  const loading = merchantsRes.loading || couponsRes.loading
  const apiError = merchantsRes.error || couponsRes.error
  const hasData = merchants.length > 0

  // Locales con ubicación y al menos un cupón activo (los que aparecen en el mapa).
  const locales = useMemo(() => {
    return merchants
      .filter((m) => m.lat && m.lng)
      .map((m) => {
        const own = coupons.filter((c) => c.merchantId === m.id && c.estado === 'activo')
        const maxPct = own.reduce((mx, c) => Math.max(mx, c.porcentaje), 0)
        return { m, maxPct, count: own.length }
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.maxPct - a.maxPct)
  }, [merchants, coupons])

  // Tap en la lista → el mapa vuela a ese local (y abre su popup).
  const [focus, setFocus] = useState<{ id: string; seq: number } | null>(null)
  const seqRef = useRef(0)
  const mapWrapRef = useRef<HTMLDivElement>(null)

  function focusMerchant(id: string) {
    seqRef.current += 1
    setFocus({ id, seq: seqRef.current })
    mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Si el API cae y no hay datos para mostrar, evitamos el mapa vacío y mudo.
  if (apiError && !hasData) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-16 pb-8 sm:px-6">
        <EmptyState
          icon={WifiOff}
          title="Sin conexión"
          description="No pudimos cargar el mapa. Revisá tu conexión y reintentá."
          action={
            <button
              type="button"
              onClick={() => {
                merchantsRes.refetch()
                couponsRes.refetch()
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

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-5 pb-8 sm:px-6 sm:pt-8">
      <div ref={mapWrapRef} className="scroll-mt-16">
        {loading && merchants.length === 0 ? (
          <div className="h-[68vh] w-full animate-pulse rounded-3xl bg-fin-surface ring-1 ring-fin-line" />
        ) : (
          <Suspense
            fallback={
              <div className="grid h-[68vh] place-items-center rounded-3xl bg-fin-surface ring-1 ring-fin-line">
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-fin-surface2" />
              </div>
            }
          >
            <MerchantsMap
              merchants={merchants}
              coupons={coupons}
              userCoords={userCoords}
              center={tenant.config?.geoCenter}
              focused={focus}
            />
          </Suspense>
        )}
      </div>
      <p className="px-1 text-center text-[11px] text-fin-faint">
        Tocá un comercio para ver sus cupones. Algunos comercios nuevos aparecen en el centro de la
        ciudad hasta que cargan su dirección exacta.
      </p>

      {/* Listado de locales — tocá uno para verlo en el mapa */}
      {locales.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          <h2 className="px-1 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            Locales en el mapa
          </h2>
          {locales.map(({ m, maxPct, count }) => {
            const catLabel = CATEGORIAS.find((c) => c.id === m.categoria)?.label ?? m.categoria
            const isFocused = focus?.id === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => focusMerchant(m.id)}
                aria-label={`Ver ${m.nombre} en el mapa`}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl bg-fin-surface p-3 text-left ring-1 transition-all duration-200',
                  isFocused
                    ? 'ring-2 ring-fin-lime'
                    : 'ring-fin-line hover:-translate-y-0.5 hover:ring-fin-lime/40',
                )}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fin-lime text-xs font-extrabold text-fin-bg shadow-fin-glow">
                  {maxPct > 0 ? `${maxPct}%` : '•'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-fin-ink">{m.nombre}</span>
                  <span className="block truncate text-[11px] text-fin-soft">
                    {catLabel} · {count} {count === 1 ? 'cupón' : 'cupones'}
                    {m.direccion ? ` · ${m.direccion}` : ''}
                  </span>
                </span>
                <MapPin
                  size={16}
                  className={cn('shrink-0', isFocused ? 'text-fin-lime' : 'text-fin-faint')}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
