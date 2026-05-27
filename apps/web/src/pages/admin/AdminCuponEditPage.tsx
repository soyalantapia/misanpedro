import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Save, Tag, Sparkles, Wand2 } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useCoupon } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { CardImage } from '@/components/CardImage'
import { getMerchant } from '@/data/mockData'
import type { Categoria } from '@/lib/types'
import { api, ApiError, templates as templatesApi } from '@/lib/api'
import { useApiMyCoupons } from '@/lib/apiQueries'

const PORCENTAJES = [5, 10, 15, 20, 25, 30, 40, 50] as const

const TITULO_MAX = 60
const DESCRIPCION_MAX = 280

type FormState = {
  titulo: string
  descripcion: string
  condiciones: string
  porcentaje: number
  vigenciaHasta: string
  diasAplica: string
}

const empty: FormState = {
  titulo: '',
  descripcion: '',
  condiciones: '',
  porcentaje: 15,
  vigenciaHasta: defaultExpiry(),
  diasAplica: '',
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

function daysFromToday(iso: string): string {
  if (!iso) return ''
  const target = new Date(iso + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ms = target.getTime() - today.getTime()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (days < 0) return 'venció'
  if (days === 0) return 'vence hoy'
  if (days === 1) return 'queda 1 día'
  if (days < 30) return `quedan ${days} días`
  const meses = Math.round(days / 30)
  return `quedan ~${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

function isoToDate(iso: string): string {
  return iso.slice(0, 10)
}

function dateToIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString()
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
  // Si la sesión vino del API, usamos apiMerchant. Fallback a getMerchant
  // local sólo en modo demo offline (donde session.merchantId es slug).
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
        vigenciaHasta: isoToDate(existing.vigenciaHasta),
        diasAplica: existing.diasAplica ?? '',
      })
    } else {
      setForm(empty)
    }
  }, [existing?.id])

  if (!session || !merchant) return <Navigate to="/admin/login" replace />
  // Si todavía no cargó la lista de la API y tampoco encontramos local,
  // esperamos antes de redirigir.
  if (isEdit && !existing && !apiCupones.loading) {
    return <Navigate to="/admin/cupones" replace />
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    if (form.titulo.trim().length < 8) {
      toast.error('Título muy corto', 'Mínimo 8 caracteres para que se entienda el descuento.')
      return
    }
    if (form.descripcion.trim().length < 20) {
      toast.error(
        'Descripción muy corta',
        'Contale al vecino qué incluye (mínimo 20 caracteres).',
      )
      return
    }
    if (!form.vigenciaHasta) {
      toast.error('Falta la vigencia', 'Indicá hasta cuándo aplica.')
      return
    }
    setSubmitting(true)

    const apiPayload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      condiciones: form.condiciones.trim(),
      porcentaje: form.porcentaje,
      vigenciaHasta: dateToIso(form.vigenciaHasta),
      diasAplica: form.diasAplica.trim() || undefined,
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
      toast.error(
        'No se pudo guardar',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/admin/cupones"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Mis cupones
      </Link>

      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          {isEdit ? <Tag size={12} /> : <Sparkles size={12} />}{' '}
          {isEdit ? 'Editar cupón' : 'Nuevo descuento'}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {isEdit ? form.titulo || 'Editar cupón' : 'Crear un descuento'}
        </h1>
        <p className="text-sm text-neutral-500">
          Para {merchant.nombre}. Completá los datos y los vecinos lo van a ver al instante.
        </p>
      </header>

      <Preview merchant={merchant} form={form} />

      {!isEdit && (
        <TemplatesPicker
          categoria={merchant.categoria as Categoria}
          onPick={(t) =>
            setForm((f) => ({
              ...f,
              titulo: t.titulo,
              descripcion: t.descripcion,
              condiciones: t.condiciones ?? '',
              porcentaje: t.porcentaje,
              diasAplica: t.diasAplica ?? '',
            }))
          }
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Título del descuento"
          required
          hint={`${form.titulo.length}/${TITULO_MAX}`}
          help={
            form.titulo.length > 0 && form.titulo.length < 8
              ? `Faltan ${8 - form.titulo.length} caracteres para el mínimo (8)`
              : undefined
          }
          input={
            <input
              type="text"
              value={form.titulo}
              maxLength={TITULO_MAX}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Ej: 20% OFF en tu primera consulta"
              className={inputCls}
              autoComplete="off"
            />
          }
        />

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Porcentaje de descuento
          </p>
          <div className="flex flex-wrap gap-2">
            {PORCENTAJES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update('porcentaje', p)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  form.porcentaje === p
                    ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-primary-50'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          {/* Custom percentage */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-neutral-400">Otro:</span>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={99}
                value={PORCENTAJES.includes(form.porcentaje as (typeof PORCENTAJES)[number]) ? '' : form.porcentaje}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(99, Number(e.target.value)))
                  if (!Number.isNaN(v)) update('porcentaje', v)
                }}
                placeholder="Ej: 12"
                className="w-20 rounded-full bg-white px-3 py-1.5 text-center text-xs font-bold ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
            </div>
          </div>
        </div>

        <Field
          label="Descripción"
          required
          hint={`${form.descripcion.length}/${DESCRIPCION_MAX}`}
          help={
            form.descripcion.length > 0 && form.descripcion.length < 20
              ? `Faltan ${20 - form.descripcion.length} caracteres para el mínimo (20)`
              : undefined
          }
          input={
            <textarea
              value={form.descripcion}
              maxLength={DESCRIPCION_MAX}
              rows={4}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="¿Qué incluye el descuento? ¿En qué servicios o productos aplica?"
              className={`${inputCls} resize-none`}
            />
          }
        />

        <Field
          label="Condiciones (opcional)"
          input={
            <textarea
              value={form.condiciones}
              rows={3}
              onChange={(e) => update('condiciones', e.target.value)}
              placeholder="Restricciones, productos excluidos, monto mínimo, etc."
              className={`${inputCls} resize-none`}
            />
          }
        />

        <Field
          label="Días y horarios que aplica (opcional)"
          input={
            <input
              type="text"
              value={form.diasAplica}
              onChange={(e) => update('diasAplica', e.target.value)}
              placeholder="Ej: Lunes a viernes · 9 a 18 hs"
              className={inputCls}
            />
          }
        />

        <Field
          label="Vigente hasta"
          input={
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 sem', days: 7 },
                  { label: '15 días', days: 15 },
                  { label: '1 mes', days: 30 },
                  { label: '3 meses', days: 90 },
                  { label: '6 meses', days: 180 },
                  { label: '1 año', days: 365 },
                ].map((p) => {
                  const targetDate = addDays(new Date(), p.days).toISOString().slice(0, 10)
                  const active = form.vigenciaHasta === targetDate
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => update('vigenciaHasta', targetDate)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                        active
                          ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                          : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-primary-50 hover:ring-accent-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <input
                type="date"
                value={form.vigenciaHasta}
                onChange={(e) => update('vigenciaHasta', e.target.value)}
                className={inputCls}
                min={new Date().toISOString().slice(0, 10)}
                required
              />
              {form.vigenciaHasta && (
                <p className="text-[11px] text-neutral-500">
                  Hasta el <span className="font-bold text-neutral-700">{formatDateLong(form.vigenciaHasta)}</span>{' '}
                  · {daysFromToday(form.vigenciaHasta)}
                </p>
              )}
            </div>
          }
        />

        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:px-6">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
            >
              <Save size={16} />
              {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear descuento'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Preview({
  merchant,
  form,
}: {
  merchant: { id: string; nombre: string; categoria: Categoria } | undefined
  form: FormState
}) {
  if (!merchant) return null
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
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          {merchant.nombre}
        </p>
        <h3 className="text-base font-bold leading-tight text-neutral-900">
          {form.titulo || 'Título de tu descuento'}
        </h3>
        {form.diasAplica && <p className="text-xs text-neutral-500">{form.diasAplica}</p>}
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400'

function Field({
  label,
  input,
  hint,
  help,
  required,
}: {
  label: string
  input: React.ReactNode
  hint?: string
  /** Texto naranja debajo del input (validación inline o feedback). */
  help?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          {label}
          {required && <span className="ml-1 text-status-error">*</span>}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-neutral-400">{hint}</span>}
      </div>
      {input}
      {help && (
        <p className="text-[11px] font-semibold text-status-warning-fg">{help}</p>
      )}
    </label>
  )
}

type Template = {
  titulo: string
  descripcion: string
  condiciones?: string
  porcentaje: number
  diasAplica?: string
}

function TemplatesPicker({
  categoria,
  onPick,
}: {
  categoria: Categoria
  onPick: (t: Template) => void
}) {
  const [items, setItems] = useState<Template[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    templatesApi
      .coupons(categoria)
      .then((r) => {
        if (!cancelled) setItems(r.templates)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoria])

  if (loading || !items || items.length === 0) return null

  return (
    <div className="rounded-3xl bg-gradient-to-br from-pink-50 via-fuchsia-50 to-accent-50 p-4 ring-1 ring-accent-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 to-accent-600 text-white shadow-cta">
            <Wand2 size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Empezá con una plantilla</p>
            <p className="text-[11px] text-neutral-500">
              Plantillas pensadas para tu rubro. Después podés ajustar lo que quieras.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          aria-label={open ? 'Cerrar plantillas' : `Ver ${items.length} plantillas disponibles`}
          className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-accent-700 ring-1 ring-accent-200 hover:bg-accent-50"
        >
          {open ? 'Cerrar' : `Ver ${items.length}`}
        </button>
      </div>

      {open && (
        <ul className="mt-3 grid gap-2">
          {items.map((t, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onPick(t)
                  setOpen(false)
                }}
                className="group flex w-full flex-col gap-1 rounded-2xl bg-white p-3 text-left ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:ring-accent-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-bold text-neutral-900">
                    {t.titulo}
                  </p>
                  <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700">
                    {t.porcentaje}% OFF
                  </span>
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
