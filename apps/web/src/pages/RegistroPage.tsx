import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Sparkles, User as UserIcon, Phone, Mail, KeyRound } from 'lucide-react'
import { activationActions, userActions } from '@/lib/stores'
import { useToast } from '@/components/Toast'
import { api, userApi, ApiError } from '@/lib/api'
import { purgeDemoDataForApiUser } from '@/lib/demoSeeder'
import { useTenant } from '@/lib/tenant'
import { validateClaim, type ClaimErrors } from '@/lib/validations/claim'

/**
 * Captura LIVIANA al primer canje (onboarding sin fricción): nombre + email +
 * teléfono + T&C. El vecino nuevo entra al instante, sin códigos. El EMAIL es
 * la identidad: si ya tiene cuenta con ese email, esta misma pantalla le pide
 * el código en vez de mandarlo a una pantalla de login aparte (acá no existe
 * "iniciar sesión": solo hay alta, y a veces la alta recupera una cuenta ya
 * creada). La sesión es permanente (no hay "Salir"). [cazabug S1-01]
 */
export function RegistroPage() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [acceptedTc, setAcceptedTc] = useState(false)
  const [errors, setErrors] = useState<ClaimErrors>({})
  const [submitting, setSubmitting] = useState(false)
  // 'datos' = alta normal · 'codigo' = el email ya tenía cuenta y hay que probarla
  const [fase, setFase] = useState<'datos' | 'codigo'>('datos')
  const [codigo, setCodigo] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const toast = useToast()

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const errs = validateClaim({ nombre, email, telefono, acceptedTc })
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      const data = await userApi.claim({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono,
        acceptedTc: true,
      })
      if (data.needsCode) {
        // El email ya tenía cuenta: no lo logueamos, le pedimos el código acá
        // mismo. Es el vecino que se cambió de celular. [cazabug S1-01]
        if (data._debugCode) setCodigo(data._debugCode)
        setFase('codigo')
        // Sin esto el botón de "Entrar y recuperar mis canjes" queda
        // deshabilitado para siempre: comparte el mismo estado `submitting`.
        setSubmitting(false)
        return
      }
      purgeDemoDataForApiUser()
      const user = data.user!
      userActions.replace({
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
      })
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

  async function handleCodigo(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const data = await userApi.verifyOtp(email.trim().toLowerCase(), codigo)
      purgeDemoDataForApiUser()
      userActions.replace({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        telefono: data.user.telefono,
      })
      navigate('/')
    } catch {
      setErrors({ email: 'Ese código no es correcto o ya venció. Pedí uno nuevo.' })
    } finally {
      setSubmitting(false)
    }
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
          Tu nombre, tu email y tu celular, una vez. El email es tu cuenta: con él la
          recuperás en cualquier celular.
        </p>
      </header>

      {fase === 'datos' && (
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

          <Field label="Email" error={errors.email} icon={Mail}>
            <input
              id="registro-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value)
                setErrors((x) => ({ ...x, email: undefined }))
              }}
              placeholder="tu@email.com"
              className={iconInputCls}
            />
          </Field>

          <Field
            label="Celular"
            error={errors.telefono}
            icon={Phone}
            help="Con código de área. Lo usa el comercio para identificarte al canjear."
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
      )}

      {fase === 'codigo' && (
        <form onSubmit={handleCodigo} className="flex flex-col gap-4">
          <div className="rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line">
            <p className="text-sm font-bold text-fin-ink">Ya tenés una cuenta con ese email</p>
            <p className="mt-1 text-xs text-fin-soft">
              Te mandamos un código de 6 dígitos a <span className="font-bold">{email}</span>.
              Ponelo acá y recuperás todos tus canjes.
            </p>
          </div>
          <Field label="Código" error={errors.email} icon={KeyRound}>
            <input
              id="registro-codigo"
              name="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full bg-transparent text-center text-2xl font-bold tracking-[0.4em] text-fin-ink outline-none placeholder:text-fin-faint"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting || codigo.length !== 6}
            className="rounded-2xl bg-fin-lime px-5 py-3.5 text-sm font-bold text-fin-bg shadow-fin-glow disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar y recuperar mis canjes'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFase('datos')
              setCodigo('')
              setErrors({})
            }}
            className="text-center text-xs font-bold text-fin-soft hover:text-fin-ink"
          >
            ← Usar otro email
          </button>
        </form>
      )}
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
