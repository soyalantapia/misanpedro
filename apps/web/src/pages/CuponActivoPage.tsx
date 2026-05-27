import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ChevronLeft, Store, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { activationActions, useActivation } from '@/lib/stores'
import { getMerchant } from '@/data/mockData'
import { useCoupon } from '@/lib/couponsStore'
import { calcAhorro } from '@/lib/format'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { api, ApiError, tokens } from '@/lib/api'

export function CuponActivoPage() {
  const { id } = useParams<{ id: string }>()
  const activation = useActivation(id)
  const localCoupon = useCoupon(activation?.couponId)
  const apiCouponsRes = useApiCoupons()
  const apiMerchantsRes = useApiMerchants()
  const apiCoupon =
    !localCoupon && activation ? apiCouponsRes.data?.find((c) => c.id === activation.couponId) : null
  const coupon = localCoupon ?? (apiCoupon ? {
    id: apiCoupon.id,
    titulo: apiCoupon.titulo,
    porcentaje: apiCoupon.porcentaje,
    merchantId: apiCoupon.merchantId,
  } : undefined)

  const apiMerchant =
    apiCoupon && apiMerchantsRes.data
      ? apiMerchantsRes.data.find((m) => m.id === apiCoupon.merchantId)
      : null

  const merchant = (() => {
    if (localCoupon) return getMerchant(localCoupon.merchantId)
    if (apiMerchant) {
      return {
        nombre: apiMerchant.nombre,
        categoria: apiMerchant.categoria,
      } as any
    }
    return undefined
  })()

  const navigate = useNavigate()
  const toast = useToast()
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Polling: si la activación es de Mongo (API) y está activa, polleamos
  // cada 5s para detectar cuando el comercio confirme el canje. Cuando
  // detectamos status === 'canjeado' en el API, espejamos al store local
  // (lo que dispara RedemptionWatcher) y redirigimos a canjeados.
  // IMPORTANTE: este hook tiene que estar ANTES de cualquier early return
  // para no romper las Rules of Hooks.
  const pollIntervalRef = useRef<number | null>(null)
  useEffect(() => {
    if (!activation) return
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(activation.id)
    const userToken = tokens.get('user').access
    const isActiveStatus = activation.status === 'activo'
    if (!looksLikeMongoId || !userToken || !isActiveStatus) return

    let cancelled = false
    const actId = activation.id
    const couponPorcentaje = coupon?.porcentaje ?? 0
    // Limitamos a 72 ticks (≈6 min a 5s/tick). Pasado ese tiempo es poco probable
    // que el comercio confirme sin que el vecino ya se haya ido, y dejamos de
    // hacer llamadas innecesarias al servidor.
    let ticks = 0
    const MAX_TICKS = 72
    async function check() {
      if (++ticks > MAX_TICKS) {
        if (pollIntervalRef.current) {
          window.clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        return
      }
      try {
        const res = await api.activations.get(actId)
        if (cancelled) return
        if (res.activation.status === 'canjeado') {
          activationActions.markRedeemed(
            actId,
            res.activation.ahorroEstimado ?? calcAhorro(couponPorcentaje),
            res.activation.montoTicket,
          )
          toast.success('¡Cupón canjeado!', 'El comercio confirmó tu descuento.')
          navigate('/canjeados', { replace: true })
        }
      } catch {
        /* silencioso; volvemos a chequear en el próximo tick */
      }
    }
    pollIntervalRef.current = window.setInterval(check, 5000)
    return () => {
      cancelled = true
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation?.id, activation?.status])

  if (!activation) return <Navigate to="/mis-cupones" replace />
  const stillLoading = apiCouponsRes.loading || apiMerchantsRes.loading
  if (!coupon || !merchant) {
    if (stillLoading) return null
    return <Navigate to="/mis-cupones" replace />
  }

  const isExpired = activation.status !== 'activo'

  async function handleCancel() {
    if (!activation) return
    // Si hay token vecino y la activación parece de Mongo, cancelamos también en API
    const userToken = tokens.get('user').access
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(activation.id)
    if (userToken && looksLikeMongoId) {
      try {
        await api.activations.cancel(activation.id)
      } catch (err) {
        // si falla, igual cancelamos local para no dejar al user atascado
        if (!(err instanceof ApiError)) console.warn('[cancel] api error', err)
      }
    }
    activationActions.cancel(activation.id)
    toast.info('Cupón cancelado', 'Lo podés volver a activar desde Mis cupones.')
    navigate('/mis-cupones', { replace: true })
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/mis-cupones"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Mis cupones
      </Link>

      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
          {merchant.nombre}
        </p>
        <p className="text-5xl font-bold text-accent-700 tabular-nums">{coupon.porcentaje}%</p>
        <p className="text-xs font-extrabold tracking-widest text-accent-500">OFF</p>
        <h1 className="mt-1 text-lg font-bold leading-tight text-neutral-900">{coupon.titulo}</h1>
      </header>

      <div className="flex flex-col items-center gap-4">
        <QRDisplay payload={activation.qrPayload} />
        <Divider label="o usá el código" />
        <p className="font-mono text-4xl font-bold tracking-[0.25em] tabular-nums text-neutral-900">
          {formatCode(activation.codigoNumerico)}
        </p>
        <p className="max-w-xs text-center text-xs text-neutral-500">
          Mostrá este código en {merchant.nombre}. Se canjea una sola vez.
        </p>
        <p className="max-w-xs text-center text-[11px] text-neutral-400">
          Sin tiempo límite — el código vale hasta que lo uses.
        </p>
      </div>

      {!isExpired && (
        <div className="rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
          <div className="flex items-start gap-2">
            <Store size={16} className="mt-0.5 shrink-0 text-accent-500" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold">
                Mostrale este código al encargado de {merchant.nombre}
              </p>
              <p className="text-[11px] leading-relaxed">
                Cuando lo valide, esta pantalla se actualiza automáticamente y el cupón
                queda en tu historial. No tenés que hacer nada más.
              </p>
            </div>
          </div>
        </div>
      )}

      {isExpired ? (
        <Link
          to="/mis-cupones"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-neutral-700 shadow-card ring-1 ring-neutral-100 transition-all hover:bg-primary-100"
        >
          <ChevronLeft size={16} />
          Volver a mis cupones
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-neutral-700 shadow-card ring-1 ring-neutral-100 transition-all hover:bg-status-error-bg hover:text-status-error-fg"
        >
          <X size={16} />
          Cancelar cupón
        </button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar este cupón?"
        description="Lo vas a poder reactivar después desde Mis cupones."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        variant="danger"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false)
          handleCancel()
        }}
      />
    </div>
  )
}

function QRDisplay({ payload }: { payload: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(
      canvasRef.current,
      payload,
      { width: 240, margin: 1, color: { dark: '#14211B', light: '#ffffff' } },
      (err) => {
        if (err) setError(err.message)
      },
    )
  }, [payload])

  if (error) {
    return (
      <div className="grid h-60 w-60 place-items-center rounded-2xl bg-status-error-bg text-xs font-medium text-status-error-fg">
        No se pudo generar el QR
      </div>
    )
  }
  return (
    <div className="rounded-3xl bg-white p-6 shadow-floating ring-1 ring-neutral-100">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Código QR para canje del cupón"
        className="block"
      />
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
      <span className="h-px flex-1 bg-neutral-200" />
      {label}
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  )
}

function formatCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`
  return code
}
