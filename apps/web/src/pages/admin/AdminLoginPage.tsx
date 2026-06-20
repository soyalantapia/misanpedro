import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Store,
  ArrowRight,
  ArrowLeft,
  ScanLine,
  Users,
  MessageCircle,
  TrendingUp,
  CreditCard,
  Mail,
  KeyRound,
} from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'
import { useTenant } from '@/lib/tenant'

export function AdminLoginPage() {
  const { session } = useMerchantSession()
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi San Pedro'
  const ciudad = tenant.config?.ciudad ?? 'tu ciudad'
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [params] = useSearchParams()
  // Si el shell del comercio nos redirigió acá con ?reason=expired.
  const expiredMsg =
    params.get('reason') === 'expired'
      ? 'Tu sesión se cerró. Ingresá con tu email para volver a entrar.'
      : null
  const [error, setError] = useState<string | null>(expiredMsg)
  const [info, setInfo] = useState<string | null>(null)
  // En desarrollo el backend devuelve el código para poder testear sin email.
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  if (session) return <Navigate to="/admin" replace />

  const normalizedEmail = email.trim().toLowerCase()

  async function sendCode(): Promise<boolean> {
    setSubmitting(true)
    setError(null)
    setInfo(null)
    const result = await merchantAuth.requestOtp(normalizedEmail)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setDebugCode(result.debugCode ?? null)
    setCooldown(45)
    return true
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await sendCode()
    if (ok) {
      setStep('code')
      setInfo(`Te enviamos un código de 6 dígitos a ${normalizedEmail}.`)
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await merchantAuth.verifyOtp(normalizedEmail, code.trim())
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/admin', { replace: true })
  }

  async function handleResend() {
    if (cooldown > 0 || submitting) return
    setCode('')
    const ok = await sendCode()
    if (ok) setInfo('Te reenviamos un código nuevo.')
  }

  function backToEmail() {
    setStep('email')
    setCode('')
    setError(null)
    setInfo(null)
    setDebugCode(null)
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-brand-strong to-brand text-on-brand">
      <div className="bg-grid-pattern absolute inset-0 opacity-[0.07]" />
      <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
      <div className="absolute -right-32 -bottom-24 h-[28rem] w-[28rem] rounded-full bg-brand/25 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-8 pb-12 sm:px-8 sm:pt-12 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
        {/* Header logo (mobile + desktop) */}
        <header className="absolute left-4 top-6 sm:left-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface/10 ring-1 ring-white/15 backdrop-blur">
              <Store size={18} className="text-on-brand" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-on-brand">{appName}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-on-brand/60">
                Panel del comercio
              </p>
            </div>
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col gap-6 pt-20 sm:pt-24 lg:flex-1 lg:pt-0">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-on-brand/90 ring-1 ring-white/15 backdrop-blur">
            <Store size={12} /> Para comerciantes adheridos
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tu comercio,{' '}
            <span className="bg-gradient-to-br from-on-brand via-brand-soft to-on-brand bg-clip-text text-transparent">
              conectado con todo {ciudad}
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-on-brand/75 sm:text-lg">
            Validá descuentos y construí tu base de clientes propia. Pronto vas a poder
            mandar campañas de WhatsApp directo desde la plataforma.
          </p>

          <ul className="flex flex-col gap-2.5 pt-2">
            <Bullet icon={ScanLine}>
              <span className="font-semibold text-on-brand">Validá descuentos</span>{' '}
              <span className="text-on-brand/70">desde tu celular en 2 segundos</span>
            </Bullet>
            <Bullet icon={Users}>
              <span className="font-semibold text-on-brand">Base de clientes propia</span>{' '}
              <span className="text-on-brand/70">— exportable y mensajeable</span>
            </Bullet>
            <Bullet icon={MessageCircle}>
              <span className="font-semibold text-on-brand">WhatsApp masivo</span>{' '}
              <span className="text-on-brand/70">— próximamente, vía API oficial</span>
            </Bullet>
            <Bullet icon={TrendingUp}>
              <span className="font-semibold text-on-brand">Estadísticas reales</span>{' '}
              <span className="text-on-brand/70">de canjes y patrones de visita</span>
            </Bullet>
          </ul>

          {/* (bloque de precio removido — la tarifa ahora es por ciudad) */}
        </section>

        {/* Form */}
        <section className="w-full lg:w-[440px] lg:shrink-0">
          <div className="rounded-3xl bg-surface p-6 text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] ring-1 ring-on-brand/10 sm:p-7">
            <h2 className="text-2xl font-bold tracking-tight">Acceso al panel</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {step === 'email'
                ? 'Ingresá el email de tu comercio y te mandamos un código para entrar.'
                : 'Escribí el código de 6 dígitos que te llegó por email.'}
            </p>

            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="mt-5 flex flex-col gap-4">
                <Field
                  label="Email del comercio"
                  input={
                    <div className="relative">
                      <Mail
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
                      />
                      <input
                        id="merchant-login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setError(null)
                        }}
                        placeholder="vos@tucomercio.com"
                        className={`${inputCls} pl-10`}
                        required
                      />
                    </div>
                  }
                />

                {error && <ErrorBox>{error}</ErrorBox>}

                <button type="submit" disabled={submitting || !email.trim()} className={btnPrimary}>
                  {submitting ? 'Enviando…' : 'Enviar código'}
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleCodeSubmit} className="mt-5 flex flex-col gap-4">
                <button
                  type="button"
                  onClick={backToEmail}
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-ink-soft hover:text-brand-strong"
                >
                  <ArrowLeft size={13} /> {normalizedEmail} · cambiar
                </button>

                <Field
                  label="Código de 6 dígitos"
                  input={
                    <div className="relative">
                      <KeyRound
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
                      />
                      <input
                        id="merchant-login-code"
                        name="one-time-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                          setError(null)
                        }}
                        placeholder="123456"
                        maxLength={6}
                        className={`${inputCls} pl-10 text-center text-lg font-bold tracking-[0.5em]`}
                        required
                      />
                    </div>
                  }
                />

                {info && !error && (
                  <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand-strong">
                    {info}
                  </p>
                )}
                {debugCode && (
                  <p className="rounded-xl bg-surface-2 px-3 py-2 text-center text-xs font-medium text-ink-soft">
                    (dev) Código: <span className="font-mono font-bold text-ink">{debugCode}</span>
                  </p>
                )}
                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="submit"
                  disabled={submitting || code.length < 6}
                  className={btnPrimary}
                >
                  {submitting ? 'Verificando…' : 'Entrar'}
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || submitting}
                  className="text-center text-xs font-semibold text-ink-soft hover:text-brand-strong disabled:opacity-50"
                >
                  {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'No me llegó — reenviar código'}
                </button>
              </form>
            )}

            <Divider label="o" />

            {/* CTA registrar comercio */}
            <Link
              to="/admin/registro"
              className="group flex items-center gap-3 rounded-2xl bg-brand-soft p-4 ring-1 ring-line transition-all hover:-translate-y-0.5 hover:ring-line"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
                <Store size={20} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink">Registrar mi comercio</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                  <CreditCard size={10} className="shrink-0" />
                  Alta en minutos · sin permanencia
                </p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-brand-strong transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

        </section>
      </div>

      {/* Footer */}
      <div className="relative mx-auto max-w-6xl px-4 pb-8 sm:px-8">
        <p className="text-center text-xs text-on-brand/50 sm:text-left">
          ¿Sos vecino?{' '}
          <Link to="/" className="font-bold text-on-brand/90 hover:text-on-brand">
            Volvé a la app
          </Link>
        </p>
      </div>
    </div>
  )
}

function Bullet({
  icon: Icon,
  children,
}: {
  icon: typeof Store
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-surface/10 ring-1 ring-white/15">
        <Icon size={14} className="text-on-brand" />
      </span>
      <span className="text-sm">{children}</span>
    </li>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
      <span className="h-px flex-1 bg-surface-2" />
      {label}
      <span className="h-px flex-1 bg-surface-2" />
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-surface px-4 py-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand'

function Field({ label, input }: { label: string; input: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      {input}
    </label>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg"
    >
      {children}
    </p>
  )
}

const btnPrimary =
  'mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-brand-strong hover:to-brand-strong hover:shadow-floating active:translate-y-0 active:scale-[0.98] disabled:opacity-60'
