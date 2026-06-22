import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Store,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Clock,
  Tag,
  ImagePlus,
  Users,
  ScanLine,
} from 'lucide-react'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { merchantAuth } from '@/lib/merchantStore'
import { useToast } from '@/components/Toast'
import { Select } from '@/components/Select'
import { cn } from '@/lib/cn'
import { useTenant } from '@/lib/tenant'
import { VecinoAppMockup } from '@/components/VecinoAppMockup'

/** Placeholder de teléfono: usa el prefijo guardado de la ciudad si está; si no,
 *  lo infiere del país. Así el comercio ya ve el prefijo correcto de su ciudad. */
function phonePlaceholder(pais?: string, prefijo?: string): string {
  if (prefijo) return `${prefijo} 300 123 4567`
  const p = (pais ?? '').toLowerCase()
  if (p.includes('colombia')) return '+57 300 123 4567'
  if (p.includes('argentina')) return '+54 9 11 2345-6789'
  if (p.includes('mexico') || p.includes('méxico')) return '+52 55 1234 5678'
  if (p.includes('chile')) return '+56 9 1234 5678'
  if (p.includes('uruguay')) return '+598 9 123 456'
  if (p.includes('peru') || p.includes('perú')) return '+51 987 654 321'
  return 'Tu teléfono con código de país'
}

// Leaflet es pesado (~150KB) — lo bajamos como chunk aparte y sólo cuando
// el comercio llega al paso de datos del signup.
const LocationPicker = lazy(() =>
  import('@/components/LocationPicker').then((m) => ({ default: m.LocationPicker })),
)

const SANPEDRO_CENTER = { lat: -33.6797, lng: -59.6669 }

// Alta MÍNIMA: solo datos del comercio + cuenta. NADA fiscal (CUIT/razón social/
// condición/domicilio se piden recién cuando se active el cobro — ver Fase 4).
type Step = 'datos' | 'listo'

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
  nombreAdmin: string
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
  nombreAdmin: '',
  acceptedTc: false,
}

/**
 * Persistencia del draft del signup en localStorage.
 * Si el usuario recarga (F5, cierra y vuelve a abrir, navega y vuelve),
 * los datos quedan. Excluimos `acceptedTc`: el consentimiento tiene que ser
 * fresco cada vez (no se persiste).
 */
const DRAFT_KEY = 'msp.admin.signup.draft.v1'

type StoredDraft = Omit<Form, 'acceptedTc'>

function loadDraft(): Partial<Form> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function saveDraft(form: Form) {
  try {
    const { acceptedTc: __, ...rest } = form
    void __
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
  const [step, setStep] = useState<Step>('datos')
  const [form, setForm] = useState<Form>(() => {
    const draft = loadDraft()
    if (!draft) return empty
    return { ...empty, ...draft }
  })
  const [draftRestored, setDraftRestored] = useState<boolean>(() => loadDraft() !== null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const tenant = useTenant()
  const mapCenter = tenant.config?.geoCenter ?? SANPEDRO_CENTER
  const cityHint =
    [tenant.config?.ciudad, tenant.config?.provincia].filter(Boolean).join(', ') ||
    tenant.config?.ciudad ||
    'tu ciudad'
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref')?.trim() || undefined

  useEffect(() => {
    if (step === 'listo') return
    saveDraft(form)
  }, [form, step])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
    if (draftRestored) setDraftRestored(false)
  }

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
    // PM-elite T2: el pin NO es obligatorio. Lo geocodificamos solo desde la
    // dirección (LocationPicker) y, si no hay, el backend ubica el comercio en
    // el centro de la ciudad. El alta nunca se traba por el mapa.
    if (!form.telefono.trim()) return 'Falta el teléfono'
    if (form.nombreAdmin.trim().length < 3) return 'Falta tu nombre completo'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin)) return 'Email inválido'
    return null
  }

  // Alta en UN paso: validar datos + T&C → crear el comercio (sin fiscal, sin pago).
  async function handleSignup() {
    const err = validateDatos()
    if (err) return setError(err)
    if (!form.acceptedTc) return setError('Tenés que aceptar los términos y condiciones')

    setSubmitting(true)
    setError(null)

    const result = await merchantAuth.signup({
      comercio: {
        nombre: form.nombreComercio.trim(),
        categoria: form.categoria,
        categoriaOtro: form.categoria === 'otro' ? form.categoriaOtro.trim() : undefined,
        direccion: form.direccion.trim(),
        lat: form.lat ?? undefined,
        lng: form.lng ?? undefined,
        telefono: form.telefono.trim(),
        horarios: form.horarios.trim(),
        // Sin datos fiscales: se piden recién cuando se active el cobro.
      },
      admin: {
        nombre: form.nombreAdmin.trim(),
        email: form.emailAdmin.trim().toLowerCase(),
      },
      ref: refCode,
      acceptedTc: true,
    })

    if (result.ok) {
      // Comercio creado y ACTIVO con 3 meses gratis — sin pago ni MercadoPago.
      // Ya es visible para los vecinos. Lo llevamos a completar su perfil.
      clearDraft()
      setSubmitting(false)
      setStep('listo')
      toast.success('¡Listo! Tu comercio ya está dentro', 'Visible para los vecinos. Sumale tu perfil.')
      return
    }
    setSubmitting(false)
    if (
      result.error.toLowerCase().includes('email') ||
      result.error.toLowerCase().includes('ya registrado')
    ) {
      setError(result.error)
      return
    }
    setError(result.error || 'No pudimos crear el comercio. Reintentá en un momento.')
  }

  return (
    <div className="min-h-[100svh] bg-bg px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_minmax(380px,420px)] lg:items-start lg:gap-14">
        {/* Formulario (izquierda) */}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 lg:mx-0">
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
              {step === 'datos' && 'Sumá tu comercio'}
              {step === 'listo' && '¡Bienvenido!'}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {step === 'datos' && '2 minutos · Sin tarjeta · Sin trámites'}
              {step === 'listo' && 'Ya estás dentro — sumale tu perfil'}
            </p>
          </div>
        </div>

        {refCode && step === 'datos' && (
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
              terminá el alta.
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
                  id="signup-nombre-comercio"
                  name="nombreComercio"
                  type="text"
                  autoComplete="organization"
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
                    id="signup-categoria-otro"
                    name="categoriaOtro"
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
                  id="signup-direccion"
                  name="direccion"
                  type="text"
                  autoComplete="street-address"
                  value={form.direccion}
                  onChange={(e) => update('direccion', e.target.value)}
                  placeholder={`Mitre 1247, ${tenant.config?.ciudad ?? 'tu ciudad'}`}
                  className={inputCls}
                />
              }
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                Ubicación en el mapa{' '}
                <span className="font-semibold normal-case tracking-normal text-ink-faint">
                  (opcional)
                </span>
              </span>
              <p className="-mt-0.5 text-[11px] text-ink-soft">
                La ubicamos sola con tu dirección. Ajustá el pin solo si querés
                afinar la puerta exacta.
              </p>
              <Suspense
                fallback={
                  <div className="h-[240px] animate-pulse rounded-2xl bg-surface-2 ring-1 ring-line" />
                }
              >
                <LocationPicker
                  value={
                    form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null
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
                  id="signup-telefono"
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.telefono}
                  onChange={(e) => update('telefono', e.target.value)}
                  placeholder={phonePlaceholder(tenant.config?.pais, tenant.config?.phonePrefix)}
                  className={inputCls}
                />
              }
            />
            <p className="text-[11px] text-ink-soft">
              <Clock size={10} className="mr-1 inline" />
              Las fotos y los horarios los cargás después, en un toque, desde el panel.
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
                  id="signup-nombre-admin"
                  name="nombreAdmin"
                  type="text"
                  autoComplete="name"
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
                  id="signup-email-admin"
                  name="emailAdmin"
                  type="email"
                  autoComplete="email"
                  value={form.emailAdmin}
                  onChange={(e) => update('emailAdmin', e.target.value)}
                  placeholder="vos@tucomercio.com"
                  className={inputCls}
                />
              }
            />
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand-strong">
              No necesitás contraseña: cada vez que entres al panel te mandamos un código de acceso a
              este email.
            </p>

            {/* Tranquilidad del plan, sin paso de "pago" (no se cobra nada ahora). */}
            <div className="rounded-2xl bg-status-success-bg p-3.5 text-status-success-fg ring-1 ring-status-success/20">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles size={14} /> 3 meses gratis · todo incluido
              </p>
              <p className="mt-0.5 text-xs leading-snug">
                Descuentos, validaciones y clientes ilimitados. Sin tarjeta, sin MercadoPago. Cancelás
                cuando quieras.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line cursor-pointer">
              <input
                id="signup-accepted-tc"
                name="acceptedTc"
                type="checkbox"
                checked={form.acceptedTc}
                onChange={(e) => update('acceptedTc', e.target.checked)}
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
              <p
                role="alert"
                className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSignup}
              disabled={submitting || !form.acceptedTc}
              className={cn(
                'mt-1 flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all',
                form.acceptedTc && !submitting
                  ? 'bg-gradient-to-br from-brand to-brand-strong hover:-translate-y-0.5'
                  : 'cursor-not-allowed bg-surface-2 text-ink-soft shadow-none',
              )}
            >
              {submitting ? (
                <>
                  <Clock size={16} className="animate-pulse" /> Creando tu comercio…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Crear mi comercio gratis
                </>
              )}
            </button>
          </div>
        )}

        {step === 'listo' && (
          <ListoStep form={form} onGoTo={(to) => navigate(to, { replace: true })} />
        )}
        </div>

        {/* Banner (derecha) — sticky en desktop, oculto en mobile */}
        <aside className="relative hidden self-start overflow-hidden rounded-3xl bg-gradient-to-br from-brand-strong to-brand p-8 text-on-brand shadow-floating lg:sticky lg:top-10 lg:flex lg:flex-col lg:gap-7">
          <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-[0.06]" />
          <div className="relative flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-brand/70">
              Así te ven los vecinos
            </p>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">
              Sumate al club de ahorro de {tenant.config?.ciudad ?? 'tu ciudad'}
            </h2>
          </div>
          <VecinoAppMockup className="relative" />
          <ul className="relative flex flex-col gap-3">
            <BannerPoint icon={Sparkles}>3 meses gratis · sin tarjeta</BannerPoint>
            <BannerPoint icon={Users}>Clientes propios, exportables</BannerPoint>
            <BannerPoint icon={ScanLine}>Validás descuentos en 2 segundos</BannerPoint>
          </ul>
        </aside>
      </div>
    </div>
  )
}

function BannerPoint({ icon: Icon, children }: { icon: typeof Store; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm font-medium text-on-brand/90">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface/15 ring-1 ring-white/15">
        <Icon size={14} />
      </span>
      {children}
    </li>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'datos', label: 'Datos' },
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
              className={cn('h-0.5 w-6 rounded', i < activeIdx ? 'bg-status-success' : 'bg-surface-2')}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Paso final: NO es un muro. Empuja (sin obligar) a completar el perfil
 * (foto + horarios = la vidriera del comercio) y a crear el primer descuento.
 * El comercio ya quedó activo y visible; puede ir directo al panel.
 */
function ListoStep({ form, onGoTo }: { form: Form; onGoTo: (to: string) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-floating ring-1 ring-line">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-status-success-bg text-status-success-fg">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-ink">¡{form.nombreComercio} ya está dentro!</h3>
        <p className="text-sm text-ink-soft">
          Ya sos visible para los vecinos. Dale un toque más para que te elijan:
        </p>
      </div>

      <button
        type="button"
        onClick={() => onGoTo('/admin/comercio')}
        className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand to-brand-strong p-4 text-left text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface/20">
          <ImagePlus size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Completá tu perfil</span>
          <span className="block text-xs text-on-brand/85">
            Foto + horarios: así los vecinos te ven mejor en la app.
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onGoTo('/admin/cupones/nuevo')}
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left text-ink ring-1 ring-line transition-all hover:-translate-y-0.5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <Tag size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Creá tu primer descuento</span>
          <span className="block text-xs text-ink-soft">El gancho para que el vecino te visite.</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-faint" />
      </button>

      <button
        type="button"
        onClick={() => onGoTo('/admin')}
        className="text-center text-xs font-semibold text-ink-soft hover:text-ink"
      >
        Después lo hago — ir al panel
      </button>
    </div>
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
