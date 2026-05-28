import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Store,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  ScanLine,
  Users,
  MessageCircle,
  TrendingUp,
  CreditCard,
} from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'

export function AdminLoginPage() {
  const { session } = useMerchantSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [params] = useSearchParams()
  // Si el shell del comercio nos redirigió acá con ?reason=expired,
  // mostramos un mensaje claro (en lugar de pantalla en blanco).
  const expiredMsg =
    params.get('reason') === 'expired'
      ? 'Tu sesión expiró por inactividad. Volvé a ingresar tus datos.'
      : null
  const [error, setError] = useState<string | null>(expiredMsg)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  if (session) return <Navigate to="/admin" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await merchantAuth.login(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-accent-700 via-accent-800 to-accent-900 text-white">
      <div className="bg-grid-pattern absolute inset-0 opacity-[0.07]" />
      <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-accent-500/30 blur-3xl" />
      <div className="absolute -right-32 -bottom-24 h-[28rem] w-[28rem] rounded-full bg-pink-500/20 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-8 pb-12 sm:px-8 sm:pt-12 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
        {/* Header logo (mobile + desktop) */}
        <header className="absolute left-4 top-6 sm:left-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <Store size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">Mi San Pedro</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">
                Panel del comercio
              </p>
            </div>
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col gap-6 pt-12 sm:pt-16 lg:flex-1 lg:pt-0">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90 ring-1 ring-white/15 backdrop-blur">
            <Store size={12} /> Para comerciantes adheridos
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tu comercio,{' '}
            <span className="bg-gradient-to-br from-pink-300 via-fuchsia-200 to-accent-200 bg-clip-text text-transparent">
              conectado con todo San Pedro
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            Validá cupones y construí tu base de clientes propia. Pronto vas a poder
            mandar campañas de WhatsApp directo desde la plataforma.
          </p>

          <ul className="flex flex-col gap-2.5 pt-2">
            <Bullet icon={ScanLine}>
              <span className="font-semibold text-white">Validá cupones</span>{' '}
              <span className="text-white/70">desde tu celular en 2 segundos</span>
            </Bullet>
            <Bullet icon={Users}>
              <span className="font-semibold text-white">Base de clientes propia</span>{' '}
              <span className="text-white/70">— exportable y mensajeable</span>
            </Bullet>
            <Bullet icon={MessageCircle}>
              <span className="font-semibold text-white">WhatsApp masivo</span>{' '}
              <span className="text-white/70">— próximamente, vía API oficial</span>
            </Bullet>
            <Bullet icon={TrendingUp}>
              <span className="font-semibold text-white">Estadísticas reales</span>{' '}
              <span className="text-white/70">de canjes y patrones de visita</span>
            </Bullet>
          </ul>

          <div className="hidden pt-4 lg:block">
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
              Plan estándar
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                $25.000 final / mes · sin permanencia
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                10 días de arrepentimiento
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                Factura C (monotributo)
              </span>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="w-full lg:w-[440px] lg:shrink-0">
          <div className="rounded-3xl bg-white p-6 text-neutral-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 sm:p-7">
            <h2 className="text-2xl font-bold tracking-tight">Acceso al panel</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ingresá con tu cuenta del comercio.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <Field
                label="Email del comercio"
                input={
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError(null)
                    }}
                    placeholder="vos@tucomercio.com"
                    className={inputCls}
                    required
                  />
                }
              />
              <Field
                label="Contraseña"
                input={
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(null)
                      }}
                      className={`${inputCls} pr-12`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:bg-primary-100 hover:text-neutral-700"
                      aria-label={showPwd ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                }
              />

              {error && (
                <p role="alert" className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? 'Ingresando…' : 'Ingresar'}
                <ArrowRight size={16} />
              </button>

              <Link
                to="/admin/forgot-password"
                className="text-center text-xs font-semibold text-neutral-500 hover:text-accent-700"
              >
                Olvidé mi contraseña
              </Link>
            </form>

            <Divider label="o" />

            {/* CTA registrar comercio */}
            <Link
              to="/admin/registro"
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-pink-50 via-fuchsia-50 to-accent-50 p-4 ring-1 ring-accent-100 transition-all hover:-translate-y-0.5 hover:ring-accent-200"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 via-fuchsia-500 to-accent-600 text-white shadow-cta">
                <Store size={20} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-900">Registrar mi comercio</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                  <CreditCard size={10} className="shrink-0" />
                  Plan estándar · $25.000 final / mes · sin permanencia
                </p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-accent-600 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-white/60">
            <ShieldCheck size={12} /> Cumplimiento Ley 25.326 · Tus datos protegidos
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="relative mx-auto max-w-6xl px-4 pb-8 sm:px-8">
        <p className="text-center text-xs text-white/50 sm:text-left">
          ¿Sos vecino?{' '}
          <Link to="/" className="font-bold text-white/90 hover:text-white">
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
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
        <Icon size={14} className="text-white" />
      </span>
      <span className="text-sm">{children}</span>
    </li>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
      <span className="h-px flex-1 bg-neutral-200" />
      {label}
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({ label, input }: { label: string; input: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {input}
    </label>
  )
}

