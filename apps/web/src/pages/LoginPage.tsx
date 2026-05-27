import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Mail, KeyRound } from 'lucide-react'
import { userApi, ApiError } from '@/lib/api'
import { userActions } from '@/lib/stores'
import { purgeDemoDataForApiUser } from '@/lib/demoSeeder'
import { useToast } from '@/components/Toast'

type Phase =
  | { kind: 'email' }
  | { kind: 'code'; email: string; debugCode?: string }

export function LoginPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const toast = useToast()

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await userApi.requestOtp(email.trim().toLowerCase())
      setPhase({
        kind: 'code',
        email: email.trim().toLowerCase(),
        debugCode: import.meta.env.DEV ? res._debugCode : undefined,
      })
      toast.info('Código enviado', 'Revisá tu email (en demo aparece debajo).')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Sin conexión con el servidor.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (phase.kind !== 'code') return
    setResending(true)
    setResent(false)
    try {
      const res = await userApi.requestOtp(phase.email)
      setPhase((prev) =>
        prev.kind === 'code'
          ? { ...prev, debugCode: import.meta.env.DEV ? res._debugCode : undefined }
          : prev,
      )
      setResent(true)
      toast.info('Código reenviado', 'Revisá tu email.')
    } catch {
      toast.error('Error al reenviar', 'No se pudo reenviar. Intentá de nuevo.')
    } finally {
      setResending(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (phase.kind !== 'code') return
    setError(null)
    setSubmitting(true)
    try {
      const res = await userApi.verifyOtp(phase.email, code.replace(/\D/g, ''))
      // Vecino real: descartamos demoUsers + activations seed (catálogo se mantiene)
      purgeDemoDataForApiUser()
      // Espejamos el user al store local para que toda la app reaccione
      userActions.replace({
        id: res.user.id,
        nombre: res.user.nombre,
        dni: res.user.dni,
        email: res.user.email,
        whatsapp: res.user.whatsapp,
        fechaNacimiento: res.user.fechaNacimiento,
        acceptedTcAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      toast.success('¡Bienvenido!', `Hola ${res.user.nombre.split(' ')[0]}.`)
      navigate(next, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Sin conexión con el servidor.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Cancelar
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <ShieldCheck size={12} /> Iniciar sesión
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {phase.kind === 'email' ? 'Volvé a entrar con tu email' : 'Ingresá el código'}
        </h1>
        <p className="text-sm text-neutral-500">
          {phase.kind === 'email'
            ? 'Te mandamos un código de 6 dígitos al email con el que te registraste.'
            : `Buscá el código que mandamos a ${phase.email}. Si no lo ves, revisá spam.`}
        </p>
      </header>

      {phase.kind === 'email' ? (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
          <Field
            label="Email"
            input={
              <div className="relative">
                <Mail
                  size={14}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="vos@ejemplo.com"
                  className={`${inputCls} pl-10`}
                  required
                />
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
          >
            {submitting ? 'Enviando…' : 'Enviarme el código'}
          </button>
          <p className="text-center text-xs text-neutral-500">
            ¿Sos nuevo?{' '}
            <Link to="/registro" className="font-bold text-accent-700 underline-offset-2 hover:underline">
              Crear cuenta
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          {phase.debugCode && (
            <div className="rounded-xl bg-status-info-bg p-3 text-status-info-fg">
              <p className="text-[11px] font-bold uppercase tracking-widest">Modo demo · código:</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] tabular-nums">
                {phase.debugCode}
              </p>
            </div>
          )}
          <Field
            label="Código de 6 dígitos"
            input={
              <div className="relative">
                <KeyRound
                  size={14}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setError(null)
                  }}
                  placeholder="000000"
                  maxLength={6}
                  className={`${inputCls} pl-10 font-mono text-center text-2xl tracking-[0.3em] tabular-nums`}
                  required
                />
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
            disabled={submitting || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
          >
            {submitting ? 'Verificando…' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent}
            className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900 disabled:opacity-60"
          >
            {resent ? '✓ Código reenviado' : resending ? 'Reenviando…' : 'Reenviar código'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: 'email' })
              setCode('')
              setError(null)
              setResent(false)
            }}
            className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            Usar otro email
          </button>
        </form>
      )}
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
