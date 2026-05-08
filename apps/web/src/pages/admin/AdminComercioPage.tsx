import { useRef, useState } from 'react'
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
  Upload,
  Trash2,
  Image as ImageIcon,
  Copy,
} from 'lucide-react'
import { useMerchantSession, merchantAuth } from '@/lib/merchantStore'
import { useMerchant, merchantsActions } from '@/lib/merchantsStore'
import { api, ApiError } from '@/lib/api'
import { CardImage } from '@/components/CardImage'
import {
  CATEGORIAS,
  DIAS_SEMANA,
  type Categoria,
  type DiaSemana,
  type HorarioDia,
  type HorariosSemana,
} from '@/lib/types'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useToast } from '@/components/Toast'
import { defaultHorariosSemana, formatHorariosSemana } from '@/lib/format'
import { cn } from '@/lib/cn'

const MAX_COVER_BYTES = 2 * 1024 * 1024

type Draft = {
  nombre: string
  categoria: Categoria
  direccion: string
  telefono: string
  coverImageUrl?: string
  mapsUrl: string
  horariosDetalle: HorariosSemana
}

export function AdminComercioPage() {
  const { session } = useMerchantSession()
  const merchant = useMerchant(session?.merchantId)
  const user = merchantAuth.getCurrentUser()
  const allCoupons = useCouponsByMerchant(session?.merchantId ?? '')
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  if (!merchant) return <Navigate to="/admin/login" replace />

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const cuponesActivos = allCoupons.filter((c) => c.estado === 'activo').length

  const horariosDisplay = merchant.horariosDetalle
    ? formatHorariosSemana(merchant.horariosDetalle)
    : merchant.horarios
  const mapsHref =
    merchant.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.nombre}, ${merchant.direccion}`)}`

  function startEdit() {
    if (!merchant) return
    setDraft({
      nombre: merchant.nombre,
      categoria: merchant.categoria,
      direccion: merchant.direccion,
      telefono: merchant.telefono,
      coverImageUrl: merchant.coverImageUrl,
      mapsUrl: merchant.mapsUrl ?? '',
      horariosDetalle: merchant.horariosDetalle ?? defaultHorariosSemana(),
    })
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditing(false)
  }

  async function save() {
    if (!draft || !merchant) return
    if (draft.nombre.trim().length < 3) {
      toast.error('Nombre muy corto', 'Mínimo 3 caracteres.')
      return
    }

    const apiPayload = {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      direccion: draft.direccion.trim(),
      telefono: draft.telefono.trim(),
      horarios: formatHorariosSemana(draft.horariosDetalle),
      horariosDetalle: draft.horariosDetalle,
      coverImageUrl: draft.coverImageUrl ?? null,
      mapsUrl: draft.mapsUrl.trim() || null,
    }
    try {
      await api.merchantAdmin.updateMe(apiPayload)
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        toast.error('No se pudo guardar', err.message)
        return
      }
      // 5xx o sin red → fallback local
    }

    merchantsActions.patch(merchant.id, {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      direccion: draft.direccion.trim(),
      telefono: draft.telefono.trim(),
      horariosDetalle: draft.horariosDetalle,
      horarios: formatHorariosSemana(draft.horariosDetalle),
      coverImageUrl: draft.coverImageUrl,
      mapsUrl: draft.mapsUrl.trim() || undefined,
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

      {editing && draft ? (
        <EditingView draft={draft} setDraft={setDraft} />
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
            <CardImage
              categoria={merchant.categoria}
              coverImageUrl={merchant.coverImageUrl}
              className="h-32"
              size="md"
            />
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
                <span>{horariosDisplay}</span>
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-600"
              >
                Ver en Google Maps <ExternalLink size={12} />
              </a>
            </div>
          </div>

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
          className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white shadow-floating"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl items-stretch gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={cancelEdit}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-status-error-bg px-4 py-3.5 text-sm font-bold text-status-error-fg ring-1 ring-status-error/20 transition-all hover:-translate-y-0.5"
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
            >
              <Save size={16} /> Guardar cambios
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditingView({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
}) {
  return (
    <>
      <CoverEditor draft={draft} setDraft={setDraft} />
      <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
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
              onChange={(e) =>
                setDraft({ ...draft, categoria: e.target.value as Categoria })
              }
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
        <MapsUrlField draft={draft} setDraft={setDraft} />
      </div>

      <HorariosEditor draft={draft} setDraft={setDraft} />
    </>
  )
}

function CoverEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  function handleUpload(file: File) {
    if (file.size > MAX_COVER_BYTES) {
      toast.error('Imagen muy grande', 'El máximo es 2 MB. Probá con una más liviana.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setDraft({ ...draft, coverImageUrl: dataUrl })
      toast.success('Portada actualizada')
    }
    reader.onerror = () => {
      toast.error('No se pudo leer el archivo')
    }
    reader.readAsDataURL(file)
  }

  function clearCover() {
    setDraft({ ...draft, coverImageUrl: undefined })
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
      <CardImage
        categoria={draft.categoria}
        coverImageUrl={draft.coverImageUrl}
        className="h-40"
        size="md"
      />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Portada
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-3 py-2.5 text-xs font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Upload size={13} /> Subir foto
          </button>
          {draft.coverImageUrl ? (
            <button
              type="button"
              onClick={clearCover}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-primary-100 px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-primary-200"
            >
              <Trash2 size={13} /> Quitar
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <ImageIcon size={10} /> Gradiente actual
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ''
          }}
        />
        <p className="text-[11px] text-neutral-400">
          JPG o PNG, máximo 2 MB. Si no subís, se usa el gradiente de tu categoría.
        </p>
      </div>
    </div>
  )
}

function MapsUrlField({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <Field
      label="Link de Google Maps (opcional)"
      input={
        <>
          <input
            type="url"
            value={draft.mapsUrl}
            onChange={(e) => setDraft({ ...draft, mapsUrl: e.target.value })}
            placeholder="https://maps.app.goo.gl/…"
            className={inputCls}
          />
          <p className="text-[11px] text-neutral-400">
            En Google Maps tap{' '}
            <Copy size={10} className="inline" /> Compartir → Copiar link y pegalo acá. Si lo
            dejás vacío, se busca por nombre + dirección.
          </p>
        </>
      }
    />
  )
}

function HorariosEditor({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
}) {
  const toast = useToast()

  function setDay(dia: DiaSemana, horario: HorarioDia) {
    setDraft({
      ...draft,
      horariosDetalle: { ...draft.horariosDetalle, [dia]: horario },
    })
  }

  function applyToAll() {
    const lun = draft.horariosDetalle.lun
    const next = { ...draft.horariosDetalle }
    DIAS_SEMANA.forEach((d) => {
      next[d.id] = lun
    })
    setDraft({ ...draft, horariosDetalle: next })
    toast.info('Horario de lunes copiado a todos los días')
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Horarios por día
        </p>
        <button
          type="button"
          onClick={applyToAll}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold text-neutral-700 hover:bg-accent-50 hover:text-accent-700"
        >
          <Copy size={10} /> Copiar Lun a todos
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {DIAS_SEMANA.map((d) => {
          const horario = draft.horariosDetalle[d.id]
          return (
            <div
              key={d.id}
              className={cn(
                'flex items-center gap-2 rounded-2xl border p-2.5 transition-colors',
                horario.abierto ? 'border-accent-200 bg-accent-50/40' : 'border-neutral-200 bg-primary-50',
              )}
            >
              <span className="grid h-9 w-12 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-neutral-700 ring-1 ring-neutral-200">
                {d.corto}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDay(
                    d.id,
                    horario.abierto
                      ? { abierto: false }
                      : { abierto: true, desde: '09:00', hasta: '20:00' },
                  )
                }
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  horario.abierto
                    ? 'bg-status-success-bg text-status-success-fg'
                    : 'bg-neutral-200 text-neutral-500',
                )}
              >
                {horario.abierto ? 'Abierto' : 'Cerrado'}
              </button>
              {horario.abierto ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    type="time"
                    value={horario.desde}
                    onChange={(e) =>
                      setDay(d.id, { ...horario, desde: e.target.value })
                    }
                    className="flex-1 rounded-xl bg-white px-2 py-1.5 text-xs ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                  <span className="text-xs text-neutral-400">a</span>
                  <input
                    type="time"
                    value={horario.hasta}
                    onChange={(e) =>
                      setDay(d.id, { ...horario, hasta: e.target.value })
                    }
                    className="flex-1 rounded-xl bg-white px-2 py-1.5 text-xs ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs text-neutral-400">Sin atención este día</span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-neutral-400">
        Vista previa para el vecino:{' '}
        <span className="font-medium text-neutral-700">
          {formatHorariosSemana(draft.horariosDetalle)}
        </span>
      </p>
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
