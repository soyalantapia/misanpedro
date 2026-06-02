import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Mail, KeyRound } from 'lucide-react'
import { merchantApi, ApiError } from '@/lib/api'
import { useToast } from '@/components/Toast'

export function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await merchantApi.forgotPassword(email.trim().toLowerCase())
      setSent(true)
      toast.success('Listo', 'Si el email está registrado, te llega un link para resetear.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sin conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-violet-mesh min-h-[100svh] bg-bg px-4 pt-8 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Link
          to="/admin/login"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={16} /> Volver al login
        </Link>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
            <KeyRound size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {sent ? '¡Listo!' : 'Recuperar contraseña'}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {sent
                ? `Si ${email} existe en nuestra base, te enviamos un link para crear una contraseña nueva. Revisá tu inbox y la carpeta de spam.`
                : 'Te enviaremos un link a tu email para crear una nueva contraseña.'}
            </p>
          </div>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-floating ring-1 ring-line">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                Email del comercio
              </span>
              <div className="relative">
                <Mail
                  size={14}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@tucomercio.com"
                  className="w-full rounded-2xl bg-surface py-3 pl-10 pr-4 text-sm ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {submitting ? 'Enviando…' : 'Enviarme el link'}
            </button>
          </form>
        )}

        {sent && (
          <Link
            to="/admin/login"
            className="text-center text-sm font-semibold text-brand-strong hover:text-brand-strong"
          >
            Volver al login
          </Link>
        )}
      </div>
    </div>
  )
}
