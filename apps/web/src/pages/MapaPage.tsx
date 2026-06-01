import { lazy, Suspense, useMemo } from 'react'
import { useApiMerchants, useApiCoupons } from '@/lib/apiQueries'
import { useGeolocation } from '@/lib/geo'
import { useTenant } from '@/lib/tenant'
import { type Categoria, type Coupon, type Merchant } from '@/lib/types'
import type { ApiMerchant, ApiCoupon } from '@/lib/api'

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

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-5 pb-8 sm:px-6 sm:pt-8">
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
          />
        </Suspense>
      )}
      <p className="px-1 text-center text-[11px] text-fin-faint">
        Tocá un comercio para ver sus cupones. Algunos comercios nuevos aparecen en el centro de la
        ciudad hasta que cargan su dirección exacta.
      </p>
    </div>
  )
}
