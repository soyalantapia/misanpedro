import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Save, Tag, Sparkles } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { couponsActions, useCoupon } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { CardImage } from '@/components/CardImage'
import { getMerchant } from '@/data/mockData'
import type { Coupon } from '@/lib/types'

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
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
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
  const existing = useCoupon(id)
  const { session } = useMerchantSession()
  const merchant = session ? getMerchant(session.merchantId) : undefined
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(empty)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (existing) {
      setForm({
        titulo: existing.titulo,
        descripcion: existing.descripcion,
        condiciones: existing.condiciones,
        porcentaje: existing.porcentaje,
        vigenciaHasta: isoToDate(existing.vigenciaHasta),
        diasAplica: existing.diasAplica ?? '',
      })
    } else {
      setForm(empty)
    }
  }, [existing?.id])

  if (!session || !merchant) return <Navigate to="/admin/login" replace />
  if (isEdit && !existing) return <Navigate to="/admin/cupones" replace />

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    if (form.titulo.trim().length < 3) {
      toast.error('Falta el título', 'Escribí al menos 3 caracteres.')
      return
    }
    if (!form.descripcion.trim()) {
      toast.error('Falta la descripción', 'Contale al vecino qué incluye el descuento.')
      return
    }
    if (!form.vigenciaHasta) {
      toast.error('Falta la vigencia', 'Indicá hasta cuándo aplica.')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      const payload: Omit<Coupon, 'id'> = {
        merchantId: session.merchantId,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        condiciones: form.condiciones.trim(),
        porcentaje: form.porcentaje,
        vigenciaHasta: dateToIso(form.vigenciaHasta),
        imagenSeed: existing?.imagenSeed ?? 'custom',
        estado: existing?.estado ?? 'activo',
        diasAplica: form.diasAplica.trim() || undefined,
      }
      if (isEdit && id) {
        couponsActions.patch(id, payload)
        toast.success('Cupón actualizado')
      } else {
        couponsActions.create(payload)
        toast.success('Cupón creado', 'Ya está visible para los vecinos.')
      }
      navigate('/admin/cupones', { replace: true })
    }, 280)
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Título del descuento"
          hint={`${form.titulo.length}/${TITULO_MAX}`}
          input={
            <input
              type="text"
              value={form.titulo}
              maxLength={TITULO_MAX}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Ej: 20% OFF en pizzas martes y miércoles"
              className={inputCls}
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
        </div>

        <Field
          label="Descripción"
          hint={`${form.descripcion.length}/${DESCRIPCION_MAX}`}
          input={
            <textarea
              value={form.descripcion}
              maxLength={DESCRIPCION_MAX}
              rows={4}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="¿Qué incluye el descuento? ¿En qué productos aplica?"
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
              placeholder="Ej: Martes y miércoles · 20 a 23 hs"
              className={inputCls}
            />
          }
        />

        <Field
          label="Vigente hasta"
          input={
            <input
              type="date"
              value={form.vigenciaHasta}
              onChange={(e) => update('vigenciaHasta', e.target.value)}
              className={inputCls}
              required
            />
          }
        />

        <div
          className="fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-3xl bg-white p-3 shadow-floating ring-1 ring-neutral-100 sm:inset-x-auto sm:right-6 sm:left-auto sm:max-w-md md:bottom-6"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
          >
            <Save size={16} />
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear descuento'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Preview({
  merchant,
  form,
}: {
  merchant: ReturnType<typeof getMerchant>
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
}: {
  label: string
  input: React.ReactNode
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-neutral-400">{hint}</span>}
      </div>
      {input}
    </label>
  )
}
