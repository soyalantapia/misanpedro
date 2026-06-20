import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react'
import QRCode from 'qrcode'
import { owner } from '@/lib/api'
import { authActions } from '@/lib/store'

type Phase =
  | 'credentials' // pidiendo email + password
  | 'setup2fa' // primer login → mostrar QR + verificar
  | 'totp' // pidiendo código 2FA
  | 'success'

export function LoginPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [setupData, setSetupData] = useState<{ totpUri: string; secret: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.login({ email, password, totp: totp || undefined })
      if (!res.ok) {
        setError((res as any).error ?? 'Error desconocido')
        setSubmitting(false)
        return
      }
      // setup2FA: primera vez — mostramos QR
      if ((res as any).setup2FA) {
        setSetupData({ totpUri: (res as any).totpUri, secret: (res as any).secret })
        setPhase('setup2fa')
        setSubmitting(false)
        return
      }
      // needTotp: tiene 2FA pero falta el código
      if ((res as any).needTotp) {
        setPhase('totp')
        setSubmitting(false)
        return
      }
      // Login completo
      if ((res as any).access) {
        authActions.signIn({
          access: (res as any).access,
          refresh: (res as any).refresh,
          refreshExpiresAt: (res as any).refreshExpiresAt,
          owner: (res as any).owner,
        })
        setPhase('success')
        setTimeout(() => navigate('/'), 300)
      }
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos contactar al servidor')
      setSubmitting(false)
    }
  }

  async function handle2FASetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.verify2FA({ email, password, totp })
      if (!res.ok) {
        setError((res as any).error ?? 'Código inválido')
        setSubmitting(false)
        return
      }
      // OK → re-login para obtener tokens
      const re = await owner.login({ email, password, totp })
      if (re.ok && (re as any).access) {
        authActions.signIn({
          access: (re as any).access,
          refresh: (re as any).refresh,
          refreshExpiresAt: (re as any).refreshExpiresAt,
          owner: (re as any).owner,
        })
        setPhase('success')
        setTimeout(() => navigate('/'), 300)
      } else {
        setError('Activación OK pero no pudimos loguearte. Reintentá manualmente.')
        setSubmitting(false)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error verificando 2FA')
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-xl ring-1 ring-neutral-200">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        {phase === 'credentials' && 'Entrar al Owner Panel'}
        {phase === 'setup2fa' && 'Activá tu 2FA'}
        {phase === 'totp' && 'Código de verificación'}
        {phase === 'success' && '¡Bienvenido!'}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {phase === 'credentials' && 'Acceso restringido a dueños del SaaS.'}
        {phase === 'setup2fa' &&
          'Escaneá el QR con Google Authenticator / Authy / 1Password y verificá con el código.'}
        {phase === 'totp' && 'Ingresá los 6 dígitos de tu app de autenticación.'}
        {phase === 'success' && 'Te estamos llevando al dashboard…'}
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-danger-bg/60 px-3 py-2 text-xs font-semibold text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {phase === 'credentials' && (
        <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-3">
          <Field
            icon={Mail}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            label="Email"
            autoFocus
          />
          <Field
            icon={Lock}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            label="Password"
          />
          <SubmitButton submitting={submitting} disabled={!email || !password}>
            Continuar
          </SubmitButton>
          {/* O1: link a forgot-password — antes no había recovery y un owner
              que perdía password quedaba lockout hasta reset manual en DB. */}
          <Link
            to="/forgot-password"
            className="self-center text-xs font-semibold text-neutral-500 hover:text-neutral-700"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      )}

      {phase === 'setup2fa' && setupData && (
        <Setup2FAStep
          totpUri={setupData.totpUri}
          secret={setupData.secret}
          totp={totp}
          setTotp={setTotp}
          submitting={submitting}
          onSubmit={handle2FASetup}
        />
      )}

      {phase === 'totp' && (
        <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-3">
          <TotpField totp={totp} setTotp={setTotp} />
          <SubmitButton submitting={submitting} disabled={totp.length !== 6}>
            Entrar
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setTotp('')
              setPhase('credentials')
            }}
            className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            ← Volver a email
          </button>
        </form>
      )}
    </div>
  )
}

function Setup2FAStep({
  totpUri,
  secret,
  totp,
  setTotp,
  submitting,
  onSubmit,
}: {
  totpUri: string
  secret: string
  totp: string
  setTotp: (v: string) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, totpUri, {
      width: 220,
      margin: 1,
      color: { dark: '#1f1d1e', light: '#ffffff' },
    }).catch(() => {})
  }, [totpUri])

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
        <canvas ref={canvasRef} className="rounded-lg" />
        <details className="w-full">
          <summary className="cursor-pointer text-center text-[11px] font-semibold text-neutral-500 hover:text-neutral-900">
            ¿No podés escanear? Mostrar secret
          </summary>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-center text-[11px] tracking-wider text-neutral-700 ring-1 ring-neutral-200">
            {secret}
          </code>
        </details>
      </div>

      <TotpField totp={totp} setTotp={setTotp} />
      <SubmitButton submitting={submitting} disabled={totp.length !== 6}>
        Activar 2FA
      </SubmitButton>
    </form>
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
  icon: any
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

function TotpField({ totp, setTotp }: { totp: string; setTotp: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
        Código 2FA
      </span>
      <div className="relative">
        <ShieldCheck
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
  // O2: opacity disabled subida de 50% → 70% + cursor-not-allowed para que
  // el botón se vea "bloqueado pero presente" en lugar de "apagado y muerto".
  // Antes Marina llegaba al login y el botón se veía tan translucido que
  // dudaba si estaba habilitado o roto.
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
