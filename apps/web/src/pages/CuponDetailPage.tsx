import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  ArrowRight,
  Share2,
} from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { useCoupon } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { CATEGORIAS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import { activationActions, useActivationByCoupon, useUser } from '@/lib/stores'
import { formatHorariosSemana, formatVigencia, calcAhorro, formatMoney } from '@/lib/format'
import { api, ApiError, tokens } from '@/lib/api'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { useUsoEstado, textoDisponible } from '@/lib/usoLimite'
import { useToast } from '@/components/Toast'

export function CuponDetailPage() {
  const { id } = useParams<{ id: string }>()
  const localCoupon = useCoupon(id)
  const localMerchant = useMerchant(localCoupon?.merchantId)
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const apiCouponsRes = useApiCoupons()
  const apiMerchantsRes = useApiMerchants()
  const getUsoEstado = useUsoEstado()
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
        imagenUrl: apiCoupon.imagenUrl ?? undefined,
        estado: apiCoupon.estado as Coupon['estado'],
        diasAplica: apiCoupon.diasAplica,
        usoMaxPorPersona: apiCoupon.usoMaxPorPersona,
        usoVentana: apiCoupon.usoVentana,
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

  const existing = useActivationByCoupon(coupon?.id)

  if ((!coupon || !merchant) && !apiCouponsRes.loading && !apiMerchantsRes.loading) {
    return <Navigate to="/" replace />
  }
  if (!coupon || !merchant) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="h-56 w-full animate-pulse bg-fin-surface2 sm:h-64" />
        <div className="flex flex-col gap-4 px-4 pt-12 pb-32 sm:px-6">
          <div className="h-3 w-28 animate-pulse rounded-full bg-fin-surface2" />
          <div className="h-7 w-3/4 animate-pulse rounded-xl bg-fin-surface2" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-fin-surface2" />
          <div className="mt-2 flex flex-col gap-2.5">
            <div className="h-3 w-full animate-pulse rounded-full bg-fin-surface2" />
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-fin-surface2" />
            <div className="h-3 w-4/6 animate-pulse rounded-full bg-fin-surface2" />
          </div>
        </div>
      </div>
    )
  }

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const ahorroEstimado = coupon.precioReferencia
    ? Math.round((coupon.precioReferencia * coupon.porcentaje) / 100)
    : calcAhorro(coupon.porcentaje)
  const uso = getUsoEstado(coupon)
  // Si tiene una activación activa (código sin canjear), lo dejamos verla.
  const bloqueado = uso.bloqueado && !existing
  const dispoTxt = bloqueado ? textoDisponible(uso.nextDisponible) : null

  async function handleActivate() {
    if (!coupon) return
    if (!user) {
      navigate(`/datos?next=${encodeURIComponent(`/cupon/${coupon.id}/activar`)}`)
      return
    }
    if (existing) {
      navigate(`/activacion/${existing.id}`)
      return
    }

    setSubmitting(true)
    const userToken = tokens.get('user').access
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(coupon.id)
    if (!userToken || !looksLikeMongoId) {
      const a = activationActions.activate(coupon.id)
      navigate(`/activacion/${a.id}`)
      return
    }
    try {
      const data = await api.activations.create(coupon.id)
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
      setSubmitting(false)
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
          coverImageUrl={coupon?.imagenUrl ?? merchant.coverImageUrl}
          className="h-56 w-full sm:h-64"
          size="lg"
        />
        <Link
          to="/"
          aria-label="Volver"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-fin-bg text-fin-ink shadow-fin-card ring-1 ring-fin-line transition-all hover:-translate-y-0.5"
        >
          <ChevronLeft size={20} />
        </Link>
        <ShareButton
          title={`${coupon.porcentaje}% off en ${merchant.nombre}`}
          text={`Mirá este descuento: ${coupon.titulo}`}
        />
        <div className="absolute -bottom-5 left-4 inline-flex items-center rounded-full bg-fin-surface px-4 py-2 ring-1 ring-fin-line shadow-fin-card">
          <span className="font-bold text-fin-lime tabular-nums">
            <span className="text-2xl">{coupon.porcentaje}%</span>
            <span className="ml-1 text-[10px] font-extrabold tracking-widest">OFF</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-12 pb-32 sm:px-6">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
            {merchant.nombre} · {cat}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-fin-ink sm:text-3xl">
            {coupon.titulo}
          </h1>
          <p className="text-xs font-medium text-fin-soft">{formatVigencia(coupon.vigenciaHasta)}</p>
        </header>

        <div className="rounded-2xl border border-fin-up/25 bg-fin-up/10 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-fin-soft">Con este cupón ahorrás</p>
          <p className="text-2xl font-extrabold text-fin-up">~{formatMoney(ahorroEstimado)}</p>
        </div>

        <Section title="Descripción" body={coupon.descripcion} />
        <Section title="Cómo usarlo" body={coupon.condiciones} />
        {coupon.diasAplica && (
          <div className="flex items-start gap-3 rounded-2xl bg-fin-surface2 p-4 text-fin-soft ring-1 ring-fin-line">
            <Clock size={16} className="mt-0.5 shrink-0 text-fin-lime" />
            <p className="text-xs font-medium">
              <span className="font-bold text-fin-ink">Aplica:</span> {coupon.diasAplica}
            </p>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
            Información del comercio
          </h2>
          <div className="flex flex-col gap-2 rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line shadow-fin-card text-sm text-fin-soft">
            <Row icon={MapPin}>{merchant.direccion}</Row>
            {merchant.telefono && (
              <Row icon={Phone}>
                <a
                  href={`tel:${merchant.telefono.replace(/\s/g, '')}`}
                  className="font-medium text-fin-lime hover:underline"
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
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-fin-lime hover:text-fin-lime2"
            >
              Abrir en Google Maps <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-fin-line bg-fin-surface/95 backdrop-blur-xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handleActivate}
            disabled={submitting || bloqueado}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold transition-all duration-200 disabled:opacity-70 ${
              bloqueado
                ? 'bg-fin-surface2 text-fin-soft'
                : 'bg-fin-lime text-fin-bg shadow-fin-glow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
            }`}
          >
            {submitting ? 'Activando…' : bloqueado ? 'Ya lo usaste' : existing ? 'Ver mi cupón activo' : 'Canjear descuento'}
            {!bloqueado && <ArrowRight size={18} />}
          </button>
          {bloqueado && dispoTxt && (
            <p className="px-2 text-center text-[11px] font-semibold text-fin-soft">{dispoTxt}</p>
          )}
          {!user && !bloqueado && (
            <p className="px-2 text-center text-[11px] text-fin-soft">
              Te vamos a pedir tus datos una sola vez. Solo al primer canje.
            </p>
          )}
        </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function ShareButton({ title, text }: { title: string; text: string }) {
  const [supported, setSupported] = useState(false)
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (supported) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        /* user canceló — silencioso */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copiado', 'Pegalo donde quieras compartir el descuento.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar', 'Copialo manualmente desde la barra del browser.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Compartir descuento"
      className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-fin-bg text-fin-ink shadow-fin-card ring-1 ring-fin-line transition-all hover:-translate-y-0.5 hover:text-fin-lime"
    >
      {copied ? <span className="text-xs font-bold">✓</span> : <Share2 size={18} />}
    </button>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <div>
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        {title}
      </h2>
      <p className="text-sm leading-relaxed text-fin-soft">{body}</p>
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
      <Icon size={14} className="mt-0.5 shrink-0 text-fin-faint" />
      <span>{children}</span>
    </div>
  )
}
