import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  IdCard,
  Mail,
  Phone,
} from 'lucide-react'
import { activationActions, userActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'
import { api, userApi, ApiError } from '@/lib/api'
import { purgeDemoDataForApiUser } from '@/lib/demoSeeder'
import { validateRegistro, type RegistroForm, type RegistroErrors } from '@/lib/validations/registro'

type Errors = RegistroErrors

type FormState = RegistroForm

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
    return validateRegistro(form)
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

    // Registramos contra el API. Sin fallback local: si falla, el usuario
    // tiene que reintentar. Es la única forma de garantizar que la cuenta
    // exista en la DB y pueda usar canjes/notificaciones reales.
    try {
      const data = await userApi.register({ ...payload, acceptedTc: true })
      // Vecino real: descartamos demoUsers + activations seed previos
      purgeDemoDataForApiUser()
      userActions.replace({
        id: data.user.id,
        nombre: data.user.nombre,
        dni: data.user.dni,
        email: data.user.email,
        whatsapp: data.user.whatsapp,
        fechaNacimiento: data.user.fechaNacimiento,
        acceptedTcAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = (err.payload?.error ?? '').toString().toLowerCase()
        const next: Errors = {}
        if (msg.includes('whatsapp')) next.whatsapp = err.payload.error
        else if (msg.includes('dni')) next.dni = err.payload.error
        else next.email = err.payload?.error ?? 'Email ya registrado'
        setErrors(next)
        setSubmitting(false)
        return
      }
      // 5xx / network: mostramos error visible, NO seguimos con local
      toast.error(
        'No pudimos crear tu cuenta',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
      setSubmitting(false)
      return
    }
    toast.success('¡Cuenta creada!', 'Ya podés canjear descuentos.')
    const activarMatch = next.match(/^\/cupon\/([^/]+)\/activar$/)
    if (activarMatch) {
      // Activar el cupón vía API (NO usar activationActions.activate local
      // que generaría id `a-xxx` que el backend no reconoce).
      try {
        const data = await userApi.me() // sólo para confirmar token; opcional
        void data
      } catch {
        /* noop */
      }
      try {
        const act = await api.activations.create(activarMatch[1])
        // Espejar al store local con el id Mongo
        activationActions.activate(activarMatch[1], {
          id: act.activation.id,
          codigoNumerico: act.activation.codigoNumerico,
          qrPayload: act.activation.qrPayload,
        })
        navigate(`/activacion/${act.activation.id}`, { replace: true })
      } catch {
        // si falla la activación, llevamos al user al detalle del cupón
        navigate(`/cupon/${activarMatch[1]}`, { replace: true })
      }
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
        <ChevronLeft size={16} /> Volver
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Sparkles size={12} /> Estás a un paso
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Creá tu cuenta para canjear
        </h1>
        <p className="text-sm text-neutral-500">
          Dos minutos, una sola vez. Después es un tap para canjear cualquier descuento.
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
          required
          icon={UserIcon}
          error={errors.nombre}
          input={
            <input
              type="text"
              autoComplete="name"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Como en tu DNI"
              className={iconInputCls}
            />
          }
        />
        <Field
          label="DNI"
          required
          icon={IdCard}
          help="Sólo números, sin puntos"
          error={errors.dni}
          input={
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={9}
              value={form.dni}
              onChange={(e) => update('dni', e.target.value.replace(/\D/g, ''))}
              placeholder="30123456"
              className={iconInputCls}
            />
          }
        />
        <Field
          label="Email"
          required
          icon={Mail}
          help="Te enviamos un código por email para iniciar sesión"
          error={errors.email}
          input={
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="vos@correo.com"
              className={iconInputCls}
            />
          }
        />
        <Field
          label="WhatsApp"
          required
          icon={Phone}
          help="Formato internacional: +54 9 [código área] [número] · Ej: +54 9 3329 555444"
          error={errors.whatsapp}
          input={
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.whatsapp}
              onChange={(e) => update('whatsapp', e.target.value)}
              placeholder="+54 9 3329 555444"
              className={iconInputCls}
            />
          }
        />
        <Field
          label="Fecha de nacimiento"
          required
          help="Tenés que ser mayor de 16"
          error={errors.fechaNacimiento}
          input={
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => update('fechaNacimiento', e.target.value)}
              className={inputCls}
              max={new Date().toISOString().slice(0, 10)}
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
            <Link
              to="/legal/terminos"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-accent-700 underline-offset-2 hover:underline"
            >
              términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link
              to="/legal/privacidad"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-accent-700 underline-offset-2 hover:underline"
            >
              política de privacidad
            </Link>{' '}
            de Mi San Pedro. Mis datos quedan protegidos por la Ley 25.326.
          </span>
        </label>
        {errors.acceptedTc && (
          <p role="alert" className="-mt-2 text-xs font-semibold text-status-error">{errors.acceptedTc}</p>
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

/** Input variante con padding-left para acomodar el icono. */
const iconInputCls =
  'w-full rounded-2xl bg-white py-3.5 pl-11 pr-4 text-sm text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({
  label,
  input,
  error,
  help,
  required,
  icon: Icon,
}: {
  label: string
  input: React.ReactNode
  error?: string
  /** Texto de ayuda debajo del input (neutral). */
  help?: string
  /** Muestra asterisco rojo en el label. */
  required?: boolean
  /** Icono lucide-react que se renderiza dentro del input (izquierda). */
  icon?: typeof Mail
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
        {required && <span className="ml-1 text-status-error">*</span>}
      </span>
      <div className={Icon ? 'relative' : ''}>
        {Icon && (
          <Icon
            size={14}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
          />
        )}
        {input}
      </div>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-status-error-fg">{error}</span>
      ) : (
        help && <span className="text-[11px] text-neutral-400">{help}</span>
      )}
    </label>
  )
}
