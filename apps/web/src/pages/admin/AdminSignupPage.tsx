import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Store,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Clock,
  Receipt,
  Eye,
  EyeOff,
} from 'lucide-react'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { merchantAuth } from '@/lib/merchantStore'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { billing } from '@/lib/api'

/**
 * Precio único $25.000/mes para el comercio. Es el precio FINAL que ve
 * el usuario en la landing comercial — no se le suma IVA arriba.
 * El backoffice maneja el IVA dentro de la factura.
 */
const PRECIO_TOTAL = 25_000

type Step = 'datos' | 'fiscal' | 'pago' | 'listo'
type CondicionFiscal = 'monotributo' | 'responsable_inscripto' | 'consumidor_final'

type Form = {
  nombreComercio: string
  categoria: Categoria
  categoriaOtro: string
  direccion: string
  telefono: string
  horarios: string
  emailAdmin: string
  password: string
  nombreAdmin: string
  cuit: string
  razonSocial: string
  condicionFiscal: CondicionFiscal
  direccionFiscal: string
  acceptedTc: boolean
}

const empty: Form = {
  nombreComercio: '',
  categoria: 'gastronomia',
  categoriaOtro: '',
  direccion: '',
  telefono: '',
  horarios: '',
  emailAdmin: '',
  password: '',
  nombreAdmin: '',
  cuit: '',
  razonSocial: '',
  condicionFiscal: 'monotributo',
  direccionFiscal: '',
  acceptedTc: false,
}

export function AdminSignupPage() {
  const [step, setStep] = useState<Step>('datos')
  const [form, setForm] = useState<Form>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }

  function validateDatos(): string | null {
    if (form.nombreComercio.trim().length < 3) return 'El nombre del comercio es muy corto'
    if (form.categoria === 'otro' && form.categoriaOtro.trim().length < 2)
      return 'Indicá qué tipo de comercio es'
    if (form.direccion.trim().length < 5) return 'Falta una dirección válida'
    if (!form.telefono.trim()) return 'Falta el teléfono'
    // Los horarios ya no son obligatorios al signup — se completan en el panel
    if (form.nombreAdmin.trim().length < 3) return 'Falta tu nombre completo'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin)) return 'Email inválido'
    if (form.password.length < 3) return 'La contraseña debe tener al menos 3 caracteres'
    return null
  }

  function validateFiscal(): string | null {
    const dni = form.cuit.replace(/\D/g, '')
    if (dni.length !== 11) return 'CUIT inválido (11 dígitos)'
    if (form.razonSocial.trim().length < 3) return 'Falta la razón social'
    if (form.direccionFiscal.trim().length < 5) return 'Falta la dirección fiscal'
    return null
  }

  function goNext() {
    if (step === 'datos') {
      const err = validateDatos()
      if (err) return setError(err)
      setStep('fiscal')
      return
    }
    if (step === 'fiscal') {
      const err = validateFiscal()
      if (err) return setError(err)
      setStep('pago')
      return
    }
  }

  async function handlePay() {
    if (!form.acceptedTc) {
      setError('Tenés que aceptar los términos y condiciones')
      return
    }
    setSubmitting(true)
    setError(null)

    const result = await merchantAuth.signup({
      comercio: {
        nombre: form.nombreComercio.trim(),
        categoria: form.categoria,
        categoriaOtro:
          form.categoria === 'otro' ? form.categoriaOtro.trim() : undefined,
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        horarios: form.horarios.trim(),
        cuit: form.cuit.replace(/\D/g, ''),
        razonSocial: form.razonSocial.trim(),
        condicionFiscal: form.condicionFiscal,
        direccionFiscal: form.direccionFiscal.trim(),
      },
      admin: {
        nombre: form.nombreAdmin.trim(),
        email: form.emailAdmin.trim().toLowerCase(),
        password: form.password,
      },
      acceptedTc: true,
    })
    if (result.ok) {
      // Disparamos el flujo de billing (Mercado Pago preapproval).
      // En production, redirigimos al checkout de MP. En development con
      // MP_ACCESS_TOKEN vacío, el backend devuelve init_point apuntando a
      // /admin/billing/mock-pay → en ese caso auto-confirmamos para que el
      // comercio quede activo y pueda usar el panel.
      try {
        const pre = await billing.createPreapproval()
        const ref = pre.subscription.externalReference
        const initPoint = pre.subscription.initPoint
        const isMock = initPoint.includes('/admin/billing/mock-pay')
        if (isMock) {
          await billing.mockConfirm(ref)
          setSubmitting(false)
          setStep('listo')
          toast.success('¡Comercio activo!', 'Pago simulado en dev. Ya podés usar el panel.')
          setTimeout(() => navigate('/admin', { replace: true }), 1500)
          return
        }
        // Producción real: redirigir al checkout de MP
        toast.info('Te llevamos a Mercado Pago…')
        window.location.href = initPoint
        return
      } catch {
        // Si el billing falla, igual dejamos al comercio entrar al panel
        // (queda pending_payment y desde Mi Comercio puede reintentar)
        setSubmitting(false)
        setStep('listo')
        toast.success(
          '¡Comercio creado!',
          'No pudimos iniciar el cobro automático. Probá desde "Mi Comercio".',
        )
        setTimeout(() => navigate('/admin', { replace: true }), 1500)
        return
      }
    }
    // El API rechazó el signup. Mostramos error y volvemos al primer paso si
    // el problema fue de email. No hay fallback local — todos los comercios
    // deben existir en la DB para poder validar cupones, recibir pagos, etc.
    setSubmitting(false)
    if (
      result.error.toLowerCase().includes('email') ||
      result.error.toLowerCase().includes('ya registrado')
    ) {
      setError(result.error)
      setStep('datos')
      return
    }
    setError(result.error || 'No pudimos crear el comercio. Reintentá en un momento.')
  }

  return (
    <div className="bg-violet-mesh min-h-[100svh] bg-primary-50 px-4 pt-8 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Link
          to="/admin/login"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft size={16} /> Volver al login
        </Link>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <Store size={26} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
              Sumá tu comercio · ${PRECIO_TOTAL.toLocaleString('es-AR')} / mes
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
              {step === 'datos' && 'Datos del comercio'}
              {step === 'fiscal' && 'Datos fiscales'}
              {step === 'pago' && 'Activá tu suscripción'}
              {step === 'listo' && '¡Bienvenido!'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {step === 'datos' && '3 minutos · Sin permanencia'}
              {step === 'fiscal' && 'Para emitir tu factura A o C'}
              {step === 'pago' && `${PRECIO_TOTAL.toLocaleString('es-AR')} ARS / mes · Precio congelado de por vida`}
              {step === 'listo' && 'Te estamos llevando al panel…'}
            </p>
          </div>
        </div>

        <Stepper step={step} />

        {step === 'datos' && (
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-floating ring-1 ring-neutral-100">
            <Field
              label="Nombre del comercio"
              required
              input={
                <input
                  type="text"
                  value={form.nombreComercio}
                  onChange={(e) => update('nombreComercio', e.target.value)}
                  placeholder="Ej: La Esquina"
                  className={inputCls}
                />
              }
            />
            <Field
              label="Categoría"
              required
              input={
                <select
                  value={form.categoria}
                  onChange={(e) => update('categoria', e.target.value as Categoria)}
                  className={inputCls}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              }
            />
            {form.categoria === 'otro' && (
              <Field
                label="¿Qué tipo de comercio?"
                required
                input={
                  <input
                    type="text"
                    value={form.categoriaOtro}
                    onChange={(e) => update('categoriaOtro', e.target.value)}
                    placeholder="Ej: rotisería, casa de regalos, peluquería canina…"
                    className={inputCls}
                  />
                }
              />
            )}
            <Field
              label="Dirección comercial"
              required
              input={
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => update('direccion', e.target.value)}
                  placeholder="Mitre 1247, San Pedro"
                  className={inputCls}
                />
              }
            />
            <Field
              label="Teléfono"
              required
              input={
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.telefono}
                  onChange={(e) => update('telefono', e.target.value)}
                  placeholder="(03329) 425-678"
                  className={inputCls}
                />
              }
            />
            <p className="text-[11px] text-neutral-500">
              <Clock size={10} className="mr-1 inline" />
              Los horarios de atención los cargás después desde el panel.
            </p>

            <div className="my-2 border-t border-neutral-100" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Cuenta del responsable
            </p>

            <Field
              label="Tu nombre"
              required
              input={
                <input
                  type="text"
                  value={form.nombreAdmin}
                  onChange={(e) => update('nombreAdmin', e.target.value)}
                  placeholder="Como en tu DNI"
                  className={inputCls}
                />
              }
            />
            <Field
              label="Email"
              required
              input={
                <input
                  type="email"
                  value={form.emailAdmin}
                  onChange={(e) => update('emailAdmin', e.target.value)}
                  placeholder="vos@tucomercio.com"
                  className={inputCls}
                />
              }
            />
            <Field
              label="Contraseña"
              required
              input={
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Mínimo 3 caracteres"
                    className={cn(inputCls, 'pr-11')}
                    minLength={3}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
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
              type="button"
              onClick={goNext}
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
            >
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 'fiscal' && (
          <FiscalStep
            form={form}
            update={update}
            error={error}
            onBack={() => setStep('datos')}
            onNext={goNext}
          />
        )}

        {step === 'pago' && (
          <PagoStep
            submitting={submitting}
            error={error}
            acceptedTc={form.acceptedTc}
            onAcceptTc={(v) => update('acceptedTc', v)}
            onPay={handlePay}
            onBack={() => setStep('fiscal')}
          />
        )}

        {step === 'listo' && <ListoStep form={form} />}
      </div>
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'datos', label: 'Datos' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'pago', label: 'Pago' },
    { id: 'listo', label: 'Listo' },
  ]
  const activeIdx = steps.findIndex((s) => s.id === step)
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
              i < activeIdx
                ? 'bg-status-success-bg text-status-success-fg'
                : i === activeIdx
                  ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                  : 'bg-white text-neutral-400 ring-1 ring-neutral-200',
            )}
          >
            {i < activeIdx ? <CheckCircle2 size={11} /> : <span>{i + 1}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <span
              className={cn(
                'h-0.5 w-6 rounded',
                i < activeIdx ? 'bg-status-success' : 'bg-neutral-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function FiscalStep({
  form,
  update,
  error,
  onBack,
  onNext,
}: {
  form: Form
  update: <K extends keyof Form>(key: K, value: Form[K]) => void
  error: string | null
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-floating ring-1 ring-neutral-100">
      <p className="rounded-xl bg-status-info-bg p-3 text-xs leading-snug text-status-info-fg">
        <Receipt className="mb-1 inline" size={14} /> Necesitamos estos datos para emitirte la factura
        A o C de la suscripción mensual. Si no facturás, podés poner tus datos personales.
      </p>
      <Field
        label="CUIT"
        required
        hint={`${form.cuit.length}/11`}
        help={
          form.cuit.length === 11
            ? `${form.cuit.slice(0, 2)}-${form.cuit.slice(2, 10)}-${form.cuit.slice(10)}`
            : '11 dígitos sin guiones'
        }
        input={
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={form.cuit}
            onChange={(e) => update('cuit', e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="20123456789"
            className={inputCls}
          />
        }
      />
      <Field
        label="Razón social"
        required
        input={
          <input
            type="text"
            value={form.razonSocial}
            onChange={(e) => update('razonSocial', e.target.value)}
            placeholder="Ej: La Esquina S.A. o Tu Nombre Apellido"
            className={inputCls}
          />
        }
      />
      <Field
        label="Condición fiscal"
        required
        input={
          <select
            value={form.condicionFiscal}
            onChange={(e) => update('condicionFiscal', e.target.value as CondicionFiscal)}
            className={inputCls}
          >
            <option value="monotributo">Monotributista</option>
            <option value="responsable_inscripto">Responsable Inscripto</option>
            <option value="consumidor_final">Consumidor Final</option>
          </select>
        }
      />
      <Field
        label="Domicilio fiscal"
        required
        input={
          <input
            type="text"
            value={form.direccionFiscal}
            onChange={(e) => update('direccionFiscal', e.target.value)}
            placeholder="Misma del comercio si corresponde"
            className={inputCls}
          />
        }
      />

      {error && (
        <p className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl bg-primary-100 px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-primary-200"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-4 py-3 text-sm font-bold text-white shadow-cta hover:-translate-y-0.5"
        >
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function PagoStep({
  submitting,
  error,
  acceptedTc,
  onAcceptTc,
  onPay,
  onBack,
}: {
  submitting: boolean
  error: string | null
  acceptedTc: boolean
  onAcceptTc: (v: boolean) => void
  onPay: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-3xl bg-white shadow-floating ring-1 ring-neutral-100">
        <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-5 text-white">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles size={11} /> Plan estándar comercio
          </div>
          <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight">
            ${PRECIO_TOTAL.toLocaleString('es-AR')}
            <span className="ml-1 text-base font-normal text-accent-50">/ mes</span>
          </p>
          <p className="mt-1 text-xs text-accent-50/90">
            Precio congelado de por vida · Sin permanencia · Cancelás cuando quieras
          </p>
        </div>
        <div className="px-5 pt-4 pb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
            Todo ilimitado · sin letra chica
          </p>
        </div>
        <ul className="flex flex-col gap-2 px-5 pb-5 text-sm text-neutral-700">
          <Bullet>
            <Highlight>Cupones ilimitados</Highlight> activos al mismo tiempo
          </Bullet>
          <Bullet>
            <Highlight>Validaciones ilimitadas</Highlight> por QR + código manual
          </Bullet>
          <Bullet>
            <Highlight>Clientes ilimitados</Highlight> en tu base, exportables a CSV
          </Bullet>
          <Bullet>
            <Highlight>Mensajes WhatsApp ilimitados</Highlight> a clientes individuales
          </Bullet>
          <Bullet>
            <Highlight>Campañas masivas WhatsApp</Highlight> · 4 envíos / mes
          </Bullet>
          <Bullet>
            <Highlight>Estadísticas en tiempo real</Highlight> de canjes, ahorro y patrones
          </Bullet>
          <Bullet>
            <Highlight>Notas internas</Highlight> sobre cada cliente (alergias, preferencias)
          </Bullet>
          <Bullet>
            <Highlight>Soporte por WhatsApp</Highlight> para todos los comercios adheridos
          </Bullet>
        </ul>
      </div>

      <div className="rounded-3xl bg-status-info-bg p-4 text-status-info-fg ring-1 ring-status-info/20">
        <p className="text-xs leading-snug">
          <strong>Derecho de arrepentimiento:</strong> tenés <strong>10 días</strong> para
          arrepentirte y solicitar reembolso completo (Ley 24.240 de Defensa del Consumidor).
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-200 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedTc}
          onChange={(e) => onAcceptTc(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent-500"
        />
        <span className="text-xs leading-snug text-neutral-700">
          Acepto los{' '}
          <Link
            to="/legal/terminos"
            target="_blank"
            className="font-bold text-accent-700 underline-offset-2 hover:underline"
          >
            Términos y Condiciones
          </Link>{' '}
          y la{' '}
          <Link
            to="/legal/privacidad"
            target="_blank"
            className="font-bold text-accent-700 underline-offset-2 hover:underline"
          >
            Política de Privacidad
          </Link>
          . Confirmo que tengo facultades para representar al comercio.
        </span>
      </label>

      {error && (
        <p className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onPay}
        disabled={submitting || !acceptedTc}
        className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Clock size={16} className="animate-pulse" /> Procesando pago…
          </>
        ) : (
          <>
            <CreditCard size={16} /> Pagar ${PRECIO_TOTAL.toLocaleString('es-AR')} y crear comercio
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
      >
        Volver a editar los datos fiscales
      </button>
    </div>
  )
}

function ListoStep({ form }: { form: Form }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-floating ring-1 ring-neutral-100">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-status-success-bg text-status-success-fg">
        <CheckCircle2 size={32} />
      </div>
      <h3 className="text-xl font-bold text-neutral-900">¡{form.nombreComercio} ya está dentro!</h3>
      <p className="text-sm text-neutral-500">
        Te enviamos un email a <strong>{form.emailAdmin}</strong> con los próximos pasos. Te
        estamos redirigiendo al panel…
      </p>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-neutral-900">{children}</span>
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-status-success" />
      {children}
    </li>
  )
}

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({
  label,
  input,
  required,
  hint,
  help,
}: {
  label: string
  input: React.ReactNode
  required?: boolean
  hint?: string
  /** Texto pequeño bajo el input — validación inline o ejemplo formateado. */
  help?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          {label} {required && <span className="text-status-error">*</span>}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-neutral-400">{hint}</span>}
      </div>
      {input}
      {help && <p className="text-[11px] text-neutral-400">{help}</p>}
    </label>
  )
}
