import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Hash, AlertCircle, Camera, Keyboard, ArrowRight } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useValidateByCode } from '@/lib/merchantQueries'
import { useApiValidateByCode } from '@/lib/apiQueries'
import { parseQrPayload } from '@/lib/qrPayload'
import { cn } from '@/lib/cn'

type Mode = 'qr' | 'code'

export function AdminValidarPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const [mode, setMode] = useState<Mode>('code')

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          <ScanLine size={12} /> Validar
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Validar cupón
        </h1>
        <p className="text-sm text-ink-soft">
          El cliente abre la app, te muestra el QR o el código de 6 dígitos. Lo validás y confirmás
          el canje.
        </p>
      </header>

      <div role="group" aria-label="Modo de validación" className="grid grid-cols-2 rounded-full bg-surface-2 p-1 ring-1 ring-line">
        <button
          type="button"
          aria-pressed={mode === 'qr'}
          onClick={() => setMode('qr')}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
            mode === 'qr'
              ? 'bg-surface text-ink shadow-card'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          <Camera size={13} /> Escanear QR
        </button>
        <button
          type="button"
          aria-pressed={mode === 'code'}
          onClick={() => setMode('code')}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
            mode === 'code'
              ? 'bg-surface text-ink shadow-card'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          <Keyboard size={13} /> Código manual
        </button>
      </div>

      {mode === 'code' ? (
        <CodeMode merchantId={merchantId} onSwitch={() => setMode('qr')} />
      ) : (
        <ScanMode merchantId={merchantId} onSwitch={() => setMode('code')} />
      )}
    </div>
  )
}

function CodeMode({ merchantId, onSwitch }: { merchantId: string; onSwitch: () => void }) {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const trimmed = code.replace(/\D/g, '').slice(0, 6)
  const localResult = useValidateByCode(trimmed, merchantId)
  const { result: apiResult } = useApiValidateByCode(trimmed)
  // Comercio real: confiamos en el API. El fallback local sólo se usa en
  // entornos sin sesión API (gh-pages demo).
  const isApiMerchantSession = /^[0-9a-f]{24}$/i.test(merchantId)
  const result = (() => {
    if (isApiMerchantSession) {
      // Comercio API: usamos exclusivamente la respuesta del API
      return apiResult ? toLegacyResult(apiResult) : null
    }
    // Comercio demo / offline: usamos el local
    return localResult
  })()
  const ready = trimmed.length === 6

  // Sandra controla el ritmo: ya NO auto-navegamos a /admin/canje a los 500ms
  // (cambio VP03). En su lugar mostramos un CTA explícito "Confirmar canje" en
  // el ResultPanel para que pueda comparar datos con el cliente antes de avanzar.
  const okActivationId = result && result.ok ? result.activation.id : null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Pedile el código al cliente
        </p>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={trimmed}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          maxLength={6}
          aria-label="Código de canje de 6 dígitos"
          className="mt-3 w-full rounded-2xl bg-bg px-6 py-5 text-center font-mono text-4xl font-bold tracking-[0.4em] tabular-nums text-ink ring-2 ring-brand focus:outline-none focus:ring-brand"
        />
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full',
                i < trimmed.length ? 'bg-brand' : 'bg-surface-2',
              )}
            />
          ))}
        </div>
      </div>

      {ready && result && (
        <ResultPanel
          result={result}
          onConfirm={
            okActivationId ? () => navigate(`/admin/canje/${okActivationId}`) : undefined
          }
          onRetry={() => {
            // N3: limpiar el código y volver a enfocar el input para que
            // Sandra pueda tipear el siguiente sin borrar dígito por dígito.
            setCode('')
            inputRef.current?.focus()
          }}
        />
      )}

      {!ready && (
        <>
          <p className="text-center text-xs text-ink-faint">
            Ingresá los 6 dígitos para validar.{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-bold text-brand-strong underline-offset-2 hover:underline"
            >
              Mejor escaneá el QR
            </button>
          </p>

        </>
      )}
    </div>
  )
}

function ScanMode({ merchantId, onSwitch }: { merchantId: string; onSwitch: () => void }) {
  const [scanState, setScanState] = useState<
    'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable'
  >('idle')
  const [scannedPayload, setScannedPayload] = useState<string | null>(null)
  const containerId = 'qr-reader'
  const navigate = useNavigate()

  useEffect(() => {
    if (scanState !== 'starting') return
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null
    let cancelled = false

    ;(async () => {
      try {
        const lib = await import('html5-qrcode')
        if (cancelled) return
        const instance = new lib.Html5Qrcode(containerId)
        scanner = {
          stop: () => instance.stop(),
          clear: () => instance.clear(),
        }
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            setScannedPayload(decoded)
            setScanState('scanning')
            instance.stop().catch(() => {})
          },
          () => {},
        )
      } catch {
        if (!cancelled) setScanState('denied')
      }
    })()

    return () => {
      cancelled = true
      try {
        scanner?.stop().catch(() => {})
        scanner?.clear()
      } catch {
        /* noop */
      }
    }
  }, [scanState])

  // parse and validate payload (helper extraído para poder testearlo)
  const codeFromPayload = parseQrPayload(scannedPayload)
  const localResult = useValidateByCode(codeFromPayload, merchantId)
  const { result: apiResult } = useApiValidateByCode(codeFromPayload)
  const result = (() => {
    if (!apiResult) return localResult
    if (apiResult.ok) return toLegacyResult(apiResult)
    if (apiResult.reason === 'network') return localResult
    if (apiResult.reason === '404' && localResult?.ok) return localResult
    return toLegacyResult(apiResult)
  })()

  // VP03: sin auto-nav. El comerciante avanza con el CTA del ResultPanel.
  const okActivationId = result && result.ok ? result.activation.id : null

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink shadow-card">
        {scanState === 'starting' || scanState === 'scanning' ? (
          <div id={containerId} className="absolute inset-0" />
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-on-brand/80">
            {scanState === 'idle' && (
              <button
                type="button"
                onClick={() => setScanState('starting')}
                className="flex flex-col items-center gap-3 px-6"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface/10">
                  <Camera size={26} />
                </div>
                <p className="font-bold">Activar cámara</p>
                <p className="text-xs text-on-brand/60">
                  Vamos a pedirte permiso para usar la cámara
                </p>
              </button>
            )}
            {scanState === 'denied' && (
              <div className="flex flex-col items-center gap-3 px-6">
                <AlertCircle size={26} className="text-status-warning" />
                <p className="font-bold">No pudimos acceder a la cámara</p>
                <button
                  type="button"
                  onClick={onSwitch}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-xs font-bold text-ink"
                >
                  <Hash size={13} /> Usar código manual
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {scanState === 'idle' && (
        <p className="text-center text-xs text-ink-soft">
          ¿Problemas con la cámara?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="font-bold text-brand-strong underline-offset-2 hover:underline"
          >
            Ingresar código manual
          </button>
        </p>
      )}

      {scannedPayload && result && (
        <ResultPanel
          result={result}
          onConfirm={
            okActivationId ? () => navigate(`/admin/canje/${okActivationId}`) : undefined
          }
          onRetry={() => {
            // C2: tras un QR inválido/ya canjeado, re-arrancar la cámara para
            // escanear de nuevo sin tener que cambiar a modo manual y volver.
            setScannedPayload(null)
            setScanState('starting')
          }}
        />
      )}
    </div>
  )
}

function toLegacyResult(
  v: NonNullable<ReturnType<typeof useApiValidateByCode>['result']>,
): NonNullable<ReturnType<typeof useValidateByCode>> {
  if (v.ok) {
    return {
      ok: true,
      // Construimos un Activation mínimo compatible con el navigate al confirmar
      activation: {
        id: v.activationId,
        codigoNumerico: v.codigo,
        couponId: v.couponId,
        userId: '',
        status: 'activo',
        activatedAt: v.activatedAt,
        expiresAt: v.expiresAt,
        qrPayload: '',
      },
      couponTitulo: v.couponTitulo,
      porcentaje: v.porcentaje,
      customerName: v.customerName,
      isFirstVisit: v.isFirstVisit,
    }
  }
  return {
    ok: false,
    reason:
      v.reason === '404'
        ? 'not-found'
        : v.reason === '403'
          ? 'wrong-merchant'
          : v.reason === '409'
            ? 'already-redeemed'
            : 'not-found',
    message: v.message,
  }
}

/**
 * F3: errores específicos por `reason` con copy operativo (no solo "inválido").
 * Antes el panel mostraba "No es un cupón válido · Cupón inválido" — redundante
 * e inútil. Sandra no sabía si tipeó mal, si ya se canjeó, o si era de otro
 * comercio. Ahora cada reason tiene su mensaje + acción sugerida.
 */
function errorCopy(reason: string): { title: string; hint: string } {
  switch (reason) {
    case 'already-redeemed':
      return {
        title: 'Este cupón ya fue canjeado',
        hint: 'El cliente ya lo usó en una visita anterior. Cada cupón vale una sola vez.',
      }
    case 'wrong-merchant':
      return {
        title: 'Este cupón es de otro comercio',
        hint: 'El código es válido pero corresponde a otro local adherido. Pedile al cliente uno de los tuyos.',
      }
    case 'expired':
      return {
        title: 'Este cupón venció',
        hint: 'Pasó el tiempo de validez. El cliente puede reactivarlo desde su app.',
      }
    case 'cancelled':
      return {
        title: 'Este cupón fue cancelado',
        hint: 'El cliente lo canceló desde su app. Puede reactivarlo si quiere usarlo.',
      }
    case 'not-found':
    default:
      return {
        title: 'No encontramos este código',
        hint: 'Revisá los dígitos con el cliente. Si sigue fallando, que abra el QR.',
      }
  }
}

function ResultPanel({
  result,
  onConfirm,
  onRetry,
}: {
  result: NonNullable<ReturnType<typeof useValidateByCode>>
  /** Si está, muestra CTA "Confirmar canje →". Si no, solo el panel. */
  onConfirm?: () => void
  /** N3: en caso de error, ofrece "Probar otro código" que limpia el input. */
  onRetry?: () => void
}) {
  if (!result.ok) {
    const copy = errorCopy(result.reason)
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-3xl bg-status-error-bg p-5 text-status-error-fg ring-1 ring-status-error/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">{copy.title}</p>
            <p className="mt-1 text-xs">{copy.hint}</p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start rounded-full bg-surface px-4 py-2 text-xs font-bold text-status-error-fg shadow-card ring-1 ring-status-error/20 transition-all hover:-translate-y-0.5"
          >
            Probar otro código
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-status-success-bg p-5 text-status-success-fg ring-1 ring-status-success/20">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-status-success text-on-brand animate-pulse-soft">
          ✓
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Cupón válido</p>
          <p className="text-xs">
            {result.porcentaje}% off · {result.couponTitulo}
          </p>
        </div>
      </div>
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-status-success px-5 py-3 text-sm font-bold text-on-brand shadow-cta-success transition-all hover:-translate-y-0.5"
        >
          Confirmar canje <ArrowRight size={14} />
        </button>
      )}
    </div>
  )
}
