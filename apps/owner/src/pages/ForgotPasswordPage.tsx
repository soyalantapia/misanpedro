import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { owner } from '@/lib/api'

/**
 * O1: Recovery de password del owner.
 * Anti-enumeration: el endpoint siempre devuelve OK aunque el email no exista,
 * por lo que el copy del éxito es genérico ("si el email existe te llega...").
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Ingresá tu email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Email inválido.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await owner.forgotPassword(trimmed.toLowerCase())
      setSent(true)
    } catch {
      setError('No pudimos procesar el pedido. Reintentá en un momento.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full rounded-2xl bg-white p-7 ring-1 ring-neutral-200">
        <h1 className="text-xl font-bold text-neutral-900">Revisá tu email</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Si el email <strong>{email}</strong> está asociado a una cuenta de owner, te llegó un
          link para resetear la contraseña. El link vale por <strong>30 minutos</strong>.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          No te llega? Revisá la carpeta de spam o pedí otro pedido en unos minutos.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft size={12} /> Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl bg-white p-7 ring-1 ring-neutral-200">
      <h1 className="text-xl font-bold text-neutral-900">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Te mandamos un link al email para resetearla.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Email
          </span>
          <div className="relative">
            <Mail
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              placeholder="vos@misanpedro.app"
              className="w-full rounded-xl bg-neutral-50 py-2.5 pl-9 pr-3 text-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
              aria-invalid={!!error}
              autoFocus
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
          disabled={submitting || !email}
          className="group mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-accent-500/30 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {submitting ? 'Enviando…' : 'Enviar link de recuperación'}
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
