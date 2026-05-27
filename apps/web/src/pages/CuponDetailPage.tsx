import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { useCoupon } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { CATEGORIAS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import { activationActions, useActivationByCoupon, useUser } from '@/lib/stores'
import { formatHorariosSemana, formatVigencia } from '@/lib/format'
import { api, ApiError, tokens } from '@/lib/api'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { useToast } from '@/components/Toast'

export function CuponDetailPage() {
  const { id } = useParams<{ id: string }>()
  const localCoupon = useCoupon(id)
  const localMerchant = useMerchant(localCoupon?.merchantId)
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()

  // Fallback al API si no encontramos en el store local
  const apiCouponsRes = useApiCoupons()
  const apiMerchantsRes = useApiMerchants()
  const apiCoupon = apiCouponsRes.data?.find((c) => c.id === id) ?? null
  const apiMerchantRaw =
    apiCoupon && apiMerchantsRes.data
      ? apiMerchantsRes.data.find((m) => m.id === apiCoupon.merchantId)
      : null

  const coupon: Coupon | undefined = apiCoupon
    ? {
        id: apiCoupon.id,
        merchantId: apiMerchantRaw?.slug ?? apiCoupon.merchantId,
        titulo: apiCoupon.titulo,
        descripcion: apiCoupon.descripcion,
        condiciones: apiCoupon.condiciones ?? '',
        porcentaje: apiCoupon.porcentaje,
        vigenciaHasta: apiCoupon.vigenciaHasta,
        imagenSeed: 'custom',
        estado: apiCoupon.estado as Coupon['estado'],
        diasAplica: apiCoupon.diasAplica,
      }
    : localCoupon

  const merchant: Merchant | undefined = apiMerchantRaw
    ? {
        id: apiMerchantRaw.slug,
        nombre: apiMerchantRaw.nombre,
        categoria: apiMerchantRaw.categoria as Categoria,
        direccion: apiMerchantRaw.direccion,
        lat: apiMerchantRaw.lat ?? 0,
        lng: apiMerchantRaw.lng ?? 0,
        telefono: apiMerchantRaw.telefono,
        horarios: apiMerchantRaw.horarios,
        horariosDetalle: apiMerchantRaw.horariosDetalle,
        cover: apiMerchantRaw.cover,
        coverImageUrl: apiMerchantRaw.coverImageUrl,
        mapsUrl: apiMerchantRaw.mapsUrl,
        logoSeed: apiMerchantRaw.logoSeed,
      }
    : localMerchant

  // Activación existente (siempre busca en local — el ApiSync ya espejó las
  // activaciones del API al store local).
  const existing = useActivationByCoupon(coupon?.id)

  if ((!coupon || !merchant) && !apiCouponsRes.loading && !apiMerchantsRes.loading) {
    return <Navigate to="/" replace />
  }
  if (!coupon || !merchant) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="h-56 w-full animate-pulse bg-neutral-200 sm:h-64" />
        <div className="flex flex-col gap-4 px-4 pt-12 pb-32 sm:px-6">
          <div className="h-3 w-28 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-7 w-3/4 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-neutral-200" />
          <div className="mt-2 flex flex-col gap-2.5">
            <div className="h-3 w-full animate-pulse rounded-full bg-neutral-200" />
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-3 w-4/6 animate-pulse rounded-full bg-neutral-200" />
          </div>
        </div>
      </div>
    )
  }

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria

  async function handleActivate() {
    if (!coupon) return
    if (!user) {
      navigate(`/registro?next=${encodeURIComponent(`/cupon/${coupon.id}/activar`)}`)
      return
    }
    if (existing) {
      navigate(`/activacion/${existing.id}`)
      return
    }

    // Activación contra el API. El couponId del API es ObjectId 24-hex.
    // Si no es un id válido para API, mostramos error en lugar de fallback local.
    const userToken = tokens.get('user').access
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(coupon.id)
    if (!userToken || !looksLikeMongoId) {
      // No hay sesión API (probable demo offline). Activación local sólo
      // para que el flujo demo funcione; en producción esto no debería ocurrir.
      const a = activationActions.activate(coupon.id)
      navigate(`/activacion/${a.id}`)
      return
    }
    try {
      const data = await api.activations.create(coupon.id)
      // Espejamos al store local para que CuponActivoPage / MisCuponesPage
      // lo encuentren con el mismo id de Mongo.
      const local = activationActions.activate(coupon.id, {
        id: data.activation.id,
        codigoNumerico: data.activation.codigoNumerico,
        qrPayload: data.activation.qrPayload,
      })
      navigate(`/activacion/${local.id}`)
    } catch (err) {
      toast.error(
        'No se pudo activar el cupón',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
    }
  }

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
          className="h-56 w-full sm:h-64"
          size="lg"
        />
        <Link
          to="/"
          aria-label="Volver"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-neutral-700 shadow-card backdrop-blur transition-all hover:-translate-y-0.5 hover:text-neutral-900"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="absolute -bottom-5 left-4 inline-flex items-center rounded-full bg-white px-4 py-2 shadow-floating">
          <span className="font-bold text-accent-700 tabular-nums">
            <span className="text-2xl">{coupon.porcentaje}%</span>
            <span className="ml-1 text-[10px] font-extrabold tracking-widest">OFF</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-12 pb-32 sm:px-6">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
            {merchant.nombre} · {cat}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
            {coupon.titulo}
          </h1>
          <p className="text-xs font-medium text-neutral-500">
            {formatVigencia(coupon.vigenciaHasta)}
          </p>
        </header>

        <Section title="Descripción" body={coupon.descripcion} />
        <Section title="Cómo usarlo" body={coupon.condiciones} />
        {coupon.diasAplica && (
          <div className="flex items-start gap-3 rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
            <Clock size={16} className="mt-0.5 shrink-0 text-accent-500" />
            <p className="text-xs font-medium">
              <span className="font-bold">Aplica:</span> {coupon.diasAplica}
            </p>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Información del comercio
          </h2>
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
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handleActivate}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98]"
          >
            {existing ? 'Ver mi cupón activo' : 'Canjear descuento'}
            <ArrowRight size={18} />
          </button>
          {!user && (
            <p className="px-2 text-center text-[11px] text-neutral-500">
              Te vamos a pedir tus datos una sola vez. Solo al primer canje.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <div>
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {title}
      </h2>
      <p className="text-sm leading-relaxed text-neutral-700">{body}</p>
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
