import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ChevronLeft, Smartphone, X, CheckCircle2 } from 'lucide-react'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { activationActions, useActivation } from '@/lib/stores'
import { getMerchant } from '@/data/mockData'
import { useCoupon } from '@/lib/couponsStore'
import { calcAhorro } from '@/lib/format'

export function CuponActivoPage() {
  const { id } = useParams<{ id: string }>()
  const activation = useActivation(id)
  const coupon = useCoupon(activation?.couponId)
  const merchant = coupon ? getMerchant(coupon.merchantId) : undefined
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (!activation || !coupon || !merchant) {
    return <Navigate to="/mis-cupones" replace />
  }

  const isExpired = activation.status !== 'activo'

  function handleCancel() {
    if (!activation) return
    activationActions.cancel(activation.id)
    toast.info('Cupón cancelado', 'Lo podés volver a activar desde Mis cupones.')
    navigate('/mis-cupones', { replace: true })
  }

  function handleSimulateRedeem() {
    if (!activation || !coupon) return
    activationActions.markRedeemed(activation.id, calcAhorro(coupon.porcentaje))
    toast.success('¡Cupón canjeado!', 'Quedó registrado en tu historial.')
    navigate('/canjeados', { replace: true })
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
          Mostrá este código al cajero. Se canjea solo una vez en {merchant.nombre}.
        </p>
        <CountdownTimer
          expiresAt={activation.expiresAt}
          onExpire={() => toast.warning('Cupón expirado', 'Reactivalo desde Mis cupones.')}
        />
      </div>

      {!isExpired && (
        <div className="rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
          <div className="flex items-start gap-2">
            <Smartphone size={16} className="mt-0.5 shrink-0 text-accent-500" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold">Demo MVP</p>
              <p className="text-[11px] leading-relaxed">
                Cuando el comercio escanee este QR (Fase 2 · Panel comercio), el cupón se marca como
                canjeado. Por ahora podés simular el canje para probar el historial.
              </p>
              <button
                type="button"
                onClick={handleSimulateRedeem}
                className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-accent-700 shadow-card hover:-translate-y-0.5 transition-all"
              >
                <CheckCircle2 size={12} /> Simular canje
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirmCancel(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-neutral-700 shadow-card ring-1 ring-neutral-100 transition-all hover:bg-status-error-bg hover:text-status-error-fg"
      >
        <X size={16} />
        {isExpired ? 'Volver' : 'Cancelar cupón'}
      </button>

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
      <canvas ref={canvasRef} className="block" />
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
