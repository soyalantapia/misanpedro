import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Mail, KeyRound, AlertCircle } from 'lucide-react'
import { owner } from '@/lib/api'
import { authActions } from '@/lib/store'

type Phase = 'email' | 'code' | 'success'

export function LoginPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.requestOtp(email.trim().toLowerCase())
      if (!res.ok) {
        setError((res as { error?: string }).error ?? 'No pudimos enviar el código')
        setSubmitting(false)
        return
      }
      // En dev el back devuelve el código para testear; lo precargamos.
      const debug = (res as { _debugCode?: string })._debugCode
      if (debug) setCode(debug)
      setPhase('code')
      setSubmitting(false)
    } catch (err) {
      setError((err as Error)?.message ?? 'No pudimos contactar al servidor')
      setSubmitting(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.verifyOtp({ email: email.trim().toLowerCase(), code })
      if (!res.ok) {
        setError((res as { error?: string }).error ?? 'Código inválido')
        setSubmitting(false)
        return
      }
      authActions.signIn({
        access: res.access,
        refresh: res.refresh,
        refreshExpiresAt: res.refreshExpiresAt,
        owner: res.owner,
      })
      setPhase('success')
      setTimeout(() => navigate('/'), 300)
    } catch (err) {
      setError((err as Error)?.message ?? 'Error verificando el código')
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-xl ring-1 ring-neutral-200">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        {phase === 'email' && 'Entrar al panel de gestión'}
        {phase === 'code' && 'Revisá tu email'}
        {phase === 'success' && '¡Bienvenido!'}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {phase === 'email' && 'Te mandamos un código al email para entrar. Sin contraseña.'}
        {phase === 'code' && `Ingresá el código de 6 dígitos que mandamos a ${email}.`}
        {phase === 'success' && 'Te estamos llevando al dashboard…'}
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-bg/60 px-3 py-2 text-xs font-semibold text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {phase === 'email' && (
        <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-3">
          <Field
            icon={Mail}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            label="Email"
            autoFocus
          />
          <SubmitButton submitting={submitting} disabled={!email.includes('@')}>
            Enviar código
          </SubmitButton>
        </form>
      )}

      {phase === 'code' && (
        <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-3">
          <CodeField code={code} setCode={setCode} />
          <SubmitButton submitting={submitting} disabled={code.length !== 6}>
            Entrar
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setCode('')
              setError(null)
              setPhase('email')
            }}
            className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            ← Cambiar email
          </button>
        </form>
      )}
    </div>
  )
}

function Field({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
}: {
  icon: typeof Mail
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label: string
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="relative">
        <Icon
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-xl bg-neutral-50 py-3 pl-10 pr-4 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>
    </label>
  )
}

function CodeField({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Código</span>
      <div className="relative">
        <KeyRound
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          autoFocus
          className="w-full rounded-xl bg-neutral-50 py-3 pl-10 pr-4 text-center font-mono text-2xl tracking-[0.4em] tabular-nums text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>
    </label>
  )
}

function SubmitButton({
  submitting,
  disabled,
  children,
}: {
  submitting: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled || submitting}
      className="group mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-accent-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/40 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {submitting ? 'Procesando…' : children}
      {!submitting && (
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  )
}
