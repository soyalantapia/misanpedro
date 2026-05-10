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
} from 'lucide-react'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { merchantsActions } from '@/lib/merchantsStore'
import { merchantAuth } from '@/lib/merchantStore'
import {
  addMerchantUser,
  findMerchantUserByEmail,
} from '@/data/mockData'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api'

const PRECIO = 25_000

type Step = 'datos' | 'pago' | 'listo'

type Form = {
  nombreComercio: string
  categoria: Categoria
  direccion: string
  telefono: string
  horarios: string
  emailAdmin: string
  password: string
  nombreAdmin: string
}

const empty: Form = {
  nombreComercio: '',
  categoria: 'gastronomia',
  direccion: '',
  telefono: '',
  horarios: '',
  emailAdmin: '',
  password: '',
  nombreAdmin: '',
}

export function AdminSignupPage() {
  const [step, setStep] = useState<Step>('datos')
  const [form, setForm] = useState<Form>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }

  function validateDatos(): string | null {
    if (form.nombreComercio.trim().length < 3) return 'El nombre del comercio es muy corto'
    if (form.direccion.trim().length < 5) return 'Falta una dirección válida'
    if (!form.telefono.trim()) return 'Falta el teléfono'
    if (!form.horarios.trim()) return 'Indicá los horarios de atención'
    if (form.nombreAdmin.trim().length < 3) return 'Falta tu nombre completo'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin)) return 'Email inválido'
    if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if (findMerchantUserByEmail(form.emailAdmin)) return 'Ya existe una cuenta con ese email'
    return null
  }

  function goToPago() {
    const err = validateDatos()
    if (err) {
      setError(err)
      return
    }
    setStep('pago')
  }

  async function handlePay() {
    setSubmitting(true)
    setError(null)

    // Usamos merchantAuth.signup (no merchantApi.signup directo) para que
    // actualice el state del store con el apiUser/apiMerchant nuevo.
    // Si falla, hacemos fallback al store local.
    const result = await merchantAuth.signup({
      comercio: {
        nombre: form.nombreComercio.trim(),
        categoria: form.categoria,
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        horarios: form.horarios.trim(),
      },
      admin: {
        nombre: form.nombreAdmin.trim(),
        email: form.emailAdmin.trim().toLowerCase(),
        password: form.password,
      },
    })
    if (result.ok) {
      setSubmitting(false)
      setStep('listo')
      toast.success('¡Comercio creado!', 'Bienvenido a Mi San Pedro.')
      setTimeout(() => navigate('/admin', { replace: true }), 1500)
      return
    }
    // Si falló y el mensaje es de email duplicado, lo mostramos en el step datos
    if (result.error.toLowerCase().includes('email') || result.error.toLowerCase().includes('ya registrado')) {
      setSubmitting(false)
      setError(result.error)
      setStep('datos')
      return
    }

    // Fallback offline (modo demo gh-pages)
    const merchant = merchantsActions.create({
      nombre: form.nombreComercio.trim(),
      categoria: form.categoria,
      direccion: form.direccion.trim(),
      lat: -33.6797,
      lng: -59.6669,
      telefono: form.telefono.trim(),
      horarios: form.horarios.trim(),
      cover: 'custom',
      logoSeed: form.nombreComercio
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    })
    addMerchantUser({
      id: `mu-${Math.random().toString(36).slice(2, 10)}`,
      merchantId: merchant.id,
      email: form.emailAdmin.trim().toLowerCase(),
      password: form.password,
      nombre: form.nombreAdmin.trim(),
      rol: 'admin',
    })
    await merchantAuth.login(form.emailAdmin, form.password)
    setSubmitting(false)
    setStep('listo')
    toast.success('¡Comercio creado! (modo offline)', 'Demostrado localmente.')
    setTimeout(() => navigate('/admin', { replace: true }), 1500)
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
              Sumá tu comercio a Mi San Pedro
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
              {step === 'datos' && 'Datos del comercio'}
              {step === 'pago' && 'Activá tu suscripción'}
              {step === 'listo' && '¡Bienvenido!'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {step === 'datos' && '2 minutos · Después confirmás el pago'}
              {step === 'pago' && `${PRECIO.toLocaleString('es-AR')} ARS / mes · Cancelable`}
              {step === 'listo' && 'Te estamos llevando al panel…'}
            </p>
          </div>
        </div>

        <Stepper step={step} />

        {step === 'datos' && (
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-floating ring-1 ring-neutral-100">
            <Field
              label="Nombre del comercio"
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
            <Field
              label="Dirección"
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
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Teléfono"
                input={
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => update('telefono', e.target.value)}
                    placeholder="(03329) 425-678"
                    className={inputCls}
                  />
                }
              />
              <Field
                label="Horarios"
                input={
                  <input
                    type="text"
                    value={form.horarios}
                    onChange={(e) => update('horarios', e.target.value)}
                    placeholder="Mar a Dom · 19 a 24"
                    className={inputCls}
                  />
                }
              />
            </div>

            <div className="my-2 border-t border-neutral-100" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Cuenta del responsable
            </p>

            <Field
              label="Tu nombre"
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
              input={
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={inputCls}
                />
              }
            />

            {error && (
              <p className="rounded-xl bg-status-error-bg px-3 py-2 text-xs font-semibold text-status-error-fg">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={goToPago}
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
            >
              Continuar al pago <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 'pago' && (
          <PagoStep
            submitting={submitting}
            onPay={handlePay}
            onBack={() => setStep('datos')}
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

function PagoStep({
  submitting,
  onPay,
  onBack,
}: {
  submitting: boolean
  onPay: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-visible rounded-3xl bg-white shadow-floating ring-1 ring-neutral-100">
        {/* Badge oferta de lanzamiento — flotante arriba */}
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-cta whitespace-nowrap">
          <Sparkles size={11} /> Oferta de lanzamiento
        </div>
        <div className="overflow-hidden rounded-t-3xl bg-gradient-to-br from-accent-400 to-accent-600 p-5 pt-6 text-white">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles size={11} /> Plan estándar comercio
          </div>
          <p className="mt-3 whitespace-nowrap text-5xl font-bold tabular-nums tracking-tight">
            ${PRECIO.toLocaleString('es-AR')}
            <span className="ml-1 text-base font-normal text-accent-50">/ mes</span>
          </p>
          <p className="mt-1 text-xs text-accent-50/90">
            Sin permanencia · Cancelás cuando quieras
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
            <Highlight>Campañas masivas WhatsApp</Highlight> · 4 envíos / mes vía API oficial
          </Bullet>
          <Bullet>
            <Highlight>Estadísticas en tiempo real</Highlight> de canjes, ahorro generado y patrones de visita
          </Bullet>
          <Bullet>
            <Highlight>Ficha de cliente individual</Highlight> con historial completo y datos de contacto
          </Bullet>
          <Bullet>
            <Highlight>Edición ilimitada</Highlight> del comercio (datos, horarios, categoría)
          </Bullet>
          <Bullet>
            <Highlight>Soporte prioritario</Highlight> por WhatsApp para los primeros 100 comercios
          </Bullet>
        </ul>
      </div>

      <SlotsCounter slotsLeft={73} totalSlots={100} />

      <button
        type="button"
        onClick={onPay}
        disabled={submitting}
        className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Clock size={16} className="animate-pulse" /> Procesando pago…
          </>
        ) : (
          <>
            <CreditCard size={16} /> Pagar ${PRECIO.toLocaleString('es-AR')} y crear comercio
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
      >
        Volver a editar los datos
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
        Te estamos redirigiendo al panel del comercio para que cargues tu primer descuento.
      </p>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-neutral-900">{children}</span>
}

function SlotsCounter({
  slotsLeft,
  totalSlots,
}: {
  slotsLeft: number
  totalSlots: number
}) {
  const taken = totalSlots - slotsLeft
  const pctTaken = (taken / totalSlots) * 100
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 p-5 ring-2 ring-amber-300/60 shadow-card">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-amber-300/30 to-pink-400/20 blur-2xl" />
      <div className="relative flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-cta">
          <Sparkles size={11} /> Oferta de lanzamiento
        </div>

        <div className="flex items-baseline gap-2">
          <p className="text-6xl font-bold tabular-nums leading-none tracking-tight text-neutral-900 sm:text-7xl">
            {slotsLeft}
          </p>
          <p className="text-2xl font-bold leading-none text-neutral-400 tabular-nums">
            /{totalSlots}
          </p>
        </div>

        <p className="text-base font-bold text-neutral-900">
          lugares disponibles al precio de lanzamiento
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-amber-700">{taken} comercios ya están adentro</span>
            <span className="tabular-nums text-neutral-500">{Math.round(pctTaken)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-amber-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 shadow-cta transition-all duration-500"
              style={{ width: `${Math.max(4, pctTaken)}%` }}
            />
          </div>
        </div>

        <p className="rounded-xl bg-white/70 p-3 text-xs leading-snug text-neutral-700 ring-1 ring-amber-200/40">
          <span className="font-bold text-neutral-900">Precio fijado de por vida.</span>{' '}
          Si te sumás antes de los 100 comercios, mantenés esta tarifa mientras la suscripción
          esté activa — aunque el plan suba después.
        </p>
      </div>
    </div>
  )
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

function Field({ label, input }: { label: string; input: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {input}
    </label>
  )
}

