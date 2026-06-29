import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ChevronLeft, Store, X, Copy, Check, WifiOff, RotateCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { activationActions, useActivation } from '@/lib/stores'
import { getMerchant } from '@/data/mockData'
import { useCoupon } from '@/lib/couponsStore'
import { useApiCoupons, useApiMerchants } from '@/lib/apiQueries'
import { api, ApiError, tokens } from '@/lib/api'
import { syncMyActivations } from '@/lib/syncActivations'

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
  // Bug #5: cuando el polling automático se agota (6 min sin confirmación),
  // dejamos de prometer "se actualiza solo" y ofrecemos un botón para chequear.
  const [pollExhausted, setPollExhausted] = useState(false)

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!activation?.expiresAt) return
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [activation?.expiresAt])

  const pollIntervalRef = useRef<number | null>(null)
  useEffect(() => {
    if (!activation) return
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(activation.id)
    const userToken = tokens.get('user').access
    const isActiveStatus = activation.status === 'activo'
    if (!looksLikeMongoId || !userToken || !isActiveStatus) return

    let cancelled = false
    const actId = activation.id
    let ticks = 0
    const MAX_TICKS = 72
    async function check() {
      try {
        const res = await api.activations.get(actId)
        if (cancelled) return false
        if (res.activation.status === 'canjeado') {
          activationActions.markRedeemed(
            actId,
            res.activation.ahorroEstimado ?? 0,
            res.activation.montoTicket,
          )
          toast.success('¡Cupón canjeado!', 'El comercio confirmó tu cupón.')
          navigate('/canjeados', { replace: true })
          return true
        }
      } catch {
        /* silencioso; volvemos a chequear en el próximo tick */
      }
      return false
    }
    function tick() {
      if (++ticks > MAX_TICKS) {
        if (pollIntervalRef.current) {
          window.clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        // No cortamos en seco la promesa: avisamos que dejamos de chequear solo.
        if (!cancelled) setPollExhausted(true)
        return
      }
      void check()
    }
    pollIntervalRef.current = window.setInterval(tick, 5000)
    setPollExhausted(false)
    // Bug #5: al volver el foco al tab (común en mobile en la caja), re-chequeamos
    // de una y reiniciamos el contador del poll si seguía agotado.
    function onVisible() {
      if (document.hidden || cancelled) return
      ticks = 0
      void check()
      if (!pollIntervalRef.current) {
        setPollExhausted(false)
        pollIntervalRef.current = window.setInterval(tick, 5000)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation?.id, activation?.status])

  if (!activation) return <Navigate to="/" replace />
  const stillLoading = apiCouponsRes.loading || apiMerchantsRes.loading
  const apiError = apiCouponsRes.error || apiMerchantsRes.error
  if (!coupon || !merchant) {
    if (stillLoading) return null
    // El cupón vive en el backend (no en el store local) y la API falló:
    // mostramos "Sin conexión" con Reintentar en vez de mandar al inicio.
    if (apiError) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-16 pb-8 sm:px-6">
          <EmptyState
            icon={WifiOff}
            title="Sin conexión"
            description="No pudimos cargar tu cupón. Revisá tu conexión y reintentá."
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
    return <Navigate to="/" replace />
  }

  const isExpired = activation.status !== 'activo'

  // El polling que auto-actualiza la pantalla sólo corre con backend real
  // (id tipo Mongo + token de usuario). En el flujo demo/local no arranca,
  // así que sólo prometemos la actualización automática cuando es real.
  const livePollingActive =
    !isExpired &&
    /^[0-9a-f]{24}$/i.test(activation.id) &&
    !!tokens.get('user').access

  async function handleCancel() {
    if (!activation) return
    const userToken = tokens.get('user').access
    const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(activation.id)
    if (userToken && looksLikeMongoId) {
      try {
        await api.activations.cancel(activation.id)
      } catch (err) {
        if (!(err instanceof ApiError)) console.warn('[cancel] api error', err)
      }
    }
    activationActions.cancel(activation.id)
    toast.info('Cupón cancelado', 'Lo podés volver a activar desde Cupones.')
    navigate('/', { replace: true })
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-fin-soft hover:text-fin-ink"
      >
        <ChevronLeft size={16} /> Inicio
      </Link>

      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">
          {merchant.nombre}
        </p>
        <p className="text-5xl font-black text-fin-lime tabular-nums">{coupon.porcentaje}%</p>
        <p className="text-xs font-extrabold tracking-widest text-fin-lime">OFF</p>
        <h1 className="mt-1 text-lg font-bold leading-tight text-fin-ink">{coupon.titulo}</h1>
      </header>

      <div className="flex flex-col items-center gap-4">
        <QRDisplay payload={activation.qrPayload} />
        <Divider label="o usá el código" />
        <div className="flex flex-col items-center gap-2">
          <p className="font-mono text-4xl font-bold tracking-[0.25em] tabular-nums text-fin-ink">
            {formatCode(activation.codigoNumerico)}
          </p>
          <CopyCodeButton code={activation.codigoNumerico} />
        </div>
        <p className="max-w-xs text-center text-xs text-fin-soft">
          Mostrá este código en {merchant.nombre}. Se canjea una sola vez.
        </p>
        <ExpiryHint expiresAt={activation.expiresAt} nowMs={nowMs} isActive={!isExpired} />
      </div>

      {!isExpired && (
        <div className="rounded-2xl bg-fin-surface2 p-4 text-fin-soft ring-1 ring-fin-line">
          <div className="flex items-start gap-2">
            <Store size={16} className="mt-0.5 shrink-0 text-fin-lime" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-fin-ink">
                Mostrale este código al encargado de {merchant.nombre}
              </p>
              <p className="text-[11px] leading-relaxed">
                {livePollingActive && !pollExhausted
                  ? 'Cuando lo valide, esta pantalla se actualiza automáticamente y el cupón queda en tu historial. No tenés que hacer nada más.'
                  : livePollingActive && pollExhausted
                    ? '¿Ya te lo validaron? Tocá Actualizar para ver tu cupón en el historial.'
                    : 'Mostrá el código; el comercio lo valida desde su panel. Después vas a ver el cupón en tu historial.'}
              </p>
              {livePollingActive && pollExhausted && (
                <button
                  type="button"
                  onClick={() => {
                    setPollExhausted(false)
                    syncMyActivations()
                  }}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-fin-surface px-3 py-1.5 text-[11px] font-bold text-fin-ink ring-1 ring-fin-line hover:bg-fin-surface2"
                >
                  <RotateCw size={12} /> Actualizar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isExpired ? (
        <Link
          to="/"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-surface2 px-6 py-3.5 text-sm font-bold text-fin-ink ring-1 ring-fin-line transition-all hover:bg-fin-line"
        >
          <ChevronLeft size={16} />
          Volver al inicio
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-surface2 px-6 py-3.5 text-sm font-bold text-fin-soft ring-1 ring-fin-line transition-all hover:text-fin-danger"
        >
          <X size={16} />
          Cancelar cupón
        </button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar este cupón?"
        description="Lo vas a poder reactivar después desde Cupones."
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

  const QR_PIXELS = 320

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(
      canvasRef.current,
      payload,
      { width: QR_PIXELS, margin: 1, color: { dark: '#14211B', light: '#ffffff' } },
      (err) => {
        if (err) setError(err.message)
      },
    )
  }, [payload])

  if (error) {
    return (
      <div className="grid h-60 w-60 place-items-center rounded-2xl bg-fin-danger/10 text-xs font-medium text-fin-danger">
        No se pudo generar el QR
      </div>
    )
  }
  return (
    <div className="rounded-3xl bg-white p-4 shadow-floating ring-1 ring-fin-line sm:p-6">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Código QR para canje del cupón"
        className="block h-auto max-w-full"
      />
    </div>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback: el usuario puede seleccionar el texto */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Código copiado' : 'Copiar código'}
      className="inline-flex items-center gap-1.5 rounded-full bg-fin-surface2 px-3 py-1.5 text-[11px] font-bold text-fin-soft ring-1 ring-fin-line transition-all hover:text-fin-lime"
    >
      {copied ? (
        <>
          <Check size={12} /> Copiado
        </>
      ) : (
        <>
          <Copy size={12} /> Copiar código
        </>
      )}
    </button>
  )
}

function ExpiryHint({
  expiresAt,
  nowMs,
  isActive,
}: {
  expiresAt?: string
  nowMs: number
  isActive: boolean
}) {
  const ms = expiresAt ? new Date(expiresAt).getTime() - nowMs : Infinity
  // Bug #6: los códigos ya no expiran por tiempo. Si la activación sigue ACTIVA,
  // ignoramos un expiresAt legacy ya vencido (el QR igual se canjea en el backend)
  // y mostramos "sin tiempo límite" en vez de un "venció" que contradice el QR
  // usable de arriba. El "venció" real sale solo cuando la activación NO está
  // activa (cancelada/expirada por status).
  if (isActive && (!expiresAt || ms <= 0)) {
    return (
      <p className="max-w-xs text-center text-[11px] text-fin-faint">
        Sin tiempo límite — el código vale hasta que lo uses.
      </p>
    )
  }
  if (!isActive) {
    return (
      <p className="max-w-xs text-center text-[11px] font-semibold text-fin-danger">
        El cupón venció. Reactivalo desde Cupones.
      </p>
    )
  }
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const isUrgent = min < 5
  const label =
    min >= 1
      ? `Vence en ${min} min ${String(sec).padStart(2, '0')} s`
      : `Vence en ${sec} s`
  return (
    <p
      role="timer"
      aria-live="polite"
      className={`max-w-xs text-center text-[11px] font-bold tabular-nums ${
        isUrgent ? 'text-status-warning' : 'text-fin-soft'
      }`}
    >
      {label}
    </p>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-fin-faint">
      <span className="h-px flex-1 bg-fin-line" />
      {label}
      <span className="h-px flex-1 bg-fin-line" />
    </div>
  )
}

function formatCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`
  return code
}
