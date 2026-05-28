import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { owner } from '@/lib/api'

/**
 * O1: Reset de password con token del link de email.
 * El token tiene TTL 30 min y es single-use.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si no hay token en la URL → redirect a forgot
  useEffect(() => {
    if (!token) {
      const t = window.setTimeout(() => navigate('/login'), 2500)
      return () => window.clearTimeout(t)
    }
  }, [token, navigate])

  if (!token) {
    return (
      <div className="w-full rounded-2xl bg-white p-7 ring-1 ring-neutral-200">
        <p className="text-sm text-neutral-600">
          Falta el token de recuperación en la URL. Te llevamos al login…
        </p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Mínimo 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.resetPassword({ token, newPassword: password })
      if (res.ok) {
        setDone(true)
        window.setTimeout(() => navigate('/login'), 2500)
      } else {
        setError(res.error || 'No pudimos resetear la contraseña.')
      }
    } catch {
      setError('Error de red. Reintentá en un momento.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="w-full rounded-2xl bg-white p-7 text-center ring-1 ring-neutral-200">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success-bg text-success">
          <CheckCircle2 size={24} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-neutral-900">Contraseña actualizada</h1>
        <p className="mt-1 text-sm text-neutral-500">Te llevamos al login…</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl bg-white p-7 ring-1 ring-neutral-200">
      <h1 className="text-xl font-bold text-neutral-900">Nueva contraseña</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Elegí una nueva contraseña para tu cuenta de owner.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Nueva contraseña
          </span>
          <div className="relative">
            <Lock
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              className="w-full rounded-xl bg-neutral-50 py-2.5 pl-9 pr-10 text-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100"
            >
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Confirmar contraseña
          </span>
          <div className="relative">
            <Lock
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setError(null)
              }}
              placeholder="Repetí la contraseña"
              minLength={8}
              className="w-full rounded-xl bg-neutral-50 py-2.5 pl-9 pr-3 text-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg/60 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password || !confirm}
          className="group mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-accent-500/30 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {submitting ? 'Actualizando…' : 'Cambiar contraseña'}
          {!submitting && (
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          )}
        </button>

        <Link
          to="/login"
          className="mt-1 self-center text-xs font-semibold text-neutral-500 hover:text-neutral-700"
        >
          ← Volver al login
        </Link>
      </form>
    </div>
  )
}
