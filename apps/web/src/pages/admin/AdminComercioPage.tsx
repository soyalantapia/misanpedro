import { lazy, Suspense, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  CreditCard,
  AlertTriangle,
  FileText,
  ShieldOff,
  Camera,
  Share2,
  Globe,
  MessageCircle,
  Sparkles,
  Eye,
  Plus,
} from 'lucide-react'
import { useMerchantSession, merchantAuth } from '@/lib/merchantStore'
import { useMerchant } from '@/lib/merchantsStore'
import { api, ApiError, subscription } from '@/lib/api'
import { useApiMerchantProfile } from '@/lib/apiQueries'
import { SUPPORT_EMAIL, useTenant } from '@/lib/tenant'
import { CardImage } from '@/components/CardImage'
import { MicrositePreview } from '@/components/MicrositePreview'
import {
  CATEGORIAS,
  DIAS_SEMANA,
  SERVICIOS,
  type Categoria,
  type DiaSemana,
  type HorarioDia,
  type HorariosSemana,
  type Servicio,
} from '@/lib/types'

/**
 * Si el merchant viene del API con `horariosDetalle: {}` (objeto vacío) o
 * sin algún día, completamos con defaults para que el editor no crashee.
 */
function ensureHorariosSemana(detalle: HorariosSemana | undefined | null): HorariosSemana {
  const def = defaultHorariosSemana()
  if (!detalle || typeof detalle !== 'object') return def
  const next: HorariosSemana = { ...def }
  for (const d of DIAS_SEMANA) {
    if (detalle[d.id]) next[d.id] = detalle[d.id]
  }
  return next
}
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useApiMyCoupons } from '@/lib/apiQueries'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { defaultHorariosSemana, formatHorariosSemana, formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

// Leaflet pesa ~150KB — lo bajamos como chunk aparte y sólo cuando el comercio
// abre el editor de perfil (mismo patrón que el signup).
const LocationPicker = lazy(() =>
  import('@/components/LocationPicker').then((m) => ({ default: m.LocationPicker })),
)

const SANPEDRO_CENTER = { lat: -33.6797, lng: -59.6669 }

const MAX_COVER_BYTES = 2 * 1024 * 1024
const MAX_GALLERY_PHOTOS = 4
const MAX_GALLERY_BYTES = 1.5 * 1024 * 1024

/** Vacío → null; sin esquema → antepone https:// para que pase la validación
 *  de URL del backend (safeHrefUrlSchema sólo acepta http/https/etc.). */
function normalizeOptionalUrl(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/**
 * TODO (BD01) — Migrar upload de cover/logo a presigned URLs.
 *
 * Hoy: cover (≤2MB) + logo (≤600KB) se mandan como data URL base64 en el body
 * del PATCH /merchants/me. Base64 inflate el payload ~33% → hasta ~3.4MB por
 * edición. Problemas observados:
 *   - Timeouts en conexiones móviles lentas (>5s en 3G).
 *   - Mongoose tiene que cargar y guardar el documento completo.
 *   - El cache del HTTP client puede romper si los caches limitan tamaño body.
 *
 * Plan recomendado cuando se conecte CDN/S3:
 *   1. Backend: nueva ruta POST /merchants/me/upload-url
 *      → devuelve { uploadUrl, publicUrl, expiresAt } firmada (15 min TTL).
 *   2. Frontend: tras leer el File, hacer fetch(uploadUrl, { method: 'PUT', body: file })
 *      → guarda solo `publicUrl` en draft.coverImageUrl / draft.logoUrl.
 *   3. PATCH /merchants/me sigue igual pero recibe solo URLs (no base64).
 *
 * Servicios candidatos: Cloudflare R2 (S3-compatible, sin egress fee), Bunny CDN,
 * o el propio bucket S3 si ya hay infra AWS.
 *
 * Hasta entonces el límite client-side (MAX_COVER_BYTES) actúa como mitigación.
 */

type Draft = {
  nombre: string
  categoria: Categoria
  direccion: string
  telefono: string
  lat: number | null
  lng: number | null
  coverImageUrl?: string
  logoUrl?: string
  mapsUrl: string
  horariosDetalle: HorariosSemana
  // ─── Micro-sitio (carta de presentación) ──────────────────────────────
  tagline: string
  descripcion: string
  servicios: Servicio[]
  galeria: string[]
  productos: { nombre: string; precio: string; descripcion: string }[]
  redes: { instagram: string; facebook: string; web: string; whatsapp: string }
}

export function AdminComercioPage() {
  const sessionState = useMerchantSession()
  const { session } = sessionState
  const localMerchant = useMerchant(session?.merchantId)
  const user = merchantAuth.getCurrentUser()
  const localAllCoupons = useCouponsByMerchant(session?.merchantId ?? '')
  const apiCoupones = useApiMyCoupons()
  const allCoupons: any[] = apiCoupones.data ?? localAllCoupons
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  // Si tenemos sesión API, traemos el merchant completo de /me/profile
  // (no filtra por estado, así que funciona aunque esté pending_payment).
  const apiRes = useApiMerchantProfile()
  const apiM = sessionState.apiMerchant ? apiRes.data ?? null : null

  // Construimos un merchant unificado con la data del API (si está)
  // o el local del store seed (modo demo offline).
  const merchant: any = apiM
    ? {
        id: apiM.slug,
        nombre: apiM.nombre,
        categoria: apiM.categoria,
        direccion: apiM.direccion,
        lat: apiM.lat,
        lng: apiM.lng,
        telefono: apiM.telefono,
        horarios: apiM.horarios,
        horariosDetalle: apiM.horariosDetalle,
        cover: apiM.cover,
        coverImageUrl: apiM.coverImageUrl,
        logoUrl: apiM.logoUrl,
        mapsUrl: apiM.mapsUrl,
        logoSeed: apiM.logoSeed,
        tagline: apiM.tagline,
        descripcion: apiM.descripcion,
        servicios: apiM.servicios,
        galeria: apiM.galeria,
        productos: apiM.productos,
        redes: apiM.redes,
        estado: apiM.estado,
        razonSocial: apiM.razonSocial,
        cuit: apiM.cuit,
        condicionFiscal: apiM.condicionFiscal,
        direccionFiscal: apiM.direccionFiscal,
        arrepentimientoExpiraEn: apiM.arrepentimientoExpiraEn,
      }
    : localMerchant

  // Esperamos al API antes de redirigir (evita flash de redirect mientras carga)
  if (!merchant && apiRes.loading) return null
  if (!merchant) return <Navigate to="/admin/login" replace />

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const cuponesActivos = allCoupons.filter((c) => c.estado === 'activo').length

  const horariosDisplay =
    formatHorariosSemana(merchant.horariosDetalle) || merchant.horarios
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
      lat: merchant.lat ?? null,
      lng: merchant.lng ?? null,
      coverImageUrl: merchant.coverImageUrl,
      logoUrl: merchant.logoUrl,
      mapsUrl: merchant.mapsUrl ?? '',
      horariosDetalle: ensureHorariosSemana(merchant.horariosDetalle),
      tagline: merchant.tagline ?? '',
      descripcion: merchant.descripcion ?? '',
      servicios: Array.isArray(merchant.servicios) ? merchant.servicios : [],
      galeria: Array.isArray(merchant.galeria) ? merchant.galeria : [],
      productos: (Array.isArray(merchant.productos) ? merchant.productos : []).map((p: any) => ({
        nombre: p.nombre ?? '',
        precio: p.precio ?? '',
        descripcion: p.descripcion ?? '',
      })),
      redes: {
        instagram: merchant.redes?.instagram ?? '',
        facebook: merchant.redes?.facebook ?? '',
        web: merchant.redes?.web ?? '',
        whatsapp: merchant.redes?.whatsapp ?? '',
      },
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
    setSaving(true)

    const apiPayload = {
      nombre: draft.nombre.trim(),
      categoria: draft.categoria,
      direccion: draft.direccion.trim(),
      telefono: draft.telefono.trim(),
      // Sólo mandamos coordenadas si el comercio marcó un punto. El backend
      // toca location únicamente cuando llegan ambas (ver PATCH /merchants/me).
      ...(draft.lat != null && draft.lng != null
        ? { lat: draft.lat, lng: draft.lng }
        : {}),
      horarios: formatHorariosSemana(draft.horariosDetalle),
      horariosDetalle: draft.horariosDetalle,
      coverImageUrl: draft.coverImageUrl ?? null,
      logoUrl: draft.logoUrl ?? null,
      mapsUrl: draft.mapsUrl.trim() || null,
      tagline: draft.tagline.trim() || null,
      descripcion: draft.descripcion.trim() || null,
      servicios: draft.servicios,
      galeria: draft.galeria,
      productos: draft.productos
        .map((p) => ({
          nombre: p.nombre.trim(),
          precio: p.precio.trim() || undefined,
          descripcion: p.descripcion.trim() || undefined,
        }))
        .filter((p) => p.nombre.length > 0),
      redes: {
        instagram: draft.redes.instagram.trim() || null,
        facebook: normalizeOptionalUrl(draft.redes.facebook),
        web: normalizeOptionalUrl(draft.redes.web),
        whatsapp: draft.redes.whatsapp.trim() || null,
      },
    }
    try {
      await api.merchantAdmin.updateMe(apiPayload)
      apiRes.refetch()
      toast.success('Comercio actualizado', 'Los cambios ya se ven en la app del vecino.')
      setEditing(false)
      setDraft(null)
    } catch (err) {
      toast.error(
        'No se pudo guardar',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-strong">
            <Store size={12} /> Mi comercio
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {merchant.nombre}
          </h1>
          <p className="text-sm text-ink-soft">
            Así te ven los vecinos en la app.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-xs font-bold text-brand-strong shadow-card ring-1 ring-line transition-all hover:-translate-y-0.5 hover:bg-brand-soft"
          >
            <Pencil size={13} /> Editar
          </button>
        )}
      </header>

      {editing && draft ? (
        <EditingView draft={draft} setDraft={setDraft} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              <Eye size={11} /> Así te ven los vecinos
            </p>
            <MicrositePreview
              data={{
                nombre: merchant.nombre,
                categoria: merchant.categoria,
                tagline: merchant.tagline,
                descripcion: merchant.descripcion,
                coverImageUrl: merchant.coverImageUrl,
                logoUrl: merchant.logoUrl,
                servicios: merchant.servicios,
                galeria: merchant.galeria,
                productos: merchant.productos,
                redes: merchant.redes,
                horariosDetalle: merchant.horariosDetalle,
              }}
            />
          </div>

          <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-strong">
                {cat}
              </p>
              <div className="flex items-start gap-2.5 text-ink">
                <MapPin size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                <span>{merchant.direccion}</span>
              </div>
              {merchant.telefono && (
                <div className="flex items-start gap-2.5 text-ink">
                  <Phone size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                  <a
                    href={`tel:${merchant.telefono.replace(/\s/g, '')}`}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    {merchant.telefono}
                  </a>
                </div>
              )}
              {horariosDisplay && (
                <div className="flex items-start gap-2.5 text-ink">
                  <Clock size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                  <span>{horariosDisplay}</span>
                </div>
              )}
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong hover:text-brand-strong"
              >
                Ver en Google Maps <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Descuentos activos" value={cuponesActivos} icon={Tag} />
            <Stat label="Categoría" stringValue={cat} />
          </div>

          <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              Tu cuenta
            </p>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <Row label="Nombre" value={user?.nombre ?? '—'} />
              <Row label="Email" value={user?.email ?? '—'} />
              <Row label="Rol" value={user?.rol ?? '—'} />
            </div>
          </div>

          {apiM && <FiscalCard merchant={merchant} />}
          {apiM && <SubscriptionCard merchant={merchant} onChanged={apiRes.refetch} />}

          <p className="text-center text-xs text-ink-faint">
            ¿Querés ver cómo te muestra la app del vecino?{' '}
            <Link to={`/comercio/${merchant.id}`} className="font-bold text-brand-strong">
              Ver mi ficha pública
            </Link>
          </p>
        </>
      )}

      {editing && createPortal(
        <div
          className="fixed inset-x-0 bottom-24 z-30 border-t border-line bg-bg shadow-floating md:bottom-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl items-stretch gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              disabled={saving}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-status-error-bg px-4 py-3.5 text-sm font-bold text-status-error-fg ring-1 ring-status-error/20 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-6 py-3.5 text-base font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={cancelConfirm}
        title="¿Descartar los cambios?"
        description="Los datos editados se perderán y no se podrán recuperar."
        confirmLabel="Sí, descartar"
        cancelLabel="Seguir editando"
        variant="danger"
        onCancel={() => setCancelConfirm(false)}
        onConfirm={() => {
          setCancelConfirm(false)
          cancelEdit()
        }}
      />
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
  const tenant = useTenant()
  const mapCenter = tenant.config?.geoCenter ?? SANPEDRO_CENTER
  const cityHint =
    [tenant.config?.ciudad, tenant.config?.provincia].filter(Boolean).join(', ') ||
    tenant.config?.ciudad ||
    'tu ciudad'

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <Eye size={11} /> Vista previa — así te ven los vecinos
        </p>
        <MicrositePreview
          data={{
            nombre: draft.nombre,
            categoria: draft.categoria,
            tagline: draft.tagline,
            descripcion: draft.descripcion,
            coverImageUrl: draft.coverImageUrl,
            logoUrl: draft.logoUrl,
            servicios: draft.servicios,
            galeria: draft.galeria,
            productos: draft.productos,
            redes: draft.redes,
            horariosDetalle: draft.horariosDetalle,
          }}
        />
      </div>

      <CoverEditor draft={draft} setDraft={setDraft} />
      <LogoEditor draft={draft} setDraft={setDraft} />
      <GaleriaEditor draft={draft} setDraft={setDraft} />
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <Field
          label="Nombre del comercio"
          input={
            <input
              id="comercio-nombre"
              name="nombre"
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
              id="comercio-categoria"
              name="categoria"
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
              id="comercio-direccion"
              name="direccion"
              type="text"
              value={draft.direccion}
              onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
              className={inputCls}
            />
          }
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            Ubicación en el mapa
          </span>
          <p className="text-[11px] text-ink-faint">
            Si tu comercio aparece mal ubicado para los vecinos, buscá la dirección o
            arrastrá el pin hasta la puerta exacta.
          </p>
          <Suspense
            fallback={
              <div className="h-[240px] animate-pulse rounded-2xl bg-surface-2 ring-1 ring-line" />
            }
          >
            <LocationPicker
              value={
                draft.lat != null && draft.lng != null
                  ? { lat: draft.lat, lng: draft.lng }
                  : null
              }
              onChange={(ll) => setDraft({ ...draft, lat: ll.lat, lng: ll.lng })}
              address={draft.direccion}
              center={mapCenter}
              cityHint={cityHint}
            />
          </Suspense>
        </div>
        <Field
          label="Teléfono"
          input={
            <input
              id="comercio-telefono"
              name="telefono"
              type="tel"
              value={draft.telefono}
              onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
              className={inputCls}
            />
          }
        />
        <MapsUrlField draft={draft} setDraft={setDraft} />
      </div>

      <PresentacionEditor draft={draft} setDraft={setDraft} />
      <ServiciosEditor draft={draft} setDraft={setDraft} />
      <ProductosEditor draft={draft} setDraft={setDraft} />
      <RedesEditor draft={draft} setDraft={setDraft} />

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
    <div className="overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line">
      <CardImage
        categoria={draft.categoria}
        coverImageUrl={draft.coverImageUrl}
        className="h-40"
        size="md"
      />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Portada
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-3 py-2.5 text-xs font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5"
          >
            <Upload size={13} /> Subir foto
          </button>
          {draft.coverImageUrl ? (
            <button
              type="button"
              onClick={clearCover}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-2.5 text-xs font-bold text-ink hover:bg-surface-2"
            >
              <Trash2 size={13} /> Quitar
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
              <ImageIcon size={10} /> Gradiente actual
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          id="comercio-cover-file"
          name="cover"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ''
          }}
        />
        <p className="text-[11px] text-ink-faint">
          JPG o PNG, máximo 2 MB. Si no subís, se usa el gradiente de tu categoría.
        </p>
      </div>
    </div>
  )
}

function LogoEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  function handleUpload(file: File) {
    if (file.size > 600_000) {
      toast.error('Logo muy pesado', 'El logo debe ser menor a 600 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setDraft({ ...draft, logoUrl: dataUrl })
      toast.success('Logo actualizado')
    }
    reader.onerror = () => {
      toast.error('No se pudo leer el archivo')
    }
    reader.readAsDataURL(file)
  }

  function clearLogo() {
    setDraft({ ...draft, logoUrl: undefined })
  }

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        Logo del comercio (opcional)
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
          {draft.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.logoUrl}
              alt="Logo"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon size={20} className="text-ink-faint" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-2 text-xs font-bold text-ink hover:bg-surface-2"
            >
              <Upload size={13} /> Subir logo
            </button>
            {draft.logoUrl && (
              <button
                type="button"
                onClick={clearLogo}
                className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-status-error-bg px-3 py-2 text-xs font-bold text-status-error-fg hover:bg-status-error-bg/80"
              >
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>
          <p className="text-[11px] text-ink-faint">PNG cuadrado, máx 600 KB.</p>
        </div>
      </div>
      <input
        ref={fileRef}
        id="comercio-logo-file"
        name="logo"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function GaleriaEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const fotos = draft.galeria
  const full = fotos.length >= MAX_GALLERY_PHOTOS

  function handleUpload(file: File) {
    if (full) return
    if (file.size > MAX_GALLERY_BYTES) {
      toast.error('Foto muy grande', 'El máximo por foto es 1,5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setDraft({
        ...draft,
        galeria: [...draft.galeria, reader.result as string].slice(0, MAX_GALLERY_PHOTOS),
      })
    }
    reader.onerror = () => toast.error('No se pudo leer la foto')
    reader.readAsDataURL(file)
  }

  function removeAt(i: number) {
    setDraft({ ...draft, galeria: draft.galeria.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <ImageIcon size={11} /> Galería de fotos
        </p>
        <span className="text-[11px] tabular-nums text-ink-faint">
          {fotos.length}/{MAX_GALLERY_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        Mostrá tu local y tus productos. Hasta {MAX_GALLERY_PHOTOS} fotos, 1,5 MB cada una.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {fotos.map((src, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-on-brand transition-colors hover:bg-status-error-fg"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-line text-ink-faint transition-colors hover:border-brand hover:text-brand"
          >
            <span className="flex flex-col items-center gap-1 text-[11px] font-bold">
              <Upload size={16} /> Agregar
            </span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        id="comercio-galeria-file"
        name="galeria"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
          e.target.value = ''
        }}
      />
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
            id="comercio-maps-url"
            name="mapsUrl"
            type="url"
            value={draft.mapsUrl}
            onChange={(e) => setDraft({ ...draft, mapsUrl: e.target.value })}
            placeholder="https://maps.app.goo.gl/…"
            className={inputCls}
          />
          <p className="text-[11px] text-ink-faint">
            En Google Maps tap{' '}
            <Copy size={10} className="inline" aria-hidden="true" /> Compartir → Copiar link y pegalo acá. Si lo
            dejás vacío, se busca por nombre + dirección.
          </p>
        </>
      }
    />
  )
}

function PresentacionEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <Sparkles size={11} /> Presentación
      </p>
      <Field
        label="Frase corta"
        input={
          <>
            <input
              id="comercio-tagline"
              name="tagline"
              type="text"
              value={draft.tagline}
              maxLength={90}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="Ej: Pizzería a la piedra desde 1998"
              className={inputCls}
            />
            <p className="text-right text-[11px] text-ink-faint">{draft.tagline.length}/90</p>
          </>
        }
      />
      <Field
        label="Sobre el comercio"
        input={
          <>
            <textarea
              id="comercio-descripcion"
              name="descripcion"
              value={draft.descripcion}
              maxLength={600}
              rows={4}
              onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
              placeholder="Contales a los vecinos quién sos, qué ofrecés y qué te hace diferente."
              className={cn(inputCls, 'resize-none')}
            />
            <p className="text-right text-[11px] text-ink-faint">
              {draft.descripcion.length}/600
            </p>
          </>
        }
      />
    </div>
  )
}

function ServiciosEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  function toggle(id: Servicio) {
    const has = draft.servicios.includes(id)
    setDraft({
      ...draft,
      servicios: has
        ? draft.servicios.filter((s) => s !== id)
        : [...draft.servicios, id],
    })
  }
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Servicios</p>
      <p className="mt-1 text-[11px] text-ink-faint">
        Tocá los que ofrezcas. Se muestran como etiquetas en tu ficha.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SERVICIOS.map(({ id, label }) => {
          const active = draft.servicios.includes(id)
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors',
                active
                  ? 'bg-brand text-on-brand ring-brand'
                  : 'bg-surface text-ink-soft ring-line hover:bg-bg',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProductosEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const items = draft.productos
  const full = items.length >= 20

  function add() {
    if (full) return
    setDraft({ ...draft, productos: [...items, { nombre: '', precio: '', descripcion: '' }] })
  }
  function update(i: number, field: 'nombre' | 'precio' | 'descripcion', value: string) {
    setDraft({
      ...draft,
      productos: items.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    })
  }
  function remove(i: number) {
    setDraft({ ...draft, productos: items.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <Tag size={11} /> Productos destacados
        </p>
        <span className="text-[11px] tabular-nums text-ink-faint">{items.length}/20</span>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        Mostrá algunos productos o platos con su precio. El nombre es obligatorio; el resto, opcional.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((p, i) => (
          <div key={i} className="rounded-2xl bg-bg p-3 ring-1 ring-line">
            <div className="flex items-center gap-2">
              <input
                id={`producto-nombre-${i}`}
                name={`producto-nombre-${i}`}
                type="text"
                value={p.nombre}
                onChange={(e) => update(i, 'nombre', e.target.value)}
                placeholder="Nombre (ej: Café con leche)"
                maxLength={60}
                className={cn(inputCls, 'flex-1')}
              />
              <input
                id={`producto-precio-${i}`}
                name={`producto-precio-${i}`}
                type="text"
                value={p.precio}
                onChange={(e) => update(i, 'precio', e.target.value)}
                placeholder="$ Precio"
                maxLength={24}
                className={cn(inputCls, 'w-28 shrink-0')}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Quitar ${p.nombre || 'producto'}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-status-error-bg text-status-error-fg transition-colors hover:bg-status-error-bg/80"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <input
              id={`producto-descripcion-${i}`}
              name={`producto-descripcion-${i}`}
              type="text"
              value={p.descripcion}
              onChange={(e) => update(i, 'descripcion', e.target.value)}
              placeholder="Descripción corta (opcional)"
              maxLength={140}
              className={cn(inputCls, 'mt-2')}
            />
          </div>
        ))}
      </div>
      {!full && (
        <button
          type="button"
          onClick={add}
          className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-surface-2"
        >
          <Plus size={14} /> Agregar producto
        </button>
      )}
    </div>
  )
}

function RedesEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  function setRed(key: keyof Draft['redes'], value: string) {
    setDraft({ ...draft, redes: { ...draft.redes, [key]: value } })
  }
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        Redes y contacto
      </p>
      <RedInput
        icon={Camera}
        name="redes-instagram"
        label="Instagram"
        value={draft.redes.instagram}
        onChange={(v) => setRed('instagram', v)}
        placeholder="@tucomercio"
      />
      <RedInput
        icon={MessageCircle}
        name="redes-whatsapp"
        label="WhatsApp"
        value={draft.redes.whatsapp}
        onChange={(v) => setRed('whatsapp', v)}
        placeholder="(03329) 425678"
      />
      <RedInput
        icon={Share2}
        name="redes-facebook"
        label="Facebook"
        value={draft.redes.facebook}
        onChange={(v) => setRed('facebook', v)}
        placeholder="facebook.com/tucomercio"
      />
      <RedInput
        icon={Globe}
        name="redes-web"
        label="Sitio web"
        value={draft.redes.web}
        onChange={(v) => setRed('web', v)}
        placeholder="www.tucomercio.com"
      />
    </div>
  )
}

function RedInput({
  icon: Icon,
  name,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: typeof Camera
  name: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <Icon size={12} /> {label}
      </span>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
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
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Horarios por día
        </p>
        <button
          type="button"
          onClick={applyToAll}
          className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-[10px] font-bold text-ink hover:bg-brand-soft hover:text-brand-strong"
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
                horario.abierto ? 'border-line bg-brand-soft/40' : 'border-line bg-bg',
              )}
            >
              <span className="grid h-9 w-12 shrink-0 place-items-center rounded-xl bg-surface text-xs font-bold text-ink ring-1 ring-line">
                {d.corto}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDay(
                    d.id,
                    horario.abierto
                      ? { abierto: false }
                      : { abierto: true, desde: '09:00', hasta: '18:00' },
                  )
                }
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  horario.abierto
                    ? 'bg-status-success-bg text-status-success-fg'
                    : 'bg-surface-2 text-ink-soft',
                )}
              >
                {horario.abierto ? 'Abierto' : 'Cerrado'}
              </button>
              {horario.abierto ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    id={`horario-${d.id}-desde`}
                    name={`horario-${d.id}-desde`}
                    type="time"
                    value={horario.desde}
                    aria-label={`${d.label} apertura`}
                    onChange={(e) =>
                      setDay(d.id, { ...horario, desde: e.target.value })
                    }
                    className="flex-1 rounded-xl bg-surface px-2 py-1.5 text-xs ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <span className="text-xs text-ink-faint">a</span>
                  <input
                    id={`horario-${d.id}-hasta`}
                    name={`horario-${d.id}-hasta`}
                    type="time"
                    value={horario.hasta}
                    aria-label={`${d.label} cierre`}
                    onChange={(e) =>
                      setDay(d.id, { ...horario, hasta: e.target.value })
                    }
                    className="flex-1 rounded-xl bg-surface px-2 py-1.5 text-xs ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs text-ink-faint">Sin atención este día</span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Vista previa para el vecino:{' '}
        <span className="font-medium text-ink">
          {formatHorariosSemana(draft.horariosDetalle)}
        </span>
      </p>
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl bg-surface px-4 py-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand'

function Field({ label, input }: { label: string; input: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
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
    <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-ink">
        {Icon && <Icon size={16} className="text-brand" />}
        {stringValue ?? value ?? 0}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5 last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  )
}

function condicionFiscalLabel(c?: string | null) {
  if (c === 'monotributo') return 'Monotributo'
  if (c === 'responsable_inscripto') return 'Responsable Inscripto'
  if (c === 'consumidor_final') return 'Consumidor Final'
  return '—'
}

function FiscalCard({ merchant }: { merchant: any }) {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi San Pedro'
  const tieneFiscal = merchant.cuit || merchant.razonSocial || merchant.condicionFiscal
  if (!tieneFiscal) return null
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <FileText size={11} /> Datos fiscales
      </p>
      <div className="mt-2 flex flex-col gap-1 text-sm">
        <Row label="Razón social" value={merchant.razonSocial ?? '—'} />
        <Row label="CUIT" value={merchant.cuit ?? '—'} />
        <Row
          label="Condición"
          value={condicionFiscalLabel(merchant.condicionFiscal)}
        />
        {merchant.direccionFiscal && (
          <Row label="Domicilio fiscal" value={merchant.direccionFiscal} />
        )}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Estos datos se usan para emitir tu factura mensual. Si necesitás corregirlos, escribinos a{' '}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${appName}] Corrección de datos fiscales`)}`} className="font-bold text-brand-strong">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  )
}

function SubscriptionCard({
  merchant,
  onChanged,
}: {
  merchant: any
  onChanged: () => void
}) {
  const tenant = useTenant()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState(false)
  const toast = useToast()

  const estado: string = merchant.estado ?? 'activo'
  const arrepentimientoExpiraEn = merchant.arrepentimientoExpiraEn
    ? new Date(merchant.arrepentimientoExpiraEn)
    : null
  const dentroArrepentimiento =
    arrepentimientoExpiraEn !== null && arrepentimientoExpiraEn.getTime() > Date.now()

  // E2 (audit v9): permitir iniciar/retomar el pago desde Mi Comercio cuando el
  // comercio está pending_payment. Antes solo se podía pagar en el signup; si
  // abandonabas ese paso, quedabas sin forma de activarte desde el panel.
  async function handlePay() {
    setPaying(true)
    try {
      const res = await api.billing.createPreapproval()
      if (res.ok && res.subscription?.initPoint) {
        window.location.href = res.subscription.initPoint
        return
      }
      toast.error('No se pudo iniciar el pago', 'Reintentá en un momento.')
    } catch (err) {
      toast.error(
        'No se pudo iniciar el pago',
        err instanceof ApiError ? err.message : 'Revisá tu conexión y reintentá.',
      )
    } finally {
      setPaying(false)
    }
  }

  async function handleCancel() {
    setSubmitting(true)
    try {
      const res = await subscription.cancel()
      toast.success(
        res.arrepentimiento ? '¡Listo! Te reembolsamos' : 'Suscripción cancelada',
        res.mensaje,
      )
      setConfirming(false)
      onChanged()
    } catch (err) {
      toast.error(
        'No se pudo cancelar',
        err instanceof ApiError ? err.message : 'Error inesperado',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <CreditCard size={11} /> Plan y suscripción
      </p>

      <div className="mt-2 flex flex-col gap-1 text-sm">
        <Row label="Plan" value={`Estándar · ${formatMoney(tenant.config?.precioMensual ?? 50000)} / mes`} />
        <Row
          label="Estado"
          value={
            estado === 'activo'
              ? 'Activa'
              : estado === 'pending_payment'
              ? 'Esperando primer pago'
              : estado === 'cancelado'
              ? 'Cancelada'
              : estado === 'suspendido'
              ? 'Suspendida'
              : estado
          }
        />
        {dentroArrepentimiento && arrepentimientoExpiraEn && (
          <Row
            label="Reembolso disponible hasta"
            value={arrepentimientoExpiraEn.toLocaleDateString('es-AR')}
          />
        )}
      </div>

      {dentroArrepentimiento && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-status-success-bg p-3 text-xs text-status-success-fg">
          <ShieldOff size={14} className="mt-0.5 shrink-0" />
          <span>
            Estás dentro de los 10 días de arrepentimiento (Ley 24.240). Si cancelás ahora te
            devolvemos el 100% del primer pago.
          </span>
        </div>
      )}

      {estado === 'pending_payment' && !confirming && (
        <button
          type="button"
          onClick={handlePay}
          disabled={paying}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-brand to-brand-strong px-4 py-3 text-sm font-bold text-on-brand shadow-cta transition-all hover:-translate-y-0.5 disabled:opacity-60"
        >
          <CreditCard size={14} />
          {paying ? 'Redirigiendo a MercadoPago…' : 'Pagar suscripción'}
        </button>
      )}

      {estado === 'activo' ? (
        confirming ? (
          <div className="mt-4 rounded-2xl border border-status-error/20 bg-status-error-bg/50 p-3">
            <div className="flex items-start gap-2 text-xs text-status-error-fg">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {dentroArrepentimiento
                  ? '¿Cancelar y pedir reembolso completo? Tus descuentos dejan de aparecer al instante.'
                  : 'Tu plan termina al final del período pagado. Tus descuentos dejan de aparecer al cierre.'}
              </p>
            </div>
            <div className="mt-3 flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 rounded-xl bg-surface px-3 py-2 text-xs font-bold text-ink ring-1 ring-line hover:bg-surface-2 disabled:opacity-60"
              >
                No cancelar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 rounded-xl bg-status-error-fg px-3 py-2 text-xs font-bold text-on-brand hover:bg-danger disabled:opacity-60"
              >
                {submitting ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink hover:bg-status-error-bg hover:text-status-error-fg"
          >
            Cancelar suscripción
          </button>
        )
      ) : null}
    </div>
  )
}
