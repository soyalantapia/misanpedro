import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Sparkles } from 'lucide-react'
import { activationActions, userActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'
import { userApi, ApiError } from '@/lib/api'

type Errors = Partial<Record<keyof FormState, string>>

type FormState = {
  nombre: string
  dni: string
  email: string
  whatsapp: string
  fechaNacimiento: string
  acceptedTc: boolean
}

const initial: FormState = {
  nombre: '',
  dni: '',
  email: '',
  whatsapp: '',
  fechaNacimiento: '',
  acceptedTc: false,
}

export function RegistroPage() {
  const [form, setForm] = useState<FormState>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const toast = useToast()

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const errs: Errors = {}
    if (form.nombre.trim().length < 3) errs.nombre = 'Mínimo 3 caracteres'
    else if (form.nombre.trim().length > 80) errs.nombre = 'Máximo 80 caracteres'

    const dni = form.dni.replace(/\D/g, '')
    if (dni.length < 7 || dni.length > 8) errs.dni = '7 u 8 dígitos sin puntos'

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'

    const wa = form.whatsapp.replace(/\D/g, '')
    if (wa.length < 10) errs.whatsapp = 'Número con código de área'

    if (!form.fechaNacimiento) {
      errs.fechaNacimiento = 'Fecha requerida'
    } else {
      const dob = new Date(form.fechaNacimiento)
      const minAge = new Date()
      minAge.setFullYear(minAge.getFullYear() - 16)
      if (dob > minAge) errs.fechaNacimiento = 'Tenés que ser mayor de 16'
    }

    if (!form.acceptedTc) errs.acceptedTc = 'Necesitamos que aceptes los términos'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    const payload = {
      nombre: form.nombre.trim(),
      dni: form.dni.replace(/\D/g, ''),
      email: form.email.trim().toLowerCase(),
      whatsapp: form.whatsapp.trim(),
      fechaNacimiento: form.fechaNacimiento,
    }

    // Intentamos registrar contra el API; si falla (offline / backend caído)
    // caemos al store local para no romper la demo.
    try {
      await userApi.register({ ...payload, acceptedTc: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: err.payload?.error ?? 'Email ya registrado' })
        setSubmitting(false)
        return
      }
      // fallback offline: seguimos con userActions.register local
    }
    userActions.register(payload)
    toast.success('¡Cuenta creada!', 'Ya podés canjear descuentos.')
    const activarMatch = next.match(/^\/cupon\/([^/]+)\/activar$/)
    if (activarMatch) {
      const a = activationActions.activate(activarMatch[1])
      navigate(`/activacion/${a.id}`, { replace: true })
    } else {
      navigate(next, { replace: true })
    }
    setSubmitting(false)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Cancelar
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Sparkles size={12} /> Estás a un paso
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Creá tu cuenta para canjear
        </h1>
        <p className="text-sm text-neutral-500">
          Solo te lo pedimos esta vez. Después usás todos los descuentos sin volver a registrarte.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          ¿Ya tenés cuenta?{' '}
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className="font-bold text-accent-700 underline-offset-2 hover:underline"
          >
            Iniciar sesión con código
          </Link>
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Nombre completo"
          error={errors.nombre}
          input={
            <input
              type="text"
              autoComplete="name"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Como en tu DNI"
              className={inputCls}
            />
          }
        />
        <Field
          label="DNI"
          error={errors.dni}
          input={
            <input
              type="text"
              inputMode="numeric"
              value={form.dni}
              onChange={(e) => update('dni', e.target.value)}
              placeholder="Sin puntos ni espacios"
              className={inputCls}
            />
          }
        />
        <Field
          label="Email"
          error={errors.email}
          input={
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="vos@correo.com"
              className={inputCls}
            />
          }
        />
        <Field
          label="WhatsApp"
          error={errors.whatsapp}
          input={
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.whatsapp}
              onChange={(e) => update('whatsapp', e.target.value)}
              placeholder="+54 9 3329 …"
              className={inputCls}
            />
          }
        />
        <Field
          label="Fecha de nacimiento"
          error={errors.fechaNacimiento}
          input={
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => update('fechaNacimiento', e.target.value)}
              className={inputCls}
            />
          }
        />

        <label className="mt-2 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100">
          <input
            type="checkbox"
            checked={form.acceptedTc}
            onChange={(e) => update('acceptedTc', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-accent-500"
          />
          <span className="text-xs leading-relaxed text-neutral-600">
            Acepto los{' '}
            <a href="#" className="font-bold text-accent-700">
              términos y condiciones
            </a>{' '}
            y la{' '}
            <a href="#" className="font-bold text-accent-700">
              política de privacidad
            </a>{' '}
            de Mi San Pedro. Mis datos quedan protegidos por la Ley 25.326.
          </span>
        </label>
        {errors.acceptedTc && (
          <p className="-mt-2 text-xs font-semibold text-status-error">{errors.acceptedTc}</p>
        )}

        <div className="mt-2 flex items-start gap-3 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium">
            Tus datos personales nunca se comparten con terceros sin tu consentimiento. El comercio
            ve tu nombre solo cuando canjeás un cupón en su local.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Creando cuenta…' : 'Crear cuenta y canjear'}
        </button>
      </form>
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3.5 text-sm text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({
  label,
  input,
  error,
}: {
  label: string
  input: React.ReactNode
  error?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {input}
      {error && <span className="text-xs font-semibold text-status-error">{error}</span>}
    </label>
  )
}
