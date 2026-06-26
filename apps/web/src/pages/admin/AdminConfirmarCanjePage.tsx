import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useTenant } from '@/lib/tenant'
import { confirmRedemption } from '@/lib/merchantQueries'
import { useActivation, useUserById } from '@/lib/stores'
import { useCoupon } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { formatMoney } from '@/lib/format'
import { calcAhorroCanje } from '@/lib/cuponValor'
import { api, ApiError } from '@/lib/api'
import { readCachedValidation, clearCachedValidation } from '@/lib/apiQueries'

export function AdminConfirmarCanjePage() {
  const { activationId } = useParams<{ activationId: string }>()
  const localActivation = useActivation(activationId)
  const localCoupon = useCoupon(localActivation?.couponId)
  const localUser = useUserById(localActivation?.userId)
  const apiCached = activationId ? readCachedValidation(activationId) : null
  const { session } = useMerchantSession()
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const navigate = useNavigate()
  const toast = useToast()
  const [monto, setMonto] = useState('')
  const [montoTouched, setMontoTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Combinamos: si vino del API y la validación fue OK, usamos el cache.
  // Si no, caemos al store local.
  const view = apiCached?.ok
    ? {
        id: apiCached.activationId,
        codigoNumerico: apiCached.codigo,
        porcentaje: apiCached.porcentaje,
        couponTitulo: apiCached.couponTitulo,
        precioReferencia: apiCached.precioReferencia,
        tipoOferta: apiCached.tipoOferta,
        precioFijo: apiCached.precioFijo,
        customerName: apiCached.customerName,
        activatedAt: apiCached.activatedAt ?? new Date().toISOString(),
        source: 'api' as const,
      }
    : localActivation && localCoupon && localActivation.status === 'activo'
      ? {
          id: localActivation.id,
          codigoNumerico: localActivation.codigoNumerico,
          porcentaje: localCoupon.porcentaje,
          couponTitulo: localCoupon.titulo,
          precioReferencia: localCoupon.precioReferencia,
          tipoOferta: localCoupon.tipoOferta,
          precioFijo: localCoupon.precioFijo,
          customerName: localUser?.nombre ?? 'Vecino registrado',
          activatedAt: localActivation.activatedAt,
          source: 'local' as const,
        }
      : null

  // PM-elite T1: pre-cargamos el monto con el precio de referencia del cupón.
  // Así el cajero confirma de un toque, sin tipear nada. Solo una vez (y no si
  // el cajero ya tocó el campo o lo limpió a propósito).
  const precioRef = view?.precioReferencia
  useEffect(() => {
    if (!montoTouched && monto === '' && precioRef && precioRef > 0) {
      setMonto(String(precioRef))
    }
  }, [precioRef, montoTouched, monto])

  if (!view || !session) return <Navigate to="/admin/validar" replace />
  if (
    view.source === 'local' &&
    localCoupon &&
    localCoupon.merchantId !== session.merchantId
  ) {
    return <Navigate to="/admin/validar" replace />
  }

  const customerName = view.customerName
  const initials = customerName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleConfirm() {
    if (!view) return
    // PM-elite T1 (métrica norte): el monto es OPCIONAL — el canje NUNCA se
    // bloquea por falta de monto. Si el cajero no lo tocó/lo dejó en 0, mandamos
    // undefined y el backend estima el ahorro desde el precioReferencia.
    const parsed = monto ? parseInt(monto.replace(/\D/g, ''), 10) : NaN
    const monto_n =
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    // Cap razonable de plausibilidad: un ticket de >$10M ARS en un comercio
    // de barrio casi seguro es un typo. Solo bloqueamos si efectivamente hay
    // un número absurdo cargado (no por estar vacío).
    if (monto_n != null && monto_n > 10_000_000) {
      toast.error(
        'Monto demasiado alto',
        '¿Seguro que el ticket es de más de $10.000.000? Revisá el número.',
      )
      return
    }
    setSubmitting(true)

    if (view.source === 'api') {
      try {
        await api.redemptions.confirm(view.id, monto_n)
        toast.success(
          'Canje confirmado',
          `${customerName} usó su descuento del ${view.porcentaje}%`,
        )
        clearCachedValidation(view.id)
        navigate('/admin', { replace: true })
        return
      } catch (err) {
        toast.error(
          'No se pudo confirmar',
          err instanceof ApiError ? err.message : 'Sin conexión',
        )
        setSubmitting(false)
        return
      }
    }

    // Local fallback (dev/demo). Si no hay monto, usamos el precio de referencia.
    if (localActivation && localCoupon) {
      confirmRedemption(
        localActivation.id,
        localCoupon.porcentaje,
        monto_n ?? localCoupon.precioReferencia,
      )
      toast.success('Canje confirmado', `${customerName} usó su descuento del ${localCoupon.porcentaje}%`)
      navigate('/admin', { replace: true })
    }
    setSubmitting(false)
  }

  // Preview del ahorro: usamos calcAhorroCanje (la MISMA fórmula del backend) con
  // el monto tipeado o, si está vacío, el precioReferencia — exactamente lo que el
  // backend usará al confirmar (montoTicket ?? precioReferencia). Así el cajero ve
  // siempre el ahorro REAL (incluye precio_fijo, no solo el %).
  const montoPreview = monto ? parseInt(monto.replace(/\D/g, ''), 10) : (view.precioReferencia ?? 0)
  const ahorroPreview =
    Number.isFinite(montoPreview) && montoPreview > 0
      ? calcAhorroCanje(
          { tipoOferta: view.tipoOferta, porcentaje: view.porcentaje, precioFijo: view.precioFijo },
          montoPreview,
        )
      : null

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/admin/validar"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ChevronLeft size={16} /> Volver a Validar
      </Link>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Confirmar canje
        </h1>
        <p className="text-sm text-ink-soft">
          Verificá los datos antes de confirmar. Esta acción no se puede deshacer.
        </p>
      </header>

      <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-strong text-on-brand text-base font-bold shadow-cta">
          {initials || '··'}
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-ink">{customerName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            Cliente {appName}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <Row label="Descuento" value={`${view.porcentaje}% OFF`} />
        <Row label="Cupón" value={view.couponTitulo} />
        <Row label="Código" value={formatCode(view.codigoNumerico)} mono />
        <Row label="Activado a las" value={timeOf(view.activatedAt)} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Monto sin descuento{' '}
          <span className="font-semibold normal-case tracking-normal text-ink-faint">
            (opcional)
          </span>
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-faint">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              // Cap a 8 dígitos (max 99.999.999 ARS) para evitar typos de zeros
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 8)
              setMontoTouched(true)
              setMonto(cleaned)
            }}
            placeholder="0"
            maxLength={8}
            className="w-full rounded-2xl bg-surface py-3.5 pl-8 pr-4 text-sm text-ink shadow-card ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <p className="text-[11px] text-ink-faint">
          {precioRef
            ? 'Pre-cargado con el precio de lista. Ajustalo si el ticket fue otro, o confirmá así nomás.'
            : `Si lo cargás, calculamos cuánto ahorró el cliente sobre el ${view.porcentaje}%. Podés confirmar sin cargarlo.`}
          {ahorroPreview !== null && (
            <span className="ml-1 font-bold text-status-success-fg">
              Ahorro estimado: {formatMoney(ahorroPreview)}
            </span>
          )}
        </p>
      </label>

      {createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg shadow-floating"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
        <div className="mx-auto flex w-full max-w-2xl items-stretch gap-2 px-4 py-3 sm:px-6">
          <Link
            to="/admin/validar"
            aria-label="Volver a Validar"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-3.5 text-sm font-bold text-ink ring-1 ring-line transition-all hover:-translate-y-0.5 hover:bg-surface-2"
          >
            <ChevronLeft size={16} /> Volver
          </Link>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-status-success px-6 py-3.5 text-base font-bold text-on-brand shadow-cta-success transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
          >
            <CheckCircle2 size={18} />
            {submitting ? 'Confirmando…' : 'Confirmar canje'}
          </button>
        </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5 text-sm last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span className={`font-bold text-ink ${mono ? 'font-mono tracking-widest' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function formatCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`
  return code
}

function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
