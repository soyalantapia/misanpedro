import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Store,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Tag,
  Save,
  Pencil,
  X,
} from 'lucide-react'
import { useMerchantSession, merchantAuth } from '@/lib/merchantStore'
import { useMerchant, merchantsActions } from '@/lib/merchantsStore'
import { CardImage } from '@/components/CardImage'
import { CATEGORIAS, type Categoria } from '@/lib/types'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'

export function AdminComercioPage() {
  const { session } = useMerchantSession()
  const merchant = useMerchant(session?.merchantId)
  const user = merchantAuth.getCurrentUser()
  const allCoupons = useCouponsByMerchant(session?.merchantId ?? '')
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{
    nombre: string
    categoria: Categoria
    direccion: string
    telefono: string
    horarios: string
  } | null>(null)

  if (!merchant) return <Navigate to="/admin/login" replace />

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const cuponesActivos = allCoupons.filter((c) => c.estado === 'activo').length

  function startEdit() {
    if (!merchant) return
    setDraft({
      nombre: merchant.nombre,
      categoria: merchant.categoria,
      direccion: merchant.direccion,
      telefono: merchant.telefono,
      horarios: merchant.horarios,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditing(false)
  }

  function save() {
    if (!draft || !merchant) return
    if (draft.nombre.trim().length < 3) {
      toast.error('Nombre muy corto', 'Mínimo 3 caracteres.')
      return
    }
    merchantsActions.patch(merchant.id, {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      direccion: draft.direccion.trim(),
      telefono: draft.telefono.trim(),
      horarios: draft.horarios.trim(),
    })
    toast.success('Comercio actualizado', 'Los cambios ya se ven en la app del vecino.')
    setEditing(false)
    setDraft(null)
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
            <Store size={12} /> Mi comercio
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {merchant.nombre}
          </h1>
          <p className="text-sm text-neutral-500">
            Así te ven los vecinos en la app de Mi San Pedro.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-accent-700 shadow-card ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:bg-accent-50"
          >
            <Pencil size={13} /> Editar
          </button>
        )}
      </header>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
        <CardImage
          categoria={editing && draft ? draft.categoria : merchant.categoria}
          className="h-32"
          size="md"
        />
        {editing && draft ? (
          <div className="flex flex-col gap-3 p-5">
            <Field
              label="Nombre del comercio"
              input={
                <input
                  type="text"
                  value={draft.nombre}
                  onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                  className={inputCls}
                />
              }
            />
            <Field
              label="Categoría"
              input={
                <select
                  value={draft.categoria}
                  onChange={(e) => setDraft({ ...draft, categoria: e.target.value as Categoria })}
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
                  value={draft.direccion}
                  onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
                  className={inputCls}
                />
              }
            />
            <Field
              label="Teléfono"
              input={
                <input
                  type="tel"
                  value={draft.telefono}
                  onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
                  className={inputCls}
                />
              }
            />
            <Field
              label="Horarios"
              input={
                <input
                  type="text"
                  value={draft.horarios}
                  onChange={(e) => setDraft({ ...draft, horarios: e.target.value })}
                  placeholder="Ej: Lun a Sáb · 10 a 20 hs"
                  className={inputCls}
                />
              }
            />
            <p className="text-[11px] text-neutral-400">
              La portada se genera a partir de la categoría elegida. La opción de subir foto
              propia llega en una próxima iteración.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-5 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
              {cat}
            </p>
            <div className="flex items-start gap-2.5 text-neutral-700">
              <MapPin size={14} className="mt-0.5 shrink-0 text-neutral-400" />
              <span>{merchant.direccion}</span>
            </div>
            <div className="flex items-start gap-2.5 text-neutral-700">
              <Phone size={14} className="mt-0.5 shrink-0 text-neutral-400" />
              <span>{merchant.telefono}</span>
            </div>
            <div className="flex items-start gap-2.5 text-neutral-700">
              <Clock size={14} className="mt-0.5 shrink-0 text-neutral-400" />
              <span>{merchant.horarios}</span>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.nombre}, ${merchant.direccion}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-600"
            >
              Ver en Google Maps <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {!editing && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Cupones activos" value={cuponesActivos} icon={Tag} />
            <Stat label="Categoría" stringValue={cat} />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Tu cuenta
            </p>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <Row label="Nombre" value={user?.nombre ?? '—'} />
              <Row label="Email" value={user?.email ?? '—'} />
              <Row label="Rol" value={user?.rol ?? '—'} />
            </div>
          </div>

          <p className="text-center text-xs text-neutral-400">
            ¿Querés ver cómo te muestra la app del vecino?{' '}
            <Link to={`/comercio/${merchant.id}`} className="font-bold text-accent-700">
              Ver mi ficha pública
            </Link>
          </p>
        </>
      )}

      {editing && (
        <div
          className="fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-3xl bg-white p-3 shadow-floating ring-1 ring-neutral-100 sm:inset-x-auto sm:right-6 sm:left-auto sm:max-w-md md:bottom-6"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button
            type="button"
            onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Save size={16} /> Guardar cambios
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-100 px-6 py-3 text-sm font-bold text-neutral-700 hover:bg-primary-200"
          >
            <X size={14} /> Cancelar
          </button>
        </div>
      )}
    </div>
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

function Stat({
  label,
  value,
  stringValue,
  icon: Icon,
}: {
  label: string
  value?: number
  stringValue?: string
  icon?: typeof Tag
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-neutral-900">
        {Icon && <Icon size={16} className="text-accent-500" />}
        {stringValue ?? value ?? 0}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-100 py-1.5 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-bold text-neutral-900">{value}</span>
    </div>
  )
}
