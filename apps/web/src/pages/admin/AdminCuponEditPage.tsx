import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Save,
  Tag,
  Sparkles,
  Wand2,
  Check,
  UserPlus,
  TrendingUp,
  PackageX,
  Repeat,
  Lock,
  Zap,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useCoupon } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { CardImage } from '@/components/CardImage'
import { getMerchant } from '@/data/mockData'
import { DIAS_SEMANA, type Categoria, type DiaSemana } from '@/lib/types'
import { api, ApiError, templates as templatesApi } from '@/lib/api'
import { useApiMyCoupons } from '@/lib/apiQueries'

type Objetivo = 'traer_nuevos' | 'llenar_flojos' | 'vaciar_stock' | 'fidelizar'
type TipoOferta = 'porcentaje' | 'dos_por_uno' | 'precio_fijo' | 'happy_hour'

const TITULO_MAX = 60
const DESCRIPCION_MAX = 280

type FormState = {
  titulo: string
  descripcion: string
  condiciones: string
  porcentaje: number
  /** Precio normal por persona (texto en el form; se manda como number). Público. */
  precioReferencia: string
  /** Costo aprox del comercio (texto; se manda como number). PRIVADO. */
  costoReferencia: string
  vigenciaHasta: string
  /** Texto libre de display; se autogenera desde dias+franja si están. */
  diasAplica: string
  objetivo: Objetivo | ''
  tipoOferta: TipoOferta
  exclusiva: boolean
  dias: DiaSemana[]
  franjaDesde: string
  franjaHasta: string
  productoGancho: string
}

const empty: FormState = {
  titulo: '',
  descripcion: '',
  condiciones: '',
  porcentaje: 30,
  precioReferencia: '',
  costoReferencia: '',
  vigenciaHasta: defaultExpiry(),
  diasAplica: '',
  objetivo: '',
  tipoOferta: 'porcentaje',
  exclusiva: true,
  dias: [],
  franjaDesde: '',
  franjaHasta: '',
  productoGancho: '',
}

function defaultExpiry(): string {
  return addDays(new Date(), 30).toISOString().slice(0, 10)
}
function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(d.getDate() + days)
  return next
}
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
function formatDateLong(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`
}
function isoToDate(iso: string): string {
  return iso.slice(0, 10)
}
function dateToIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString()
}

// ─── Plata ──────────────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}
function calcMoney(precio: number, porcentaje: number, costo?: number) {
  const vecinoPaga = Math.round(precio * (1 - porcentaje / 100))
  const ahorro = Math.round((precio * porcentaje) / 100)
  const margen = costo != null && costo > 0 ? vecinoPaga - costo : null
  const pierdePlata = costo != null && costo > 0 && vecinoPaga < costo
  return { vecinoPaga, ahorro, margen, pierdePlata }
}

// ─── Días/franja → texto de display (diasAplica) ──────────────────────────
function buildDiasAplica(dias: DiaSemana[], desde: string, hasta: string, fallback: string): string {
  if (dias.length === 0 && !(desde && hasta)) return fallback
  const labels = DIAS_SEMANA.filter((d) => dias.includes(d.id)).map((d) => d.corto)
  const diasStr =
    labels.length === 7
      ? 'Todos los días'
      : labels.length > 0
        ? labels.join(', ')
        : ''
  const franjaStr = desde && hasta ? `${desde} a ${hasta} hs` : ''
  return [diasStr, franjaStr].filter(Boolean).join(' · ')
}

// ─── Objetivos ────────────────────────────────────────────────────────────
const OBJETIVOS: { id: Objetivo; label: string; icon: typeof UserPlus; why: string }[] = [
  { id: 'traer_nuevos', label: 'Traer clientes nuevos', icon: UserPlus, why: 'Un descuento fuerte de entrada para que prueben y vuelvan.' },
  { id: 'llenar_flojos', label: 'Llenar días y horas flojas', icon: TrendingUp, why: 'Movés el local cuando está vacío, sin resignar los días buenos.' },
  { id: 'vaciar_stock', label: 'Liquidar stock', icon: PackageX, why: 'Hacés caja con lo que no rota y liberás espacio.' },
  { id: 'fidelizar', label: 'Que el cliente vuelva', icon: Repeat, why: 'Una costumbre semanal que te elige a vos, no al de enfrente.' },
]

const FOOD = new Set(['gastronomia', 'cafeteria', 'panaderia'])
const NECESIDAD = new Set(['supermercado', 'kiosco', 'farmacia', 'panaderia'])

type Jugada = {
  label: string
  why: string
  titulo: string
  descripcion: string
  porcentaje: number
  tipoOferta: TipoOferta
  exclusiva: boolean
  dias: DiaSemana[]
  franjaDesde: string
  franjaHasta: string
}

/** Cruza objetivo + rubro y PROPONE una jugada concreta (no la pregunta en abstracto). */
function sugerirJugada(objetivo: Objetivo, categoria: string, gancho: string): Jugada {
  const g = gancho.trim() || 'tu producto estrella'
  if (objetivo === 'traer_nuevos') {
    return {
      label: 'Cliente nuevo agresivo',
      why: 'Un golpe fuerte la primera vez: si el trabajo es bueno, vuelven a precio lleno.',
      titulo: `40% OFF en tu primera vez`,
      descripcion: `Descuento de bienvenida en ${g} para quien todavía no te conoce. Una sola vez por persona.`,
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      exclusiva: true,
      dias: [],
      franjaDesde: '',
      franjaHasta: '',
    }
  }
  if (objetivo === 'vaciar_stock') {
    if (FOOD.has(categoria)) {
      return {
        label: 'Última hornada / fin del día',
        why: 'En vez de tirarlo, lo vendés con descuento fuerte al final del día.',
        titulo: `40% en ${g} al cierre`,
        descripcion: `Lo que queda al final del día, con 40%. Hasta agotar.`,
        porcentaje: 40,
        tipoOferta: 'porcentaje',
        exclusiva: true,
        dias: [],
        franjaDesde: '19:00',
        franjaHasta: '21:00',
      }
    }
    return {
      label: 'Liquidá lo que no rota',
      why: 'Hacés caja con lo parado y liberás espacio para lo nuevo.',
      titulo: `40% en ${g} marcado`,
      descripcion: `Selección marcada con 40%. Hasta agotar stock.`,
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      exclusiva: true,
      dias: [],
      franjaDesde: '',
      franjaHasta: '',
    }
  }
  if (objetivo === 'fidelizar') {
    return {
      label: 'Costumbre semanal',
      why: 'El mismo día, todas las semanas: el vecino arma su rutina alrededor tuyo.',
      titulo: `Martes de ${g}: 20% off`,
      descripcion: `Todos los martes, 20% en ${g}. La costumbre que te hace elegir.`,
      porcentaje: 20,
      tipoOferta: 'porcentaje',
      exclusiva: true,
      dias: ['mar'],
      franjaDesde: '',
      franjaHasta: '',
    }
  }
  // llenar_flojos
  if (FOOD.has(categoria) || categoria === 'belleza') {
    return {
      label: 'Happy hour en la hora muerta',
      why: 'Movés la franja vacía de la tarde sin tocar tus horarios pico.',
      titulo: `50% en ${g} de 15 a 18`,
      descripcion: `Mitad de precio en ${g} en la franja floja de la tarde, de lunes a jueves. Llenás las mesas vacías sin resignar tus horarios pico.`,
      porcentaje: 50,
      tipoOferta: 'porcentaje',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue'],
      franjaDesde: '15:00',
      franjaHasta: '18:00',
    }
  }
  // necesidad u otros: día flojo de la semana
  return {
    label: 'Día flojo con descuento',
    why: 'Concentrás demanda el día más muerto de tu semana.',
    titulo: `Martes: 25% en ${g}`,
    descripcion: `Los martes, 25% en ${g}. Para mover el día más flojo.`,
    porcentaje: NECESIDAD.has(categoria) ? 15 : 25,
    tipoOferta: 'porcentaje',
    exclusiva: true,
    dias: ['mar'],
    franjaDesde: '',
    franjaHasta: '',
  }
}

/** Mensaje de coraje según objetivo — empuja al descuento grande con la cuenta a favor. */
function corajeMsg(objetivo: Objetivo | '', m: ReturnType<typeof calcMoney> | null): string {
  if (!m) return ''
  if (objetivo === 'llenar_flojos')
    return `Un día vacío te deja $0. Con esto te entran ${fmtMoney(m.vecinoPaga)} que no tenías.`
  if (objetivo === 'traer_nuevos')
    return `Resignás ${fmtMoney(m.ahorro)} una vez para ganar un cliente que vuelve a precio lleno.`
  if (objetivo === 'vaciar_stock')
    return `Mejor ${fmtMoney(m.vecinoPaga)} hoy que tenerlo parado. Lo movés y liberás espacio.`
  if (objetivo === 'fidelizar')
    return `${fmtMoney(m.ahorro)} de descuento te compran una costumbre que se repite todas las semanas.`
  return ''
}

// ─── Medidor de fuerza (avisa cuando es FLOJO, no cuando es grande) ─────────
function calcFuerza(form: FormState): { nivel: 'Fuerte' | 'Media' | 'Floja'; mejora: string } {
  let score = 0
  const grande = form.porcentaje >= 30 || form.tipoOferta === 'dos_por_uno'
  if (grande) score += 2
  else if (form.porcentaje >= 15) score += 1
  if (form.exclusiva) score += 1
  if (form.productoGancho.trim()) score += 1
  if (form.dias.length > 0 || (form.franjaDesde && form.franjaHasta)) score += 1
  const nivel = score >= 4 ? 'Fuerte' : score >= 2 ? 'Media' : 'Floja'

  let mejora = ''
  if (!grande)
    mejora = 'Subí el descuento. Menos de 30% casi no mueve a nadie de su rutina; animate al número grande.'
  else if (!form.exclusiva)
    mejora = 'Marcalo exclusivo de la app. Si se consigue igual en la puerta, no le das motivo para bajarla.'
  else if (!form.productoGancho.trim())
    mejora = 'Decí cuál es el producto estrella. El gancho concreto es lo que lo hace deseable.'
  else if (form.dias.length === 0 && !(form.franjaDesde && form.franjaHasta))
    mejora = 'Atalo a días o una franja. Un descuento "siempre" no genera urgencia.'
  return { nivel, mejora }
}

export function AdminCuponEditPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const localExisting = useCoupon(id)
  const apiCupones = useApiMyCoupons()
  const apiExisting = isEdit && id ? apiCupones.data?.find((c) => c.id === id) : undefined
  const existing: any = apiExisting ?? localExisting
  const sessionState = useMerchantSession()
  const { session } = sessionState
  const merchant = sessionState.apiMerchant
    ? {
        id: sessionState.apiMerchant.id,
        nombre: sessionState.apiMerchant.nombre,
        categoria: sessionState.apiMerchant.categoria as Categoria,
      }
    : session
      ? getMerchant(session.merchantId)
      : undefined
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(empty)
  const [submitting, setSubmitting] = useState(false)
  // Modo: 'asesor' guiado (default) o 'rapido' (form de toda la vida).
  const [modo, setModo] = useState<'asesor' | 'rapido'>('asesor')

  useEffect(() => {
    if (existing) {
      setForm({
        titulo: existing.titulo,
        descripcion: existing.descripcion,
        condiciones: existing.condiciones ?? '',
        porcentaje: existing.porcentaje,
        precioReferencia: existing.precioReferencia != null ? String(existing.precioReferencia) : '',
        costoReferencia: existing.costoReferencia != null ? String(existing.costoReferencia) : '',
        vigenciaHasta: isoToDate(existing.vigenciaHasta),
        diasAplica: existing.diasAplica ?? '',
        objetivo: existing.objetivo ?? '',
        tipoOferta: existing.tipoOferta ?? 'porcentaje',
        exclusiva: existing.exclusiva ?? true,
        dias: Array.isArray(existing.dias) ? existing.dias : [],
        franjaDesde: existing.franjaDesde ?? '',
        franjaHasta: existing.franjaHasta ?? '',
        productoGancho: existing.productoGancho ?? '',
      })
    } else {
      setForm(empty)
    }
  }, [existing?.id])

  if (!session || !merchant) return <Navigate to="/admin/login" replace />
  if (isEdit && !existing && apiCupones.loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
        <div className="h-6 w-40 animate-pulse rounded-full bg-neutral-200" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-white shadow-card" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }
  if (isEdit && !existing && !apiCupones.loading) {
    return <Navigate to="/admin/cupones" replace />
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function publicar(): Promise<void> {
    if (!session) return
    if (form.titulo.trim().length < 8) {
      toast.error('Falta el título', 'Mínimo 8 caracteres.')
      return
    }
    if (form.descripcion.trim().length < 20) {
      toast.error('Falta la descripción', 'Contá qué incluye (mínimo 20 caracteres).')
      return
    }
    if (!form.vigenciaHasta) {
      toast.error('Falta la vigencia', 'Indicá hasta cuándo aplica.')
      return
    }
    setSubmitting(true)
    const num = (s: string) => {
      const n = Number(s)
      return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
    }
    // En edición, un opcional vacío se manda como `null` para LIMPIARLO en el
    // backend (si se omitiera, el valor viejo quedaría pegado). En alta se omite.
    const clr = <T,>(v: T | undefined): T | null | undefined => (v !== undefined ? v : isEdit ? null : undefined)
    // Una franja necesita AMBOS extremos; si falta uno, no es franja.
    const franjaOk = !!(form.franjaDesde && form.franjaHasta)
    const apiPayload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      condiciones: form.condiciones.trim(),
      porcentaje: form.porcentaje,
      precioReferencia: num(form.precioReferencia),
      costoReferencia: clr(num(form.costoReferencia)),
      vigenciaHasta: dateToIso(form.vigenciaHasta),
      diasAplica: buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, form.diasAplica.trim()) || undefined,
      dias: clr(form.dias.length ? form.dias : undefined),
      franjaDesde: clr(franjaOk ? form.franjaDesde : undefined),
      franjaHasta: clr(franjaOk ? form.franjaHasta : undefined),
      objetivo: clr(form.objetivo || undefined),
      tipoOferta: form.tipoOferta,
      exclusiva: form.exclusiva,
      productoGancho: clr(form.productoGancho.trim() || undefined),
      estado: existing?.estado === 'pausado' ? 'pausado' : 'activo',
    }
    try {
      if (isEdit && id) {
        await api.merchantCoupons.update(id, apiPayload)
        toast.success('Cupón actualizado')
      } else {
        await api.merchantCoupons.create(apiPayload)
        toast.success('Cupón creado', 'Ya está visible para los vecinos.')
      }
      navigate('/admin/cupones', { replace: true })
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link to="/admin/cupones" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
        <ChevronLeft size={16} /> Mis cupones
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            {isEdit ? <Tag size={12} /> : <Sparkles size={12} />} {isEdit ? 'Editar cupón' : 'Nuevo cupón'}
          </div>
          <button
            type="button"
            onClick={() => setModo((m) => (m === 'asesor' ? 'rapido' : 'asesor'))}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-600 ring-1 ring-neutral-200 hover:bg-primary-50"
          >
            {modo === 'asesor' ? <>Modo rápido <ArrowRight size={12} /></> : <><Wand2 size={12} /> Usar el asesor</>}
          </button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {modo === 'asesor' ? 'Armemos un cupón fuerte' : isEdit ? form.titulo || 'Editar cupón' : 'Crear un cupón'}
        </h1>
        <p className="text-sm text-neutral-500">
          {modo === 'asesor'
            ? `Te hago unas preguntas y salís con un cupón que el vecino no quiera dejar pasar.`
            : `Para ${merchant.nombre}. Completá los datos del cupón.`}
        </p>
      </header>

      {modo === 'asesor' ? (
        <Asesor
          form={form}
          setForm={setForm}
          update={update}
          merchant={merchant}
          submitting={submitting}
          onPublicar={publicar}
          isEdit={isEdit}
        />
      ) : (
        <Clasico
          form={form}
          update={update}
          setForm={setForm}
          merchant={merchant}
          submitting={submitting}
          onPublicar={publicar}
          isEdit={isEdit}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  ASESOR (paso a paso)
// ════════════════════════════════════════════════════════════════════════

const PASOS = ['objetivo', 'jugada', 'gancho', 'plata', 'cuando', 'exclusiva', 'publicar'] as const
type Paso = (typeof PASOS)[number]

function Asesor({
  form,
  setForm,
  update,
  merchant,
  submitting,
  onPublicar,
  isEdit,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  merchant: { id: string; nombre: string; categoria: Categoria }
  submitting: boolean
  onPublicar: () => void
  isEdit: boolean
}) {
  // Al editar arrancamos en "plata" (lo más útil para retocar); si no, en objetivo.
  const [paso, setPaso] = useState<Paso>(isEdit ? 'plata' : 'objetivo')
  const idx = PASOS.indexOf(paso)
  const next = () => setPaso(PASOS[Math.min(PASOS.length - 1, idx + 1)])
  const prev = () => setPaso(PASOS[Math.max(0, idx - 1)])

  const jugada = useMemo(
    () => (form.objetivo ? sugerirJugada(form.objetivo, merchant.categoria, form.productoGancho) : null),
    [form.objetivo, merchant.categoria, form.productoGancho],
  )

  const precio = Number(form.precioReferencia)
  const costo = Number(form.costoReferencia)
  const money =
    form.precioReferencia.trim() && Number.isFinite(precio) && precio > 0
      ? calcMoney(precio, form.porcentaje, form.costoReferencia.trim() && costo > 0 ? costo : undefined)
      : null
  const fuerza = calcFuerza(form)

  function aplicarJugada(j: Jugada) {
    setForm((f) => ({
      ...f,
      titulo: j.titulo,
      descripcion: j.descripcion,
      porcentaje: j.porcentaje,
      tipoOferta: j.tipoOferta,
      exclusiva: j.exclusiva,
      dias: j.dias,
      franjaDesde: j.franjaDesde,
      franjaHasta: j.franjaHasta,
    }))
    next()
  }

  return (
    <div className="flex flex-col gap-5">
      <Stepper idx={idx} total={PASOS.length} />

      {paso === 'objetivo' && (
        <Step title="¿Qué querés lograr con este cupón?" hint="Elegí el objetivo y te propongo la jugada.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {OBJETIVOS.map((o) => {
              const Icon = o.icon
              const sel = form.objetivo === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { update('objetivo', o.id); setPaso('jugada') }}
                  className={`flex flex-col gap-1.5 rounded-2xl p-4 text-left ring-1 transition-all hover:-translate-y-0.5 ${
                    sel ? 'bg-accent-50 ring-accent-300' : 'bg-white ring-neutral-200 hover:ring-accent-200'
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${sel ? 'bg-accent-500 text-white' : 'bg-accent-50 text-accent-700'}`}>
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-bold text-neutral-900">{o.label}</span>
                  <span className="text-[11px] leading-snug text-neutral-500">{o.why}</span>
                </button>
              )
            })}
          </div>
        </Step>
      )}

      {paso === 'jugada' && (
        <Step
          title="Tu jugada recomendada"
          hint={jugada ? `Pensada para ${merchant.nombre}.` : 'Volvé y elegí un objetivo para que te proponga una.'}
        >
          {jugada ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-pink-50 to-accent-50 p-4 ring-1 ring-accent-100">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-accent-700 ring-1 ring-accent-200">
                <Zap size={12} /> {jugada.label}
              </span>
              <p className="text-base font-bold text-neutral-900">{jugada.titulo}</p>
              <p className="text-xs leading-snug text-neutral-600">{jugada.descripcion}</p>
              <p className="text-[11px] leading-snug text-neutral-500"><strong className="text-neutral-700">Por qué:</strong> {jugada.why}</p>
              <button type="button" onClick={() => aplicarJugada(jugada)} className={btnPrimary}>
                <Check size={16} /> Usar esta jugada
              </button>
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm leading-snug text-neutral-500 shadow-card ring-1 ring-neutral-100">
              Volvé un paso y elegí qué querés lograr y te propongo una jugada concreta. O seguí y armalo a mano.
            </p>
          )}
          <NavBtns onPrev={prev} onNext={next} nextLabel={jugada ? 'Prefiero armarlo yo' : 'Siguiente'} />
        </Step>
      )}

      {paso === 'gancho' && (
        <Step title="¿Cuál es tu producto estrella?" hint="El gancho concreto que hace que el vecino quiera venir.">
          <input
            type="text"
            value={form.productoGancho}
            maxLength={60}
            onChange={(e) => update('productoGancho', e.target.value)}
            placeholder="Ej: la pizza napolitana, el corte + brushing, el café de especialidad"
            className={inputCls}
            autoFocus
          />
          <NavBtns onPrev={prev} onNext={next} />
        </Step>
      )}

      {paso === 'plata' && (
        <Step title="Hagamos la cuenta" hint="Poné el precio normal y movés el descuento. El costo es opcional y privado.">
          <div className="grid grid-cols-2 gap-2.5">
            <MoneyInput label="Precio normal" value={form.precioReferencia} onChange={(v) => update('precioReferencia', v)} placeholder="6000" />
            <MoneyInput label="Tu costo (privado)" value={form.costoReferencia} onChange={(v) => update('costoReferencia', v)} placeholder="2500" />
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Descuento</span>
              <span className="text-lg font-bold tabular-nums text-accent-700">{form.porcentaje}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={70}
              step={5}
              value={form.porcentaje}
              onChange={(e) => update('porcentaje', Number(e.target.value))}
              className="mt-1 w-full accent-accent-600"
            />
            <div className="flex justify-between text-[10px] text-neutral-400"><span>5%</span><span>70%</span></div>
          </div>

          {money ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Paga el vecino</p>
                  <p className="text-xl font-bold text-neutral-900">{fmtMoney(money.vecinoPaga)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Se ahorra</p>
                  <p className="text-xl font-bold text-accent-700">{fmtMoney(money.ahorro)}</p>
                </div>
              </div>
              {money.margen != null && (
                <p className={`text-center text-xs font-semibold ${money.pierdePlata ? 'text-status-error-fg' : 'text-status-success-fg'}`}>
                  {money.pierdePlata
                    ? `⚠ Estás abajo del costo: perdés ${fmtMoney(Math.abs(money.margen))} por venta. Bajá el descuento.`
                    : `Te queda ${fmtMoney(money.margen)} de margen por venta.`}
                </p>
              )}
              {!money.pierdePlata && corajeMsg(form.objetivo, money) && (
                <p className="rounded-xl bg-accent-50 px-3 py-2 text-center text-xs font-medium text-accent-800">
                  {corajeMsg(form.objetivo, money)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400">
              Poné el precio normal y te muestro cuánto paga el vecino y cuánto se ahorra.
            </p>
          )}
          <NavBtns onPrev={prev} onNext={next} />
        </Step>
      )}

      {paso === 'cuando' && (
        <Step title="¿Cuándo aplica?" hint="Atalo a los días flojos o una franja. Genera urgencia.">
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((d) => {
              const sel = form.dias.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => update('dias', sel ? form.dias.filter((x) => x !== d.id) : [...form.dias, d.id])}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    sel ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-primary-50'
                  }`}
                >
                  {d.corto}
                </button>
              )
            })}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Franja</span>
            <input type="time" value={form.franjaDesde} onChange={(e) => update('franjaDesde', e.target.value)} className="rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-neutral-200" />
            <span className="text-neutral-400">a</span>
            <input type="time" value={form.franjaHasta} onChange={(e) => update('franjaHasta', e.target.value)} className="rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-neutral-200" />
          </div>
          <p className="text-[11px] text-neutral-400">
            {buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, '') || 'Sin restricción: aplica siempre.'}
          </p>
          <NavBtns onPrev={prev} onNext={next} />
        </Step>
      )}

      {paso === 'exclusiva' && (
        <Step title="¿Exclusivo de la app?" hint="Lo que hace que el vecino baje Mi San Pedro.">
          <button
            type="button"
            onClick={() => update('exclusiva', !form.exclusiva)}
            className={`flex items-center justify-between gap-3 rounded-2xl p-4 text-left ring-1 transition-all ${
              form.exclusiva ? 'bg-accent-50 ring-accent-300' : 'bg-white ring-neutral-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${form.exclusiva ? 'bg-accent-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                <Lock size={16} />
              </span>
              <div>
                <p className="text-sm font-bold text-neutral-900">Exclusivo de Mi San Pedro</p>
                <p className="text-[11px] leading-snug text-neutral-500">Que no se consiga en la puerta. Es lo que le da motivo al vecino para usar la app.</p>
              </div>
            </div>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${form.exclusiva ? 'bg-accent-600 text-white' : 'bg-neutral-200 text-transparent'}`}>
              <Check size={14} />
            </span>
          </button>
          <NavBtns onPrev={prev} onNext={next} nextLabel="Ver mi cupón" />
        </Step>
      )}

      {paso === 'publicar' && (
        <Step title="Tu cupón" hint="Así lo ve el vecino. Revisá la fuerza y publicá.">
          <FuerzaMeter fuerza={fuerza} />
          <Preview merchant={merchant} form={form} money={money} />
          {/* Vigencia rápida acá para no perder el paso de fecha */}
          <VigenciaChips value={form.vigenciaHasta} onChange={(v) => update('vigenciaHasta', v)} />
          <div className="flex gap-2">
            <button type="button" onClick={prev} className={btnGhost}><ArrowLeft size={16} /> Atrás</button>
            <button type="button" onClick={onPublicar} disabled={submitting} className={`${btnPrimary} flex-1`}>
              <Save size={16} /> {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Publicar cupón'}
            </button>
          </div>
        </Step>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  MODO RÁPIDO (form de toda la vida, ahora con los campos clave)
// ════════════════════════════════════════════════════════════════════════

function Clasico({
  form,
  update,
  setForm,
  merchant,
  submitting,
  onPublicar,
  isEdit,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  merchant: { id: string; nombre: string; categoria: Categoria }
  submitting: boolean
  onPublicar: () => void
  isEdit: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Preview merchant={merchant} form={form} money={null} />
      {!isEdit && (
        <TemplatesPicker
          key={merchant.categoria}
          categoria={merchant.categoria}
          onPick={(t) =>
            setForm((f) => ({
              ...f,
              titulo: t.titulo,
              descripcion: t.descripcion,
              condiciones: t.condiciones ?? '',
              porcentaje: t.porcentaje,
              diasAplica: t.diasAplica ?? '',
              tipoOferta: (t.tipoOferta as TipoOferta) ?? f.tipoOferta,
              objetivo: (t.objetivo as Objetivo) ?? f.objetivo,
              exclusiva: t.exclusiva ?? f.exclusiva,
              dias: (t.dias as DiaSemana[]) ?? f.dias,
              franjaDesde: t.franjaDesde ?? f.franjaDesde,
              franjaHasta: t.franjaHasta ?? f.franjaHasta,
              productoGancho: t.productoGancho ?? f.productoGancho,
            }))
          }
        />
      )}

      <Field label="Título del cupón" hint={`${form.titulo.length}/${TITULO_MAX}`}>
        <input type="text" value={form.titulo} maxLength={TITULO_MAX} onChange={(e) => update('titulo', e.target.value)} placeholder="Ej: 30% OFF en el menú del mediodía" className={inputCls} />
      </Field>

      <Field label="Descuento">
        <div className="flex items-center gap-3">
          <input type="range" min={5} max={70} step={5} value={form.porcentaje} onChange={(e) => update('porcentaje', Number(e.target.value))} className="w-full accent-accent-600" />
          <span className="w-12 text-right text-lg font-bold tabular-nums text-accent-700">{form.porcentaje}%</span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <MoneyInput label="Precio normal (opcional)" value={form.precioReferencia} onChange={(v) => update('precioReferencia', v)} placeholder="6000" />
        <MoneyInput label="Tu costo (privado)" value={form.costoReferencia} onChange={(v) => update('costoReferencia', v)} placeholder="2500" />
      </div>

      <Field label="Descripción" hint={`${form.descripcion.length}/${DESCRIPCION_MAX}`}>
        <textarea value={form.descripcion} maxLength={DESCRIPCION_MAX} rows={4} onChange={(e) => update('descripcion', e.target.value)} placeholder="¿Qué incluye? ¿En qué productos aplica?" className={`${inputCls} resize-none`} />
      </Field>

      <Field label="Condiciones (opcional)">
        <textarea value={form.condiciones} rows={3} onChange={(e) => update('condiciones', e.target.value)} placeholder="Restricciones, productos excluidos, monto mínimo, etc." className={`${inputCls} resize-none`} />
      </Field>

      <Field label="Días y franja (opcional)">
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => {
            const sel = form.dias.includes(d.id)
            return (
              <button key={d.id} type="button" onClick={() => update('dias', sel ? form.dias.filter((x) => x !== d.id) : [...form.dias, d.id])} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${sel ? 'bg-accent-600 text-white' : 'bg-white text-neutral-700 ring-1 ring-neutral-200'}`}>
                {d.corto}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input type="time" value={form.franjaDesde} onChange={(e) => update('franjaDesde', e.target.value)} className="rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-neutral-200" />
          <span className="text-neutral-400">a</span>
          <input type="time" value={form.franjaHasta} onChange={(e) => update('franjaHasta', e.target.value)} className="rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-neutral-200" />
        </div>
      </Field>

      <Field label="Vigente hasta">
        <VigenciaChips value={form.vigenciaHasta} onChange={(v) => update('vigenciaHasta', v)} />
      </Field>

      <BottomBar>
        <button type="button" onClick={onPublicar} disabled={submitting} className={`${btnPrimary} w-full`}>
          <Save size={16} /> {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cupón'}
        </button>
      </BottomBar>
    </div>
  )
}

// ─── Piezas compartidas ─────────────────────────────────────────────────

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'
const btnPrimary =
  'flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-sm font-bold text-white shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60'
const btnGhost =
  'flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-neutral-600 ring-1 ring-neutral-200 hover:bg-primary-50'

function Stepper({ idx, total }: { idx: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-accent-500' : 'bg-neutral-200'}`} />
      ))}
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function NavBtns({ onPrev, onNext, nextLabel = 'Siguiente' }: { onPrev: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onPrev} className={btnGhost}><ArrowLeft size={16} /> Atrás</button>
      <button type="button" onClick={onNext} className={`${btnPrimary} flex-1`}>{nextLabel} <ArrowRight size={16} /></button>
    </div>
  )
}

function MoneyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">$</span>
        <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-8`} />
      </div>
    </label>
  )
}

function FuerzaMeter({ fuerza }: { fuerza: { nivel: 'Fuerte' | 'Media' | 'Floja'; mejora: string } }) {
  const color =
    fuerza.nivel === 'Fuerte' ? 'bg-status-success-bg text-status-success-fg' : fuerza.nivel === 'Media' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-error-bg text-status-error-fg'
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Fuerza del cupón</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>{fuerza.nivel}</span>
      </div>
      {fuerza.mejora && (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-neutral-600">
          <Zap size={13} className="mt-0.5 shrink-0 text-accent-500" /> {fuerza.mejora}
        </p>
      )}
    </div>
  )
}

function VigenciaChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: '15 días', days: 15 },
          { label: '1 mes', days: 30 },
          { label: '3 meses', days: 90 },
          { label: '6 meses', days: 180 },
        ].map((p) => {
          const target = addDays(new Date(), p.days).toISOString().slice(0, 10)
          const active = value === target
          return (
            <button key={p.label} type="button" onClick={() => onChange(target)} className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${active ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-primary-50'}`}>
              {p.label}
            </button>
          )
        })}
      </div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} min={new Date().toISOString().slice(0, 10)} />
      {value && <p className="text-[11px] text-neutral-500">Hasta el <span className="font-bold text-neutral-700">{formatDateLong(value)}</span></p>}
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
        {hint && <span className="text-[11px] tabular-nums text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

function Preview({
  merchant,
  form,
  money,
}: {
  merchant: { id: string; nombre: string; categoria: Categoria }
  form: FormState
  money: ReturnType<typeof calcMoney> | null
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
      <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        Vista previa para el vecino
      </p>
      <div className="relative">
        <CardImage categoria={merchant.categoria} className="h-32 w-full" />
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-3 py-1 font-bold text-accent-700 shadow-card backdrop-blur-md">
          <span className="text-base tabular-nums">{form.porcentaje}%</span>
          <span className="ml-1 text-[10px] font-extrabold tracking-widest">OFF</span>
        </span>
        {form.exclusiva && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent-600/95 px-2.5 py-1 text-[10px] font-bold text-white shadow-card backdrop-blur">
            <Lock size={10} /> Exclusivo app
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{merchant.nombre}</p>
        <h3 className="text-base font-bold leading-tight text-neutral-900">{form.titulo || 'Título de tu cupón'}</h3>
        {money && (
          <p className="text-xs font-semibold text-neutral-600">
            Pagás <span className="font-bold text-neutral-900">{fmtMoney(money.vecinoPaga)}</span> · ahorrás{' '}
            <span className="font-bold text-accent-700">{fmtMoney(money.ahorro)}</span>
          </p>
        )}
        {(() => {
          const d = buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, form.diasAplica)
          return d ? <p className="text-xs text-neutral-500">{d}</p> : null
        })()}
      </div>
    </div>
  )
}

type Template = {
  titulo: string
  descripcion: string
  condiciones?: string
  porcentaje: number
  diasAplica?: string
  objetivo?: string
  tipoOferta?: string
  exclusiva?: boolean
  dias?: string[]
  franjaDesde?: string
  franjaHasta?: string
  productoGancho?: string
}

function TemplatesPicker({ categoria, onPick }: { categoria: Categoria; onPick: (t: Template) => void }) {
  const [items, setItems] = useState<Template[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let cancelled = false
    templatesApi
      .coupons(categoria)
      .then((r) => { if (!cancelled) setItems(r.templates as Template[]) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [categoria])

  if (items === null || items.length === 0) return null

  return (
    <div className="rounded-3xl bg-gradient-to-br from-pink-50 via-fuchsia-50 to-accent-50 p-4 ring-1 ring-accent-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 to-accent-600 text-white shadow-cta"><Wand2 size={16} /></div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Empezá con una jugada</p>
            <p className="text-[11px] text-neutral-500">Recetas fuertes para tu rubro. Después ajustás lo que quieras.</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen((s) => !s)} className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-accent-700 ring-1 ring-accent-200 hover:bg-accent-50">
          {open ? 'Cerrar' : `Ver ${items.length}`}
        </button>
      </div>
      {open && (
        <ul className="mt-3 grid gap-2">
          {items.map((t, i) => (
            <li key={i}>
              <button type="button" onClick={() => { onPick(t); setOpen(false) }} className="group flex w-full flex-col gap-1 rounded-2xl bg-white p-3 text-left ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:ring-accent-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-bold text-neutral-900">{t.titulo}</p>
                  <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700">{t.porcentaje}% OFF</span>
                </div>
                <p className="line-clamp-2 text-[11px] text-neutral-500">{t.descripcion}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
