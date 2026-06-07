import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Save,
  ImagePlus,
  Tag,
  Sparkles,
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
import { api, ApiError } from '@/lib/api'
import { useApiMyCoupons } from '@/lib/apiQueries'

type Objetivo = 'traer_nuevos' | 'llenar_flojos' | 'vaciar_stock' | 'fidelizar'
type TipoOferta = 'porcentaje' | 'dos_por_uno' | 'precio_fijo' | 'happy_hour'

type FormState = {
  titulo: string
  descripcion: string
  condiciones: string
  porcentaje: number
  /** Precio normal por persona (texto en el form; se manda como number). Público. */
  precioReferencia: string
  /** Precio final con el cupón (texto; se manda como number). Solo precio_fijo. Público. */
  precioFijo: string
  /** Costo aprox del comercio (texto; se manda como number). PRIVADO. */
  costoReferencia: string
  /** Imagen del cupón (data:image/* base64 o URL). Opcional. */
  imagenUrl: string
  vigenciaHasta: string
  /** Texto libre de display; se autogenera desde dias+franja si están. */
  diasAplica: string
  objetivo: Objetivo | ''
  tipoOferta: TipoOferta
  /** Alcance: 'puntual' (un producto) | 'categoria' (varios). Para % / happy_hour. */
  alcance: 'puntual' | 'categoria'
  /** Mostrar el ahorro en pesos al vecino (toggle). Default true. */
  mostrarAhorroVecino: boolean
  exclusiva: boolean
  dias: DiaSemana[]
  franjaDesde: string
  franjaHasta: string
  productoGancho: string
  usoMaxPorPersona: number
  usoVentana: 'devida' | 'semana' | 'quincena' | 'mes' | 'ilimitado'
}

const empty: FormState = {
  titulo: '',
  descripcion: '',
  condiciones: '',
  porcentaje: 30,
  precioReferencia: '',
  precioFijo: '',
  costoReferencia: '',
  imagenUrl: '',
  vigenciaHasta: defaultExpiry(),
  diasAplica: '',
  objetivo: '',
  tipoOferta: 'porcentaje',
  alcance: 'puntual',
  mostrarAhorroVecino: true,
  exclusiva: true,
  dias: [],
  franjaDesde: '',
  franjaHasta: '',
  productoGancho: '',
  usoMaxPorPersona: 1,
  usoVentana: 'devida',
}

const TIPOS: { id: TipoOferta; label: string }[] = [
  { id: 'porcentaje', label: 'Porcentaje' },
  { id: 'happy_hour', label: 'Happy hour' },
  { id: 'precio_fijo', label: 'Precio fijo' },
]

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

  useEffect(() => {
    if (existing) {
      setForm({
        titulo: existing.titulo,
        descripcion: existing.descripcion,
        condiciones: existing.condiciones ?? '',
        porcentaje: existing.porcentaje,
        precioReferencia: existing.precioReferencia != null ? String(existing.precioReferencia) : '',
        precioFijo: existing.precioFijo != null ? String(existing.precioFijo) : '',
        costoReferencia: existing.costoReferencia != null ? String(existing.costoReferencia) : '',
        imagenUrl: existing.imagenUrl ?? '',
        vigenciaHasta: isoToDate(existing.vigenciaHasta),
        diasAplica: existing.diasAplica ?? '',
        objetivo: existing.objetivo ?? '',
        tipoOferta: existing.tipoOferta ?? 'porcentaje',
        alcance: existing.alcance ?? 'puntual',
        mostrarAhorroVecino: existing.mostrarAhorroVecino ?? true,
        exclusiva: existing.exclusiva ?? true,
        dias: Array.isArray(existing.dias) ? existing.dias : [],
        franjaDesde: existing.franjaDesde ?? '',
        franjaHasta: existing.franjaHasta ?? '',
        productoGancho: existing.productoGancho ?? '',
        usoMaxPorPersona: existing.usoMaxPorPersona ?? 1,
        usoVentana: existing.usoVentana ?? 'devida',
      })
    } else {
      setForm(empty)
    }
  }, [existing?.id])

  if (!session || !merchant) return <Navigate to="/admin/login" replace />
  if (isEdit && !existing && apiCupones.loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
        <div className="h-6 w-40 animate-pulse rounded-full bg-surface-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface shadow-card" style={{ animationDelay: `${i * 60}ms` }} />
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
    if (form.tipoOferta === 'happy_hour' && !(form.franjaDesde && form.franjaHasta)) {
      toast.error('Falta la franja', 'El happy hour necesita un horario (ej. 15 a 18 hs) en "¿Cuándo aplica?".')
      return
    }
    if (form.tipoOferta === 'precio_fijo') {
      const pf = Number(form.precioFijo)
      const pr = Number(form.precioReferencia)
      if (!form.precioFijo.trim() || !(pf > 0)) {
        toast.error('Falta el precio con el cupón', 'En "precio fijo" poné a cuánto lo dejás.')
        return
      }
      if (form.precioReferencia.trim() && pr > 0 && pf >= pr) {
        toast.error('Revisá los precios', 'El precio con el cupón tiene que ser MENOR al precio normal.')
        return
      }
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
    const precioRefNum = num(form.precioReferencia)
    const precioFijoVal = num(form.precioFijo)
    // precio_fijo: el % se DERIVA del ahorro (precio normal − precio con cupón) para
    // mantener consistente el modelo (porcentaje requerido) y el badge del vecino.
    const porcentajeFinal =
      form.tipoOferta === 'precio_fijo' && precioRefNum && precioFijoVal && precioRefNum > precioFijoVal
        ? Math.max(1, Math.round(((precioRefNum - precioFijoVal) / precioRefNum) * 100))
        : form.porcentaje
    const apiPayload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      condiciones: form.condiciones.trim(),
      porcentaje: porcentajeFinal,
      precioReferencia: precioRefNum,
      precioFijo: clr(form.tipoOferta === 'precio_fijo' ? precioFijoVal : undefined),
      costoReferencia: clr(num(form.costoReferencia)),
      imagenUrl: clr(form.imagenUrl.trim() || undefined),
      vigenciaHasta: dateToIso(form.vigenciaHasta),
      diasAplica: buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, form.diasAplica.trim()) || undefined,
      dias: clr(form.dias.length ? form.dias : undefined),
      franjaDesde: clr(franjaOk ? form.franjaDesde : undefined),
      franjaHasta: clr(franjaOk ? form.franjaHasta : undefined),
      objetivo: clr(form.objetivo || undefined),
      tipoOferta: form.tipoOferta,
      alcance: form.alcance,
      mostrarAhorroVecino: form.mostrarAhorroVecino,
      exclusiva: form.exclusiva,
      productoGancho: clr(form.productoGancho.trim() || undefined),
      usoMaxPorPersona: form.usoMaxPorPersona,
      usoVentana: form.usoVentana,
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
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-44 sm:px-6 sm:pt-10 md:pb-32">
      <Link to="/admin/cupones" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ChevronLeft size={16} /> Mis cupones
      </Link>

      <header className="flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
          {isEdit ? <Tag size={12} /> : <Sparkles size={12} />} {isEdit ? 'Editar cupón' : 'Nuevo cupón'}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Armemos un cupón fuerte
        </h1>
        <p className="text-sm text-ink-soft">
          Te hago unas preguntas y salís con un cupón que el vecino no quiera dejar pasar.
        </p>
      </header>

      <Asesor
        form={form}
        setForm={setForm}
        update={update}
        merchant={merchant}
        submitting={submitting}
        onPublicar={publicar}
        isEdit={isEdit}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  ASESOR (paso a paso)
// ════════════════════════════════════════════════════════════════════════

const PASOS = ['objetivo', 'jugada', 'gancho', 'plata', 'cuando', 'publicar'] as const
type Paso = (typeof PASOS)[number]

/** Opciones del selector "¿cada cuánto puede usarlo cada persona?" → setean usoVentana (usoMax 1). */
const USO_OPCIONES: { ventana: FormState['usoVentana']; label: string }[] = [
  { ventana: 'devida', label: 'Una sola vez' },
  { ventana: 'semana', label: 'Una vez por semana' },
  { ventana: 'quincena', label: 'Una vez cada 15 días' },
  { ventana: 'mes', label: 'Una vez por mes' },
  { ventana: 'ilimitado', label: 'Sin límite' },
]

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
  const precioFijoNum = Number(form.precioFijo)
  const tienePrecio = form.precioReferencia.trim() !== '' && Number.isFinite(precio) && precio > 0
  const tieneCosto = form.costoReferencia.trim() !== '' && Number.isFinite(costo) && costo > 0
  const tieneFijo = form.precioFijo.trim() !== '' && Number.isFinite(precioFijoNum) && precioFijoNum > 0
  const esPrecioFijo = form.tipoOferta === 'precio_fijo'
  // El MOTOR DE PLATA siempre usa el precio (aunque el toggle de mostrar al
  // vecino esté OFF): es la cuenta interna del comercio (margen + ahorro).
  const money = esPrecioFijo
    ? tieneFijo
      ? {
          vecinoPaga: precioFijoNum,
          ahorro: tienePrecio ? Math.max(0, precio - precioFijoNum) : 0,
          margen: tieneCosto ? precioFijoNum - costo : null,
          pierdePlata: tieneCosto && precioFijoNum < costo,
        }
      : null
    : tienePrecio
      ? calcMoney(precio, form.porcentaje, tieneCosto && costo > 0 ? costo : undefined)
      : null
  // El costo no puede igualar ni superar al precio (no habría margen ni a 0% off).
  const costoMayorQuePrecio = tienePrecio && tieneCosto && costo >= precio
  // Máximo % de descuento que NO te deja vender bajo costo (múltiplo de 5). Sin
  // costo, el tope es 70. Así el costo "impacta la barra de descuento".
  const maxDescuento =
    tienePrecio && tieneCosto && costo < precio
      ? Math.min(70, Math.max(5, Math.floor(((1 - costo / precio) * 100) / 5) * 5))
      : 70
  // Si el costo baja el tope por debajo del % elegido, lo recortamos solo.
  useEffect(() => {
    if (form.porcentaje > maxDescuento) update('porcentaje', maxDescuento)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDescuento])
  // Si llegás a "publicar" sin título/descripción (p.ej. saltaste la jugada), los
  // autocompletamos con un default editable para que no falle al publicar.
  useEffect(() => {
    if (paso !== 'publicar') return
    const g = form.productoGancho.trim()
    if (!form.titulo.trim()) {
      update('titulo', g ? `${form.porcentaje}% OFF en ${g}` : `${form.porcentaje}% OFF en el local`)
    }
    if (!form.descripcion.trim()) {
      update(
        'descripcion',
        `Aprovechá ${form.porcentaje}% OFF${g ? ` en ${g}` : ''} en ${merchant.nombre}. Mostrá el cupón en el local para usarlo.`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso])
  const fuerza = calcFuerza(form)
  // La franja necesita que el cierre sea MAYOR al inicio. Como "HH:MM" está
  // zero-padded, la comparación de strings alcanza. Si está al revés, avisamos
  // y bloqueamos el "Siguiente".
  const franjaInvalida = !!(
    form.franjaDesde &&
    form.franjaHasta &&
    form.franjaHasta <= form.franjaDesde
  )

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
                    sel ? 'bg-brand-soft ring-brand' : 'bg-surface ring-line hover:ring-line'
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${sel ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand-strong'}`}>
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-bold text-ink">{o.label}</span>
                  <span className="text-[11px] leading-snug text-ink-soft">{o.why}</span>
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
            <div className="flex flex-col gap-3 rounded-2xl bg-brand-soft p-4 ring-1 ring-line">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-brand-strong ring-1 ring-line">
                <Zap size={12} /> {jugada.label}
              </span>
              <p className="text-base font-bold text-ink">{jugada.titulo}</p>
              <p className="text-xs leading-snug text-ink-soft">{jugada.descripcion}</p>
              <JugadaResumen jugada={jugada} />
              <p className="text-[11px] leading-snug text-ink-soft"><strong className="text-ink">Por qué funciona:</strong> {jugada.why}</p>
              <button type="button" onClick={() => aplicarJugada(jugada)} className={`${btnPrimary} mt-1`}>
                <Check size={16} /> Usar esta jugada
              </button>
              <p className="text-center text-[11px] text-ink-faint">
                Cargo todo esto en el cupón y lo revisás antes de publicar.
              </p>
            </div>
          ) : (
            <p className="rounded-2xl bg-surface p-4 text-sm leading-snug text-ink-soft shadow-card ring-1 ring-line">
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
        <Step title="Hagamos la cuenta" hint="Elegí el tipo de oferta y poné los números. El costo es privado.">
          {/* TIPO de oferta (define qué inputs y cómo lo ve el vecino) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Tipo de oferta</span>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS.map((t) => {
                const sel = form.tipoOferta === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update('tipoOferta', t.id)}
                    className={`rounded-xl px-2 py-2 text-xs font-bold ring-1 transition-all ${
                      sel
                        ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand ring-brand shadow-cta'
                        : 'bg-surface text-ink ring-line hover:bg-bg'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MoneyInput label="Precio normal" value={form.precioReferencia} onChange={(v) => update('precioReferencia', v)} placeholder="6000" />
            <MoneyInput label="Tu costo (privado)" value={form.costoReferencia} onChange={(v) => update('costoReferencia', v)} placeholder="2500" />
          </div>
          {costoMayorQuePrecio && (
            <p className="text-[11px] font-semibold text-status-error-fg">
              Tu costo tiene que ser menor al precio normal — revisá los números.
            </p>
          )}

          {esPrecioFijo ? (
            <MoneyInput
              label="Precio con el cupón"
              value={form.precioFijo}
              onChange={(v) => update('precioFijo', v)}
              placeholder="4000"
            />
          ) : (
            <>
              <div className="mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Descuento</span>
                  <span className="text-lg font-bold tabular-nums text-brand-strong">{form.porcentaje}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={maxDescuento}
                  step={5}
                  value={Math.min(form.porcentaje, maxDescuento)}
                  onChange={(e) => update('porcentaje', Number(e.target.value))}
                  className="mt-1 w-full accent-brand"
                />
                <div className="flex justify-between text-[10px] text-ink-faint"><span>5%</span><span>{maxDescuento}%</span></div>
                {tieneCosto && !costoMayorQuePrecio && maxDescuento < 70 && (
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Tope <span className="font-bold text-ink">{maxDescuento}%</span> para no vender bajo tu costo.
                  </p>
                )}
              </div>

              {/* ALCANCE: sobre un producto puntual o una categoría/varios */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">¿Sobre qué aplica?</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {([['puntual', 'Un producto'], ['categoria', 'Categoría / varios']] as const).map(([id, label]) => {
                    const sel = form.alcance === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => update('alcance', id)}
                        className={`rounded-xl px-2 py-2 text-xs font-bold ring-1 transition-all ${
                          sel ? 'bg-brand-soft text-brand-strong ring-brand' : 'bg-surface text-ink ring-line hover:bg-bg'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-ink-faint">
                  {form.alcance === 'categoria'
                    ? 'El "precio normal" es el PROMEDIO de la categoría — el vecino ve el ahorro como orientativo (~).'
                    : 'El "precio normal" es el de ese producto — el vecino ve el ahorro exacto.'}
                </p>
              </div>
            </>
          )}

          {money ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Paga el vecino</p>
                  <p className="text-xl font-bold text-ink">{fmtMoney(money.vecinoPaga)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Se ahorra</p>
                  <p className="text-xl font-bold text-brand-strong">{fmtMoney(money.ahorro)}</p>
                </div>
              </div>
              {money.margen != null && (
                <p className={`text-center text-xs font-semibold ${money.pierdePlata ? 'text-status-error-fg' : 'text-status-success-fg'}`}>
                  {money.pierdePlata
                    ? `⚠ Estás abajo del costo: perdés ${fmtMoney(Math.abs(money.margen))} por venta. ${esPrecioFijo ? 'Subí el precio.' : 'Bajá el descuento.'}`
                    : `Te queda ${fmtMoney(money.margen)} de margen por venta.`}
                </p>
              )}
              {!money.pierdePlata && !esPrecioFijo && corajeMsg(form.objetivo, money) && (
                <p className="rounded-xl bg-brand-soft px-3 py-2 text-center text-xs font-medium text-brand-strong">
                  {corajeMsg(form.objetivo, money)}
                </p>
              )}
              <p className="border-t border-line pt-2 text-center text-[11px] text-ink-soft">
                💡 El <span className="font-bold text-brand-strong">costo es privado</span> (solo tu margen). El precio se le muestra al vecino solo si dejás el ahorro en pesos activado.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-ink-faint">
              {esPrecioFijo
                ? 'Poné el precio con el cupón (y el normal) y te calculo el ahorro y tu margen.'
                : 'Poné el precio normal y te muestro cuánto paga el vecino, cuánto se ahorra y tu margen.'}
            </p>
          )}

          {/* Toggle: ¿mostrar el ahorro en pesos al vecino? (no aplica a precio_fijo) */}
          {!esPrecioFijo && tienePrecio && (
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
              <span className="min-w-0 text-xs font-semibold text-ink">
                Mostrarle el ahorro en pesos al vecino
                <span className="block text-[11px] font-normal text-ink-soft">
                  Si lo apagás, ve solo el “{form.porcentaje}% OFF”.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.mostrarAhorroVecino}
                onChange={(e) => update('mostrarAhorroVecino', e.target.checked)}
                className="h-5 w-5 shrink-0 accent-brand"
              />
            </label>
          )}

          <NavBtns onPrev={prev} onNext={next} nextDisabled={costoMayorQuePrecio} />
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
                    sel ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta' : 'bg-surface text-ink ring-1 ring-line hover:bg-bg'
                  }`}
                >
                  {d.corto}
                </button>
              )
            })}
          </div>
          <div className="mt-1 flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Franja</span>
            <div className="flex items-center gap-2">
              <input type="time" value={form.franjaDesde} onChange={(e) => update('franjaDesde', e.target.value)} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line" />
              <span className="shrink-0 text-ink-faint">a</span>
              <input type="time" value={form.franjaHasta} min={form.franjaDesde || undefined} onChange={(e) => update('franjaHasta', e.target.value)} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line" />
            </div>
          </div>
          {franjaInvalida ? (
            <p className="text-[11px] font-semibold text-status-error-fg">
              El horario de cierre tiene que ser mayor al de inicio.
            </p>
          ) : (
            <p className="text-[11px] text-ink-faint">
              {buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, '') || 'Sin restricción: aplica siempre.'}
            </p>
          )}

          <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              ¿Cada cuánto puede usarlo cada persona?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {USO_OPCIONES.map((o) => {
                const sel = form.usoVentana === o.ventana
                return (
                  <button
                    key={o.ventana}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, usoVentana: o.ventana, usoMaxPorPersona: 1 }))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      sel
                        ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta'
                        : 'bg-surface text-ink ring-1 ring-line hover:bg-bg'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-ink-faint">
              Evita que la misma persona lo use de más y te coma el margen.
            </p>
          </div>

          <NavBtns onPrev={prev} onNext={next} nextLabel="Ver mi cupón" nextDisabled={franjaInvalida} />
        </Step>
      )}

      {paso === 'publicar' && (
        <Step title="Tu cupón" hint="Así lo ve el vecino. Revisá, ajustá y publicá.">
          <FuerzaMeter fuerza={fuerza} />
          <Preview merchant={merchant} form={form} money={money} />

          <Field label="Título del cupón" hint={`${form.titulo.length}/60`}>
            <input
              type="text"
              value={form.titulo}
              maxLength={60}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Ej: 30% OFF en el menú del mediodía"
              className={inputCls}
            />
          </Field>

          <Field label="Descripción" hint={`${form.descripcion.length}/280`}>
            <textarea
              value={form.descripcion}
              maxLength={280}
              rows={3}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="¿Qué incluye? ¿En qué productos aplica?"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Foto del cupón (opcional)">
            <ImagenCuponInput value={form.imagenUrl} onChange={(v) => update('imagenUrl', v)} />
          </Field>

          {/* Vigencia rápida acá para no perder el paso de fecha */}
          <VigenciaChips value={form.vigenciaHasta} onChange={(v) => update('vigenciaHasta', v)} />
          <WizardBar>
            <button type="button" onClick={prev} className={btnGhost}><ArrowLeft size={16} /> Atrás</button>
            <button type="button" onClick={onPublicar} disabled={submitting} className={`${btnPrimary} flex-1`}>
              <Save size={16} /> {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Publicar cupón'}
            </button>
          </WizardBar>
        </Step>
      )}
    </div>
  )
}

// ─── Piezas compartidas ─────────────────────────────────────────────────

const inputCls =
  'w-full rounded-2xl bg-surface px-4 py-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand'
const btnPrimary =
  'flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60'
const btnGhost =
  'flex items-center justify-center gap-1.5 rounded-2xl bg-surface px-4 py-3.5 text-sm font-bold text-ink-soft ring-1 ring-line hover:bg-bg'

function Stepper({ idx, total }: { idx: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-brand' : 'bg-surface-2'}`} />
      ))}
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Resumen concreto de la jugada: traduce los campos (%, días, franja,
 * exclusividad) a chips para que el comercio vea EXACTAMENTE qué cupón va a
 * crear antes de aplicarla.
 */
function JugadaResumen({ jugada }: { jugada: Jugada }) {
  const chips: string[] = [`${jugada.porcentaje}% OFF`]
  chips.push(
    jugada.dias.length > 0 && jugada.dias.length < 7
      ? DIAS_SEMANA.filter((d) => jugada.dias.includes(d.id))
          .map((d) => d.corto)
          .join(', ')
      : 'Todos los días',
  )
  if (jugada.franjaDesde && jugada.franjaHasta) {
    chips.push(`${jugada.franjaDesde}–${jugada.franjaHasta} hs`)
  }
  if (jugada.exclusiva) chips.push('Exclusivo de la app')
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-strong">
        Esto crea
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-line"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Barra de acción del asesor: SIEMPRE fija al pie. Se portalea a `document.body`
 * para escapar el containing-block del transform del contenedor (animate-fade-up)
 * y se ubica arriba del bottom-nav flotante del MerchantShell (bottom-24 en
 * mobile, bottom-0 en desktop). Así, en todo momento, se ve qué toca abajo.
 */
function WizardBar({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-24 z-30 bg-bg md:bottom-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-2xl gap-2 px-4 py-3 sm:px-6">{children}</div>
    </div>,
    document.body,
  )
}

function NavBtns({
  onPrev,
  onNext,
  nextLabel = 'Siguiente',
  nextDisabled = false,
}: {
  onPrev: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <WizardBar>
      <button type="button" onClick={onPrev} className={btnGhost}>
        <ArrowLeft size={16} /> Atrás
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={`${btnPrimary} flex-1`}
      >
        {nextLabel} <ArrowRight size={16} />
      </button>
    </WizardBar>
  )
}

function MoneyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-faint">$</span>
        <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-8`} />
      </div>
    </label>
  )
}

function FuerzaMeter({ fuerza }: { fuerza: { nivel: 'Fuerte' | 'Media' | 'Floja'; mejora: string } }) {
  const color =
    fuerza.nivel === 'Fuerte' ? 'bg-status-success-bg text-status-success-fg' : fuerza.nivel === 'Media' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-error-bg text-status-error-fg'
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Fuerza del cupón</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>{fuerza.nivel}</span>
      </div>
      {fuerza.mejora && (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-ink-soft">
          <Zap size={13} className="mt-0.5 shrink-0 text-brand" /> {fuerza.mejora}
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
            <button key={p.label} type="button" onClick={() => onChange(target)} className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${active ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta' : 'bg-surface text-ink ring-1 ring-line hover:bg-bg'}`}>
              {p.label}
            </button>
          )
        })}
      </div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} min={new Date().toISOString().slice(0, 10)} />
      {value && <p className="text-[11px] text-ink-soft">Hasta el <span className="font-bold text-ink">{formatDateLong(value)}</span></p>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">{label}</span>
        {hint && <span className="text-[11px] tabular-nums text-ink-faint">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

const MAX_CUPON_IMG_BYTES = 2 * 1024 * 1024

/** Uploader de la imagen del cupón: base64 con límite de 2 MB. La foto se
 *  acomoda sola al recuadro de la tarjeta (object-cover en CardImage). */
function ImagenCuponInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useToast()
  function onPick(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Tiene que ser una imagen')
      return
    }
    if (file.size > MAX_CUPON_IMG_BYTES) {
      toast.error('Imagen muy grande', 'El máximo es 2 MB. Probá con una más liviana.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.onerror = () => toast.error('No se pudo leer el archivo')
    reader.readAsDataURL(file)
  }
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} className="text-ink-faint" />
        )}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="rounded-xl bg-surface px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-line hover:bg-bg"
        >
          {value ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-semibold text-status-error-fg"
          >
            Quitar
          </button>
        ) : (
          <span className="text-[11px] text-ink-faint">Se acomoda sola al recuadro. Máx 2 MB.</span>
        )}
      </div>
    </div>
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
    <div className="overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line">
      <p className="border-b border-line px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
        Vista previa para el vecino
      </p>
      <div className="relative">
        <CardImage categoria={merchant.categoria} coverImageUrl={form.imagenUrl || undefined} className="h-32 w-full" />
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-surface/95 px-3 py-1 font-bold text-brand-strong shadow-card backdrop-blur-md">
          <span className="text-base tabular-nums">{form.porcentaje}%</span>
          <span className="ml-1 text-[10px] font-extrabold tracking-widest">OFF</span>
        </span>
        {form.exclusiva && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-strong/95 px-2.5 py-1 text-[10px] font-bold text-on-brand shadow-card backdrop-blur">
            <Lock size={10} /> Exclusivo app
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{merchant.nombre}</p>
        <h3 className="text-base font-bold leading-tight text-ink">{form.titulo || 'Título de tu cupón'}</h3>
        {money && (
          <p className="text-xs font-semibold text-ink-soft">
            Pagás <span className="font-bold text-ink">{fmtMoney(money.vecinoPaga)}</span> · ahorrás{' '}
            <span className="font-bold text-brand-strong">{fmtMoney(money.ahorro)}</span>
          </p>
        )}
        {(() => {
          const d = buildDiasAplica(form.dias, form.franjaDesde, form.franjaHasta, form.diasAplica)
          return d ? <p className="text-xs text-ink-soft">{d}</p> : null
        })()}
      </div>
    </div>
  )
}
