import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { merchantApi, ApiError } from '@/lib/api'
import { useToast } from '@/components/Toast'

export function AdminResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pwd.length < 8) return setError('Mínimo 8 caracteres')
    if (pwd !== confirm) return setError('Las contraseñas no coinciden')
    setSubmitting(true)
    setError(null)
    try {
      await merchantApi.resetPassword(token, pwd)
      setDone(true)
      toast.success('Contraseña actualizada', 'Ya podés ingresar con la nueva contraseña.')
      setTimeout(() => navigate('/admin/login', { replace: true }), 2000)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Link inválido o vencido. Pedí uno nuevo desde "olvidé mi contraseña".'
            : err.message,
        )
      } else {
        setError('Sin conexión')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="bg-violet-mesh min-h-[100svh] bg-primary-50 px-4 pt-12 pb-12 sm:px-6">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Link inválido</h1>
          <p className="text-sm text-neutral-500">El link de reseteo no es válido o vencido.</p>
          <Link
            to="/admin/forgot-password"
            className="rounded-2xl bg-accent-500 px-6 py-3 text-sm font-bold text-white shadow-cta"
          >
            Pedir uno nuevo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-violet-mesh min-h-[100svh] bg-primary-50 px-4 pt-8 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Link
          to="/admin/login"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft size={16} /> Volver al login
        </Link>

        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-floating ring-1 ring-neutral-100">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-status-success-bg text-status-success-fg">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Contraseña actualizada</h1>
            <p className="text-sm text-neutral-500">Te llevamos al login…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Crear nueva contraseña
            </h1>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-floating ring-1 ring-neutral-100"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Nueva contraseña
                </span>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-2xl bg-white px-4 py-3 pr-12 text-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:text-neutral-700"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Repetir contraseña
                </span>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-2xl bg-white px-4 py-3 pr-12 text-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:text-neutral-700"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                {submitting ? 'Guardando…' : 'Crear contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
