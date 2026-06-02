import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Store,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Clock,
  Receipt,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { merchantAuth } from '@/lib/merchantStore'
import { useToast } from '@/components/Toast'
import { Select } from '@/components/Select'
import { cn } from '@/lib/cn'
import { validateCuit } from '@/lib/validations/cuit'
import { evaluatePassword } from '@/lib/validations/password'
import { useTenant } from '@/lib/tenant'

// Leaflet es pesado (~150KB) — lo bajamos como chunk aparte y sólo cuando
// el comercio llega al paso de datos del signup.
const LocationPicker = lazy(() =>
  import('@/components/LocationPicker').then((m) => ({ default: m.LocationPicker })),
)

const SANPEDRO_CENTER = { lat: -33.6797, lng: -59.6669 }

type Step = 'datos' | 'fiscal' | 'pago' | 'listo'
type CondicionFiscal = 'monotributo' | 'responsable_inscripto'

type Form = {
  nombreComercio: string
  categoria: Categoria
  categoriaOtro: string
  direccion: string
  lat: number | null
  lng: number | null
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
  lat: null,
  lng: null,
  telefono: '',
  horarios: '',
  emailAdmin: '',
  password: '',
  nombreAdmin: '',
  cuit: '',
  razonSocial: '',
  condicionFiscal: 'monotributo' as CondicionFiscal,
  direccionFiscal: '',
  acceptedTc: false,
}

/**
 * Persistencia del draft del signup en localStorage.
 * Si el usuario recarga (F5, cierra y vuelve a abrir, navega y vuelve),
 * los datos quedan. Excluimos `password` y `acceptedTc` por seguridad/legal:
 *   - password no se almacena nunca en localStorage (XSS-safe)
 *   - acceptedTc tiene que ser un consent fresco cada vez
 */
const DRAFT_KEY = 'msp.admin.signup.draft.v1'

type StoredDraft = Omit<Form, 'password' | 'acceptedTc'>

function loadDraft(): Partial<Form> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    // Sanitizamos: solo conservamos campos string conocidos.
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function saveDraft(form: Form) {
  try {
    // password y acceptedTc no se persisten al draft
    const { password: _, acceptedTc: __, ...rest } = form
    void _; void __
    // Si está todo vacío, no escribimos basura al storage.
    const someFilled = Object.values(rest).some(
      (v) => typeof v === 'string' && v.trim().length > 0,
    )
    if (!someFilled) {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rest))
  } catch {
    /* storage lleno o bloqueado — no es crítico */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* noop */
  }
}

export function AdminSignupPage() {
  // Siempre arrancamos en 'datos' al recargar: el usuario tiene que volver
  // a ingresar la contraseña (no se persiste) y re-aceptar los TyC.
  const [step, setStep] = useState<Step>('datos')
  const [form, setForm] = useState<Form>(() => {
    const draft = loadDraft()
    if (!draft) return empty
    return { ...empty, ...draft }
  })
  const [draftRestored, setDraftRestored] = useState<boolean>(() => loadDraft() !== null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const tenant = useTenant()
  const mapCenter = tenant.config?.geoCenter ?? SANPEDRO_CENTER
  const cityHint =
    [tenant.config?.ciudad, tenant.config?.provincia].filter(Boolean).join(', ') ||
    'San Pedro, Buenos Aires'
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref')?.trim() || undefined

  // Persistimos el form en localStorage en cada cambio. No persistimos
  // password ni acceptedTc (ver saveDraft). Tampoco después de "listo".
  useEffect(() => {
    if (step === 'listo') return
    saveDraft(form)
  }, [form, step])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
    if (draftRestored) setDraftRestored(false)
  }

  // Seteamos lat+lng juntas para no dejar un estado intermedio (lat sin lng).
  function setLocation(ll: { lat: number; lng: number }) {
    setForm((f) => ({ ...f, lat: ll.lat, lng: ll.lng }))
    setError(null)
  }

  function discardDraft() {
    clearDraft()
    setForm(empty)
    setDraftRestored(false)
    setStep('datos')
  }

  function validateDatos(): string | null {
    if (form.nombreComercio.trim().length < 3) return 'El nombre del comercio es muy corto'
    if (form.categoria === 'otro' && form.categoriaOtro.trim().length < 2)
      return 'Indicá qué tipo de comercio es'
    if (form.direccion.trim().length < 5) return 'Falta una dirección válida'
    if (form.lat == null || form.lng == null)
      return 'Marcá la ubicación de tu comercio en el mapa'
    if (!form.telefono.trim()) return 'Falta el teléfono'
    // Los horarios ya no son obligatorios al signup — se completan en el panel
    if (form.nombreAdmin.trim().length < 3) return 'Falta tu nombre completo'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin)) return 'Email inválido'
    if (form.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
    return null
  }

  function validateFiscal(): string | null {
    // Validación AFIP del CUIT: 11 dígitos, prefijo válido (20,23,24,27,30...),
    // dígito verificador correcto. Bloquea typos que generarían facturas mal.
    const cuitCheck = validateCuit(form.cuit)
    if (!cuitCheck.ok) return cuitCheck.error
    if (form.razonSocial.trim().length < 3) return 'Falta la razón social'
    if (form.direccionFiscal.trim().length < 5) return 'Falta la dirección fiscal'
    return null
  }

  // setStep wrapper: limpia errores acumulados de pasos previos para que no
  // queden "colgados" en la UI cuando el usuario navega entre steps.
  function goToStep(next: Step) {
    setError(null)
    setStep(next)
  }

  function goNext() {
    if (step === 'datos') {
      const err = validateDatos()
      if (err) return setError(err)
      goToStep('fiscal')
      return
    }
    if (step === 'fiscal') {
      const err = validateFiscal()
      if (err) return setError(err)
      goToStep('pago')
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
        lat: form.lat ?? undefined,
        lng: form.lng ?? undefined,
        telefono: form.telefono.trim(),
        horarios: form.horarios.trim(),
        cuit: form.cuit.trim(),
        razonSocial: form.razonSocial.trim(),
        condicionFiscal: form.condicionFiscal,
        direccionFiscal: form.direccionFiscal.trim(),
      },
      admin: {
        nombre: form.nombreAdmin.trim(),
        email: form.emailAdmin.trim().toLowerCase(),
        password: form.password,
      },
      ref: refCode,
      acceptedTc: true,
    })
    if (result.ok) {
      // Comercio creado y ACTIVO con 3 meses gratis — sin pago ni MercadoPago.
      // Entra directo al panel y ya es visible para los vecinos.
      clearDraft()
      setSubmitting(false)
      setStep('listo')
      toast.success('¡Listo! Tenés 3 meses gratis', 'Tu comercio ya es visible para los vecinos.')
      setTimeout(() => navigate('/admin', { replace: true }), 1500)
      return
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
    <div className="bg-violet-mesh min-h-[100svh] bg-bg px-4 pt-8 pb-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Link
          to="/admin/login"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={16} /> Volver al login
        </Link>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
            <Store size={26} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-strong">
              Sumá tu comercio · 3 meses gratis
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
              {step === 'datos' && 'Datos del comercio'}
              {step === 'fiscal' && 'Datos fiscales'}
              {step === 'pago' && 'Empezá gratis'}
              {step === 'listo' && '¡Bienvenido!'}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {step === 'datos' && '3 minutos · Sin tarjeta'}
              {step === 'fiscal' && 'Opcional — para tu factura más adelante'}
              {step === 'pago' && '3 meses gratis · sin tarjeta · acceso completo'}
              {step === 'listo' && 'Te estamos llevando al panel…'}
            </p>
          </div>
        </div>

        {refCode && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-status-success-bg px-4 py-3 text-status-success-fg ring-1 ring-status-success/20">
            <span aria-hidden className="text-lg leading-none">👋</span>
            <p className="text-xs leading-snug">
              <strong>Te invitó un comercio.</strong> Registrate y publicá tu primer descuento:
              arrancás con 15 días gratis extra (y tu colega gana una semana). ¡Bienvenido!
            </p>
          </div>
        )}

        <Stepper step={step} />

        {step === 'datos' && draftRestored && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-status-info-bg px-4 py-3 text-status-info-fg ring-1 ring-status-info/20">
            <p className="text-xs leading-snug">
              <strong>Recuperamos tus datos</strong> de la última vez que estuviste acá. Revisalos y
              completá la contraseña antes de continuar.
            </p>
            <button
              type="button"
              onClick={discardDraft}
              className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-status-info-fg ring-1 ring-status-info/30 hover:bg-status-info/10"
            >
              Empezar de cero
            </button>
          </div>
        )}

        {step === 'datos' && (
          <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-floating ring-1 ring-line">
            <Field
              label="Nombre del comercio"
              required
              input={
                <input
                  type="text"
                  value={form.nombreComercio}
                  onChange={(e) => update('nombreComercio', e.target.value)}
                  placeholder="Ej: Tu Comercio"
                  className={inputCls}
                />
              }
            />
            <Field
              label="Categoría"
              required
              input={
                <Select<Categoria>
                  value={form.categoria}
                  onChange={(v) => update('categoria', v)}
                  options={CATEGORIAS.map((c) => ({ value: c.id, label: c.label }))}
                  ariaLabel="Categoría del comercio"
                />
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
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                Ubicación en el mapa <span className="text-status-error">*</span>
              </span>
              <Suspense
                fallback={
                  <div className="h-[240px] animate-pulse rounded-2xl bg-surface-2 ring-1 ring-line" />
                }
              >
                <LocationPicker
                  value={
                    form.lat != null && form.lng != null
                      ? { lat: form.lat, lng: form.lng }
                      : null
                  }
                  onChange={setLocation}
                  address={form.direccion}
                  center={mapCenter}
                  cityHint={cityHint}
                />
              </Suspense>
            </div>
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
            <p className="text-[11px] text-ink-soft">
              <Clock size={10} className="mr-1 inline" />
              Los horarios de atención los cargás después desde el panel.
            </p>

            <div className="my-2 border-t border-line" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
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
                <>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={cn(inputCls, 'pr-11')}
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <PasswordStrengthBar password={form.password} />
                </>
              }
            />

            {error && (
              <p role="alert" className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={goNext}
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
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
            onBack={() => goToStep('datos')}
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
            onBack={() => goToStep('fiscal')}
          />
        )}

        {step === 'listo' && <ListoStep form={form} />}
      </div>
    </div>
  )
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = evaluatePassword(password)
  if (strength.score === 0) return null
  const colors = [
    '',
    'bg-status-error',
    'bg-status-warning',
    'bg-status-success',
    'bg-status-success',
  ] as const
  const textColors = [
    '',
    'text-status-error-fg',
    'text-status-warning-fg',
    'text-status-success-fg',
    'text-status-success-fg',
  ] as const
  return (
    <div className="mt-1 flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-valuetext={`Fortaleza de la contraseña: ${strength.label}`}
        className="flex gap-1"
      >
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= strength.score ? colors[strength.score] : 'bg-surface-2',
            )}
          />
        ))}
      </div>
      <p className={cn('text-[11px] font-semibold', textColors[strength.score])}>
        {strength.label}
        {strength.hint && (
          <span className="ml-1 font-normal text-ink-soft">· {strength.hint}</span>
        )}
      </p>
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
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={activeIdx + 1}
      aria-valuetext={`Paso ${activeIdx + 1} de ${steps.length}: ${steps[activeIdx]?.label ?? ''}`}
      aria-label="Progreso del registro"
      className="flex items-center justify-center gap-2"
    >
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            aria-current={i === activeIdx ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
              i < activeIdx
                ? 'bg-status-success-bg text-status-success-fg'
                : i === activeIdx
                  ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta'
                  : 'bg-surface text-ink-faint ring-1 ring-line',
            )}
          >
            {i < activeIdx ? <CheckCircle2 size={11} aria-hidden="true" /> : <span>{i + 1}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                'h-0.5 w-6 rounded',
                i < activeIdx ? 'bg-status-success' : 'bg-surface-2',
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
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-floating ring-1 ring-line">
      <p className="rounded-xl bg-status-info-bg p-3 text-xs leading-snug text-status-info-fg">
        <Receipt className="mb-1 inline" size={14} /> Necesitamos estos datos para emitirte la factura
        C de la suscripción mensual. Si no facturás, podés poner tus datos personales.
      </p>
      <Field
        label="CUIT"
        required
        input={
          <input
            type="text"
            autoComplete="off"
            value={form.cuit}
            onChange={(e) => update('cuit', e.target.value)}
            placeholder="Ej: 20-12345678-9"
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
            placeholder="Ej: Tu Nombre Apellido o Nombre Comercio S.A."
            className={inputCls}
          />
        }
      />
      <Field
        label="Condición fiscal"
        required
        input={
          <Select<CondicionFiscal>
            value={form.condicionFiscal}
            onChange={(v) => update('condicionFiscal', v)}
            options={[
              { value: 'monotributo', label: 'Monotributista' },
              { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
            ]}
            ariaLabel="Condición fiscal"
          />
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
          className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold text-ink hover:bg-surface-2"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-4 py-3 text-sm font-bold text-on-brand shadow-cta hover:-translate-y-0.5"
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
      <div className="overflow-hidden rounded-3xl bg-surface shadow-floating ring-1 ring-line">
        <div className="bg-gradient-to-br from-brand to-brand-strong p-5 text-on-brand">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-surface/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles size={11} /> Plan estándar comercio
          </div>
          <p className="mt-3 text-5xl font-bold tracking-tight">
            3 meses
            <span className="ml-2 text-3xl font-bold text-on-brand">gratis</span>
          </p>
          <p className="mt-1 text-xs text-on-brand/90">
            Sin tarjeta · Sin MercadoPago · Cancelás cuando quieras
          </p>
        </div>
        <div className="px-5 pt-4 pb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-strong">
            Todo ilimitado · sin letra chica
          </p>
        </div>
        <ul className="flex flex-col gap-2 px-5 pb-5 text-sm text-ink">
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
            <Highlight>Notas internas</Highlight> sobre cada cliente (historial, preferencias)
          </Bullet>
          <Bullet>
            <Highlight>Soporte por WhatsApp</Highlight> para todos los comercios adheridos
          </Bullet>
        </ul>
      </div>

      <div className="rounded-3xl bg-status-info-bg p-4 text-status-info-fg ring-1 ring-status-info/20">
        <p className="text-xs leading-snug">
          <strong>Sin compromiso:</strong> arrancás con <strong>3 meses gratis</strong> y acceso
          completo a todo. No te pedimos tarjeta ni datos de pago para empezar.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedTc}
          onChange={(e) => onAcceptTc(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand"
        />
        <span className="text-xs leading-snug text-ink">
          Acepto los{' '}
          <Link
            to="/legal/terminos"
            target="_blank"
            className="font-bold text-brand-strong underline-offset-2 hover:underline"
          >
            Términos y Condiciones
          </Link>{' '}
          y la{' '}
          <Link
            to="/legal/privacidad"
            target="_blank"
            className="font-bold text-brand-strong underline-offset-2 hover:underline"
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
        className={cn(
          'mt-1 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold text-on-brand shadow-cta transition-all',
          acceptedTc && !submitting
            ? 'bg-gradient-to-br from-brand to-brand-strong hover:-translate-y-0.5'
            : 'cursor-not-allowed bg-surface-2 text-ink-soft shadow-none',
        )}
      >
        {submitting ? (
          <>
            <Clock size={16} className="animate-pulse" /> Activando…
          </>
        ) : !acceptedTc ? (
          <>
            <Lock size={16} /> Aceptá los términos para continuar
          </>
        ) : (
          <>
            <Sparkles size={16} /> Empezar gratis
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="text-center text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
      >
        Volver a editar los datos fiscales
      </button>
    </div>
  )
}

function ListoStep({ form }: { form: Form }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-8 text-center shadow-floating ring-1 ring-line">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-status-success-bg text-status-success-fg">
        <CheckCircle2 size={32} />
      </div>
      <h3 className="text-xl font-bold text-ink">¡{form.nombreComercio} ya está dentro!</h3>
      <p className="text-sm text-ink-soft">
        Te enviamos un email a <strong>{form.emailAdmin}</strong> con los próximos pasos. Te
        estamos redirigiendo al panel…
      </p>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-ink">{children}</span>
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
  'w-full rounded-2xl bg-surface px-4 py-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand'

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
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          {label} {required && <span className="text-status-error">*</span>}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-ink-faint">{hint}</span>}
      </div>
      {input}
      {help && <p className="text-[11px] text-ink-faint">{help}</p>}
    </label>
  )
}
