import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Phone, Clock, ExternalLink } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { CouponCard } from '@/components/CouponCard'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { CATEGORIAS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import { formatHorariosSemana } from '@/lib/format'
import { useApiMerchant } from '@/lib/apiQueries'

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const localMerchant = useMerchant(id)
  const localCoupons = useCouponsByMerchant(id ?? '')
  // El id en la URL es el slug del merchant; el endpoint público acepta slug.
  const apiRes = useApiMerchant(id)
  const apiMerchant = apiRes.data?.merchant ?? null
  const apiCoupons = apiRes.data?.coupons ?? null

  const merchant: Merchant | undefined = apiMerchant
    ? {
        id: apiMerchant.slug,
        nombre: apiMerchant.nombre,
        categoria: apiMerchant.categoria as Categoria,
        direccion: apiMerchant.direccion,
        lat: apiMerchant.lat ?? 0,
        lng: apiMerchant.lng ?? 0,
        telefono: apiMerchant.telefono,
        horarios: apiMerchant.horarios,
        horariosDetalle: apiMerchant.horariosDetalle,
        cover: apiMerchant.cover,
        coverImageUrl: apiMerchant.coverImageUrl,
        mapsUrl: apiMerchant.mapsUrl,
        logoSeed: apiMerchant.logoSeed,
        destacado: apiMerchant.destacado,
      }
    : localMerchant

  const coupons: Coupon[] = apiCoupons
    ? apiCoupons.map((c: any) => ({
        id: c.id,
        merchantId: apiMerchant?.slug ?? id ?? '',
        titulo: c.titulo,
        descripcion: c.descripcion,
        condiciones: c.condiciones ?? '',
        porcentaje: c.porcentaje,
        vigenciaHasta: c.vigenciaHasta,
        imagenSeed: 'custom',
        estado: c.estado as Coupon['estado'],
        diasAplica: c.diasAplica,
      }))
    : localCoupons.filter((c) => c.estado === 'activo')

  // Si la consulta del API terminó (no loading) y no hay merchant local ni del API,
  // redirigimos al home.
  if (!merchant && !apiRes.loading) return <Navigate to="/" replace />
  if (!merchant) return null

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const mapsUrl =
    merchant.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.nombre}, ${merchant.direccion}`)}`
  const horariosDisplay =
    formatHorariosSemana(merchant.horariosDetalle) || merchant.horarios

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col">
      <div className="relative">
        <CardImage
          categoria={merchant.categoria}
          coverImageUrl={merchant.coverImageUrl}
          className="h-44 w-full sm:h-56"
          size="lg"
        />
        <Link
          to="/"
          aria-label="Volver"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-neutral-700 shadow-card backdrop-blur transition-all hover:-translate-y-0.5 hover:text-neutral-900"
        >
          <ChevronLeft size={20} />
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">{cat}</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            {merchant.nombre}
          </h1>
        </header>

        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100 text-sm text-neutral-700">
          <Row icon={MapPin}>{merchant.direccion}</Row>
          {merchant.telefono && (
            <Row icon={Phone}>
              <a
                href={`tel:${merchant.telefono.replace(/\s/g, '')}`}
                className="font-medium text-accent-700 hover:underline"
              >
                {merchant.telefono}
              </a>
            </Row>
          )}
          {horariosDisplay && <Row icon={Clock}>{horariosDisplay}</Row>}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-600"
          >
            Abrir en Google Maps <ExternalLink size={12} />
          </a>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Descuentos disponibles
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {coupons.map((c, i) => (
              <CouponCard key={c.id} coupon={c} merchant={merchant} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-neutral-400" />
      <span>{children}</span>
    </div>
  )
}
