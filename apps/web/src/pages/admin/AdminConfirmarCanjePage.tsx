import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, CheckCircle2, X } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { confirmRedemption } from '@/lib/merchantQueries'
import { useActivation, useUserById } from '@/lib/stores'
import { useCoupon } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { formatMoney } from '@/lib/format'
import { api, ApiError } from '@/lib/api'
import { readCachedValidation, clearCachedValidation } from '@/lib/apiQueries'

export function AdminConfirmarCanjePage() {
  const { activationId } = useParams<{ activationId: string }>()
  const localActivation = useActivation(activationId)
  const localCoupon = useCoupon(localActivation?.couponId)
  const localUser = useUserById(localActivation?.userId)
  const apiCached = activationId ? readCachedValidation(activationId) : null
  const { session } = useMerchantSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [monto, setMonto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Combinamos: si vino del API y la validación fue OK, usamos el cache.
  // Si no, caemos al store local.
  const view = apiCached?.ok
    ? {
        id: apiCached.activationId,
        codigoNumerico: apiCached.codigo,
        porcentaje: apiCached.porcentaje,
        couponTitulo: apiCached.couponTitulo,
        customerName: apiCached.customerName,
        activatedAt: new Date().toISOString(),
        source: 'api' as const,
      }
    : localActivation && localCoupon && localActivation.status === 'activo'
      ? {
          id: localActivation.id,
          codigoNumerico: localActivation.codigoNumerico,
          porcentaje: localCoupon.porcentaje,
          couponTitulo: localCoupon.titulo,
          customerName: localUser?.nombre ?? 'Vecino registrado',
          activatedAt: localActivation.activatedAt,
          source: 'local' as const,
        }
      : null

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
    setSubmitting(true)
    const monto_n = monto ? parseInt(monto.replace(/\D/g, ''), 10) : undefined

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

    // Local fallback
    if (localActivation && localCoupon) {
      confirmRedemption(localActivation.id, localCoupon.porcentaje, monto_n)
      toast.success('Canje confirmado', `${customerName} usó su descuento del ${localCoupon.porcentaje}%`)
      navigate('/admin', { replace: true })
    }
    setSubmitting(false)
  }

  const ahorroPreview = monto
    ? Math.round((parseInt(monto.replace(/\D/g, ''), 10) * view.porcentaje) / 100)
    : null

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/admin/validar"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Cancelar
      </Link>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Confirmar canje
        </h1>
        <p className="text-sm text-neutral-500">
          Verificá los datos antes de confirmar. Esta acción no se puede deshacer.
        </p>
      </header>

      <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white text-base font-bold shadow-cta">
          {initials || '··'}
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-neutral-900">{customerName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Cliente Mi San Pedro
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <Row label="Descuento" value={`${view.porcentaje}% OFF`} />
        <Row label="Cupón" value={view.couponTitulo} />
        <Row label="Código" value={formatCode(view.codigoNumerico)} mono />
        <Row label="Activado a las" value={timeOf(view.activatedAt)} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Monto del ticket (opcional)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full rounded-2xl bg-white py-3.5 pl-8 pr-4 text-sm text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
        </div>
        <p className="text-[11px] text-neutral-400">
          Si lo cargás, generamos estadísticas más precisas para tu comercio.
          {ahorroPreview !== null && (
            <span className="ml-1 font-bold text-status-success-fg">
              Ahorro estimado: {formatMoney(ahorroPreview)}
            </span>
          )}
        </p>
      </label>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-stretch gap-2 px-4 py-3 sm:px-6">
          <Link
            to="/admin/validar"
            aria-label="Cancelar"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-status-error-bg px-4 py-3.5 text-sm font-bold text-status-error-fg ring-1 ring-status-error/20 transition-all hover:-translate-y-0.5 hover:bg-status-error/10"
          >
            <X size={16} /> Cancelar
          </Link>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-status-success px-6 py-3.5 text-base font-bold text-white shadow-cta-success transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
          >
            <CheckCircle2 size={18} />
            {submitting ? 'Confirmando…' : 'Confirmar canje'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-100 py-1.5 text-sm last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-bold text-neutral-900 ${mono ? 'font-mono tracking-widest' : ''}`}>
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
