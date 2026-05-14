import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Hash, AlertCircle, Camera, Keyboard } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useValidateByCode } from '@/lib/merchantQueries'
import { useApiValidateByCode } from '@/lib/apiQueries'
import { cn } from '@/lib/cn'

type Mode = 'qr' | 'code'

export function AdminValidarPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const [mode, setMode] = useState<Mode>('code')

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <ScanLine size={12} /> Caja
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Validar cupón
        </h1>
        <p className="text-sm text-neutral-500">
          El cliente abre la app, te muestra el QR o el código de 6 dígitos. Lo validás y confirmás
          el canje.
        </p>
      </header>

      <div className="grid grid-cols-2 rounded-full bg-primary-100 p-1 ring-1 ring-neutral-100">
        <button
          type="button"
          onClick={() => setMode('qr')}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
            mode === 'qr'
              ? 'bg-white text-neutral-900 shadow-card'
              : 'text-neutral-500 hover:text-neutral-800',
          )}
        >
          <Camera size={13} /> Escanear QR
        </button>
        <button
          type="button"
          onClick={() => setMode('code')}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200',
            mode === 'code'
              ? 'bg-white text-neutral-900 shadow-card'
              : 'text-neutral-500 hover:text-neutral-800',
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
  const isLaEsquina = merchantId === 'la-esquina'
  // Sólo mostramos el banner del código demo a cuentas demo offline (id
  // tipo slug). Comercios reales del API usan ObjectId 24-char hex.
  const isApiMerchant = /^[0-9a-f]{24}$/i.test(merchantId)

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

  // Auto-navega al confirmar canje cuando el cupón es válido (con un toque
  // de delay para que el cajero alcance a ver el feedback verde).
  const okActivationId = result && result.ok ? result.activation.id : null
  useEffect(() => {
    if (!okActivationId) return
    const t = setTimeout(() => {
      navigate(`/admin/canje/${okActivationId}`)
    }, 500)
    return () => clearTimeout(t)
  }, [okActivationId, navigate])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
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
          className="mt-3 w-full rounded-2xl bg-primary-50 px-6 py-5 text-center font-mono text-4xl font-bold tracking-[0.4em] tabular-nums text-neutral-900 ring-2 ring-accent-300 focus:outline-none focus:ring-accent-500"
        />
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full',
                i < trimmed.length ? 'bg-accent-500' : 'bg-primary-200',
              )}
            />
          ))}
        </div>
      </div>

      {ready && result && <ResultPanel result={result} />}

      {!ready && (
        <>
          <p className="text-center text-xs text-neutral-400">
            Ingresá los 6 dígitos para validar.{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-bold text-accent-700 underline-offset-2 hover:underline"
            >
              Mejor escaneá el QR
            </button>
          </p>

          {isLaEsquina && (
            <button
              type="button"
              onClick={() => setCode('123456')}
              className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200 transition-all hover:-translate-y-0.5 hover:bg-amber-100"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-orange-400 text-white text-xs font-bold">
                💡
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-widest text-amber-700">
                  Código demo · tap para autocompletar
                </span>
                <span className="mt-0.5 block font-mono text-base font-bold text-neutral-900">
                  123 456
                </span>
                <span className="mt-0.5 block text-[11px] text-neutral-500">
                  Marta Domínguez · 20% OFF en pizzas martes y miércoles
                </span>
              </span>
            </button>
          )}
          {!isLaEsquina && !isApiMerchant && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-3 text-status-info-fg ring-1 ring-status-info/20">
              <span className="text-base leading-none">💡</span>
              <p className="text-xs leading-snug">
                El código demo <span className="font-mono font-bold">123 456</span> solo
                funciona si entrás como cajero de <span className="font-bold">La Esquina</span>.
                Para validar un cupón real, pedile el código al cliente.
              </p>
            </div>
          )}
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

  // parse and validate payload
  const codeFromPayload = (() => {
    if (!scannedPayload) return ''
    // Soporta payloads legacy JSON `{codigo:...}` y el nuevo formato `msp:act:CODE:COUPONID`
    if (scannedPayload.startsWith('msp:act:')) {
      const parts = scannedPayload.split(':')
      return parts[2] ?? ''
    }
    try {
      const parsed = JSON.parse(scannedPayload) as { codigo?: string }
      return parsed.codigo ?? ''
    } catch {
      return ''
    }
  })()
  const localResult = useValidateByCode(codeFromPayload, merchantId)
  const { result: apiResult } = useApiValidateByCode(codeFromPayload)
  const result = (() => {
    if (!apiResult) return localResult
    if (apiResult.ok) return toLegacyResult(apiResult)
    if (apiResult.reason === 'network') return localResult
    if (apiResult.reason === '404' && localResult?.ok) return localResult
    return toLegacyResult(apiResult)
  })()

  // Auto-navega cuando el QR es válido
  const okActivationId = result && result.ok ? result.activation.id : null
  useEffect(() => {
    if (!okActivationId) return
    const t = setTimeout(() => navigate(`/admin/canje/${okActivationId}`), 500)
    return () => clearTimeout(t)
  }, [okActivationId, navigate])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-neutral-900 shadow-card">
        {scanState === 'starting' || scanState === 'scanning' ? (
          <div id={containerId} className="absolute inset-0" />
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-white/80">
            {scanState === 'idle' && (
              <button
                type="button"
                onClick={() => setScanState('starting')}
                className="flex flex-col items-center gap-3 px-6"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                  <Camera size={26} />
                </div>
                <p className="font-bold">Activar cámara</p>
                <p className="text-xs text-white/60">
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
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-900"
                >
                  <Hash size={13} /> Usar código manual
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {scanState === 'idle' && (
        <p className="text-center text-xs text-neutral-500">
          ¿Problemas con la cámara?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="font-bold text-accent-700 underline-offset-2 hover:underline"
          >
            Ingresar código manual
          </button>
        </p>
      )}

      {scannedPayload && result && <ResultPanel result={result} />}
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
        activatedAt: new Date().toISOString(),
        expiresAt: v.expiresAt,
        qrPayload: '',
      },
      couponTitulo: v.couponTitulo,
      porcentaje: v.porcentaje,
      customerName: v.customerName,
      isFirstVisit: false,
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

function ResultPanel({
  result,
}: {
  result: NonNullable<ReturnType<typeof useValidateByCode>>
}) {
  if (!result.ok) {
    return (
      <div className="flex items-start gap-3 rounded-3xl bg-status-error-bg p-5 text-status-error-fg ring-1 ring-status-error/20">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold">No es un cupón válido</p>
          <p className="mt-1 text-xs">{result.message}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-status-success-bg p-5 text-status-success-fg ring-1 ring-status-success/20">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-status-success text-white animate-pulse-soft">
        ✓
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">Cupón válido</p>
        <p className="text-xs">
          {result.porcentaje}% off · {result.couponTitulo}
        </p>
      </div>
    </div>
  )
}
