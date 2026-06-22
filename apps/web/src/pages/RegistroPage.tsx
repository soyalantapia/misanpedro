import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Sparkles, User as UserIcon, Phone } from 'lucide-react'
import { activationActions, userActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'
import { api, userApi, ApiError } from '@/lib/api'
import { purgeDemoDataForApiUser } from '@/lib/demoSeeder'
import { useTenant } from '@/lib/tenant'

type Errors = { nombre?: string; telefono?: string; acceptedTc?: string }

/**
 * Captura LIVIANA al primer canje (onboarding sin fricción): solo nombre +
 * teléfono + T&C. SIN OTP ni verificación — el cajero confirma en persona.
 * El teléfono es la identidad: en otro dispositivo, el mismo teléfono recupera
 * la cuenta y el ahorro. La sesión es permanente (no hay "Salir").
 */
export function RegistroPage() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [acceptedTc, setAcceptedTc] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const toast = useToast()

  function validate(): Errors {
    const e: Errors = {}
    if (nombre.trim().length < 2) e.nombre = 'Decinos tu nombre'
    if (telefono.replace(/\D/g, '').length < 8) e.telefono = 'Poné tu celular con código de área'
    if (!acceptedTc) e.acceptedTc = 'Necesitamos que aceptes los términos'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    let user
    try {
      const data = await userApi.claim({ nombre: nombre.trim(), telefono, acceptedTc: true })
      purgeDemoDataForApiUser()
      user = data.user
      userActions.replace({ id: user.id, nombre: user.nombre, telefono: user.telefono })
    } catch (err) {
      toast.error(
        'No pudimos guardarte',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
      setSubmitting(false)
      return
    }

    // Si veníamos de tocar "Canjear", activamos el cupón y vamos al código.
    const activarMatch = next.match(/^\/cupon\/([^/]+)\/activar$/)
    if (activarMatch) {
      try {
        const act = await api.activations.create(activarMatch[1])
        activationActions.activate(activarMatch[1], {
          id: act.activation.id,
          codigoNumerico: act.activation.codigoNumerico,
          qrPayload: act.activation.qrPayload,
        })
        navigate(`/activacion/${act.activation.id}`, { replace: true })
      } catch (err) {
        toast.error(
          'No pudimos activar tu cupón',
          err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
        )
        navigate(`/cupon/${activarMatch[1]}`, { replace: true })
      }
    } else {
      navigate(next, { replace: true })
    }
    setSubmitting(false)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
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
          ¿Cómo te llamás?
        </h1>
        <p className="text-sm text-fin-soft">
          Solo tu nombre y tu celular, una vez. Sin contraseñas ni códigos: tu teléfono es tu cuenta.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre" error={errors.nombre} icon={UserIcon}>
          <input
            id="registro-nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              setErrors((x) => ({ ...x, nombre: undefined }))
            }}
            placeholder="Tu nombre"
            className={iconInputCls}
            autoFocus
          />
        </Field>

        <Field
          label="Celular"
          error={errors.telefono}
          icon={Phone}
          help="Con código de área. Es tu cuenta: con el mismo número recuperás tu ahorro en cualquier celular."
        >
          <input
            id="registro-telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value)
              setErrors((x) => ({ ...x, telefono: undefined }))
            }}
            placeholder="3329 555444"
            className={iconInputCls}
          />
        </Field>

        <label className="mt-1 flex items-start gap-3 rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line shadow-fin-card">
          <input
            id="registro-acepto-tc"
            name="acceptedTc"
            type="checkbox"
            checked={acceptedTc}
            onChange={(e) => {
              setAcceptedTc(e.target.checked)
              setErrors((x) => ({ ...x, acceptedTc: undefined }))
            }}
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
            de {appName}. Mis datos quedan protegidos por la Ley 25.326.
          </span>
        </label>
        {errors.acceptedTc && (
          <p role="alert" className="-mt-2 text-xs font-semibold text-fin-danger">
            {errors.acceptedTc}
          </p>
        )}

        <div className="mt-1 flex items-start gap-3 rounded-2xl bg-fin-surface2 p-4 text-fin-soft ring-1 ring-fin-line">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-fin-lime" />
          <p className="text-xs font-medium">
            El comercio ve tu nombre solo cuando canjeás un cupón en su local. Nunca compartimos tus
            datos con terceros.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-fin-lime px-6 py-4 text-base font-bold text-fin-bg shadow-fin-glow transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Un segundo…' : 'Canjear mi cupón'}
        </button>
      </form>
    </div>
  )
}

const iconInputCls =
  'w-full rounded-2xl bg-fin-surface py-3.5 pl-11 pr-4 text-sm text-fin-ink ring-1 ring-fin-line placeholder:text-fin-faint focus:outline-none focus:ring-2 focus:ring-fin-lime'

function Field({
  label,
  children,
  error,
  help,
  icon: Icon,
}: {
  label: string
  children: React.ReactNode
  error?: string
  help?: string
  icon: typeof Phone
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-fin-faint">{label}</span>
      <div className="relative">
        <Icon
          size={14}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fin-faint"
        />
        {children}
      </div>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-fin-danger">
          {error}
        </span>
      ) : (
        help && <span className="text-[11px] text-fin-faint">{help}</span>
      )}
    </label>
  )
}
