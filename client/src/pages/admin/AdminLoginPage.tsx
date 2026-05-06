import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Store, ShieldCheck, KeyRound, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'
import { MERCHANT_USERS } from '@/data/mockData'

export function AdminLoginPage() {
  const { session } = useMerchantSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  if (session) return <Navigate to="/admin" replace />

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setTimeout(() => {
      const result = merchantAuth.login(email, password)
      setSubmitting(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      navigate('/admin', { replace: true })
    }, 280)
  }

  function loginAs(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo123')
  }

  return (
    <div className="bg-violet-mesh min-h-[100svh] bg-primary-50 px-4 pt-10 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <Store size={26} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
              Panel del comercio
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
              Mi San Pedro
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Para comerciantes adheridos. Si sos vecino,{' '}
              <a href="#/" className="font-bold text-accent-700">
                volvé al inicio
              </a>
              .
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-floating ring-1 ring-neutral-100"
        >
          <Field
            label="Email"
            input={
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="cajero@tucomercio.com"
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
            <p className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
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

          <a
            href="#"
            className="text-center text-xs font-semibold text-neutral-500 hover:text-accent-700"
          >
            Olvidé mi contraseña
          </a>
        </form>

        <div className="rounded-3xl bg-white p-4 shadow-card ring-1 ring-neutral-100">
          <div className="flex items-start gap-2.5">
            <KeyRound size={14} className="mt-0.5 shrink-0 text-accent-500" />
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Cuentas demo
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Tap para autocompletar. Password: <span className="font-mono font-bold">demo123</span>
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                {MERCHANT_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => loginAs(u.email)}
                    className="flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2 text-left text-xs hover:bg-accent-50 hover:text-accent-700"
                  >
                    <span className="font-mono">{u.email}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {u.rol}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium">
            Las cuentas se crean desde el panel interno del programa, no son auto-registrables. Si
            sos comerciante y querés sumarte, contactá al equipo de Mi San Pedro.
          </p>
        </div>
      </div>
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
