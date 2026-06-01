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
import { COUNTRY_CODES, DEFAULT_COUNTRY, getCountry } from '@/lib/countryCodes'
import { getSupportLink } from '@/lib/tenant'

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
  // WhatsApp con selector de país (default Argentina). Guardamos el número
  // aparte y combinamos "+<dial> <número>" en form.whatsapp.
  const [pais, setPais] = useState(DEFAULT_COUNTRY)
  const [waNumero, setWaNumero] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // El vecino ya tiene cuenta (409 en registro): mostramos una salida clara
  // para recuperar el acceso, ya que no hay login OTP.
  const [returningUser, setReturningUser] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const toast = useToast()
  const support = getSupportLink(
    'Hola, ya tengo cuenta en Mi San Pedro y necesito recuperar el acceso (cambié de teléfono o limpié la app).',
    'Recuperar mi cuenta',
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    if (returningUser) setReturningUser(false)
  }

  function setWhatsapp(nextPais: string, nextNumero: string) {
    const dial = getCountry(nextPais).dial
    const num = nextNumero.replace(/[^\d\s]/g, '').trim()
    update('whatsapp', num ? `+${dial} ${num}` : '')
  }

  function validate(): Errors {
    return validateRegistro(form)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0]
      document
        .querySelector(`[data-field="${firstKey}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    const payload = {
      nombre: form.nombre.trim(),
      dni: form.dni.replace(/\D/g, ''),
      email: form.email.trim().toLowerCase(),
      whatsapp: form.whatsapp.trim(),
      fechaNacimiento: form.fechaNacimiento,
    }

    try {
      const data = await userApi.register({ ...payload, acceptedTc: true })
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
        const nextErr: Errors = {}
        if (msg.includes('whatsapp')) nextErr.whatsapp = 'Ese WhatsApp ya está cargado'
        else if (msg.includes('dni')) nextErr.dni = 'Ese DNI ya está cargado'
        else nextErr.email = 'Ese email ya está cargado'
        setErrors(nextErr)
        setReturningUser(true)
        setSubmitting(false)
        return
      }
      toast.error(
        'No pudimos guardar tus datos',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
      setSubmitting(false)
      return
    }
    toast.success('¡Listo!', 'Ya podés canjear descuentos.')
    const activarMatch = next.match(/^\/cupon\/([^/]+)\/activar$/)
    if (activarMatch) {
      try {
        const data = await userApi.me()
        void data
      } catch {
        /* noop */
      }
      try {
        const act = await api.activations.create(activarMatch[1])
        activationActions.activate(activarMatch[1], {
          id: act.activation.id,
          codigoNumerico: act.activation.codigoNumerico,
          qrPayload: act.activation.qrPayload,
        })
        navigate(`/activacion/${act.activation.id}`, { replace: true })
      } catch {
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
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-fin-soft hover:text-fin-ink"
      >
        <ChevronLeft size={16} /> Volver
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fin-surface2 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fin-lime ring-1 ring-fin-line">
          <Sparkles size={12} /> Estás a un paso
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-fin-ink sm:text-4xl">
          Completá tus datos para canjear
        </h1>
        <p className="text-sm text-fin-soft">
          Dos minutos, una sola vez. Después es un tap para canjear cualquier descuento.
        </p>
      </header>

      {returningUser && (
        <div className="flex flex-col gap-2 rounded-2xl bg-fin-surface2 p-4 ring-1 ring-fin-line shadow-fin-card">
          <p className="text-sm font-bold text-fin-ink">Estos datos ya están cargados</p>
          <p className="text-xs leading-relaxed text-fin-soft">
            Ya nos dejaste tus datos antes. Si cambiaste de teléfono o limpiaste la app y quedaste
            afuera, escribinos y te devolvemos el acceso en un toque.
          </p>
          <a
            href={support.href}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-fin-lime px-4 py-2 text-xs font-bold text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5"
          >
            {support.label}
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Nombre completo"
          required
          fieldKey="nombre"
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
          fieldKey="dni"
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
          fieldKey="email"
          icon={Mail}
          help="Lo usamos para identificarte y avisarte novedades"
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
          fieldKey="whatsapp"
          help="Elegí tu país y escribí el número con código de área (sin el código de país)."
          error={errors.whatsapp}
          input={
            <div className="flex gap-2">
              <select
                aria-label="Código de país"
                value={pais}
                onChange={(e) => {
                  setPais(e.target.value)
                  setWhatsapp(e.target.value, waNumero)
                }}
                className={`${inputCls} w-32 shrink-0`}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.flag} +{c.dial}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Phone
                  size={14}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fin-faint"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={waNumero}
                  onChange={(e) => {
                    setWaNumero(e.target.value)
                    setWhatsapp(pais, e.target.value)
                  }}
                  placeholder="9 3329 555444"
                  className={iconInputCls}
                />
              </div>
            </div>
          }
        />
        <Field
          label="Fecha de nacimiento"
          required
          fieldKey="fechaNacimiento"
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

        <label
          data-field="acceptedTc"
          className="mt-2 flex items-start gap-3 rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line shadow-fin-card"
        >
          <input
            type="checkbox"
            checked={form.acceptedTc}
            onChange={(e) => update('acceptedTc', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-fin-lime"
          />
          <span className="text-xs leading-relaxed text-fin-soft">
            Acepto los{' '}
            <Link
              to="/legal/terminos"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-fin-lime underline-offset-2 hover:underline"
            >
              términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link
              to="/legal/privacidad"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-fin-lime underline-offset-2 hover:underline"
            >
              política de privacidad
            </Link>{' '}
            de Mi San Pedro. Mis datos quedan protegidos por la Ley 25.326.
          </span>
        </label>
        {errors.acceptedTc && (
          <p role="alert" className="-mt-2 text-xs font-semibold text-fin-danger">{errors.acceptedTc}</p>
        )}

        <div className="mt-2 flex items-start gap-3 rounded-2xl bg-fin-surface2 p-4 text-fin-soft ring-1 ring-fin-line">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-fin-lime" />
          <p className="text-xs font-medium">
            Tus datos personales nunca se comparten con terceros sin tu consentimiento. El comercio
            ve tu nombre solo cuando canjeás un cupón en su local.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-lime px-6 py-4 text-base font-bold text-fin-bg shadow-fin-glow transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Guardar y canjear'}
        </button>
      </form>
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-fin-surface px-4 py-3.5 text-sm text-fin-ink ring-1 ring-fin-line placeholder:text-fin-faint focus:outline-none focus:ring-2 focus:ring-fin-lime'

const iconInputCls =
  'w-full rounded-2xl bg-fin-surface py-3.5 pl-11 pr-4 text-sm text-fin-ink ring-1 ring-fin-line placeholder:text-fin-faint focus:outline-none focus:ring-2 focus:ring-fin-lime'

function Field({
  label,
  input,
  error,
  help,
  required,
  icon: Icon,
  fieldKey,
}: {
  label: string
  input: React.ReactNode
  error?: string
  help?: string
  required?: boolean
  icon?: typeof Mail
  fieldKey?: string
}) {
  return (
    <label className="flex flex-col gap-1.5" data-field={fieldKey}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        {label}
        {required && <span className="ml-1 text-fin-danger">*</span>}
      </span>
      <div className={Icon ? 'relative' : ''}>
        {Icon && (
          <Icon
            size={14}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fin-faint"
          />
        )}
        {input}
      </div>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-fin-danger">{error}</span>
      ) : (
        help && <span className="text-[11px] text-fin-faint">{help}</span>
      )}
    </label>
  )
}
