import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Receipt,
  Store,
  Ticket,
  Users,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import { owner } from '@/lib/api'
import { PAISES, PAIS_DEFAULT, findPaisByNombre } from '@/lib/paises'
import { fmtDate, fmtNumber } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { DnsSetupCard } from '@/components/DnsSetupCard'

type Draft = {
  nombre: string
  ciudad: string
  provincia: string
  pais: string
  moneda: string
  locale: string
  phonePrefix: string
  precioMensual: string
  status: 'pending' | 'active' | 'suspended' | 'archived'
  customDomain: string
  primaryColor: string
  accentColor: string
  heroEyebrow: string
  heroHeadline: string
  logoUrl: string
  // Datos legales/fiscales del responsable de la ciudad (Términos/Privacidad).
  razonSocial: string
  taxId: string
  taxIdLabel: string
  condicionFiscal: string
  domicilio: string
  jurisdiccion: string
  // Centro del mapa de la ciudad (lat/lng) — el alta de comercio usa esto.
  geoLat: string
  geoLng: string
}

function draftFromApp(app: any): Draft {
  return {
    nombre: app.nombre ?? '',
    ciudad: app.ciudad ?? '',
    provincia: app.provincia ?? '',
    pais: app.pais ?? PAIS_DEFAULT.nombre,
    moneda: app.moneda ?? PAIS_DEFAULT.moneda,
    locale: app.locale ?? PAIS_DEFAULT.locale,
    phonePrefix: app.phonePrefix ?? findPaisByNombre(app.pais)?.prefijo ?? '',
    precioMensual: app.precioMensual != null ? String(app.precioMensual) : '',
    status: app.status ?? 'pending',
    customDomain: app.customDomain ?? '',
    primaryColor: app.brand?.primaryColor ?? '#ea580c',
    accentColor: app.brand?.accentColor ?? '#c2410c',
    heroEyebrow: app.brand?.heroEyebrow ?? '',
    heroHeadline: app.brand?.heroHeadline ?? '',
    logoUrl: app.brand?.logoUrl ?? '',
    razonSocial: app.legal?.razonSocial ?? '',
    taxId: app.legal?.taxId ?? '',
    taxIdLabel: app.legal?.taxIdLabel ?? '',
    condicionFiscal: app.legal?.condicionFiscal ?? '',
    domicilio: app.legal?.domicilio ?? '',
    jurisdiccion: app.legal?.jurisdiccion ?? '',
    geoLat: app.geoCenter?.lat != null ? String(app.geoCenter.lat) : '',
    geoLng: app.geoCenter?.lng != null ? String(app.geoCenter.lng) : '',
  }
}

export function AppDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [app, setApp] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // OW4 (audit v7): edición de datos + branding desde el detalle (el wizard
  // promete poder ajustarlo después; antes esta pantalla era read-only).
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function load() {
    try {
      const [appRes, metricsRes] = await Promise.all([
        owner.getApp(id),
        owner.appMetrics(id),
      ])
      setApp(appRes.app)
      setMetrics(metricsRes.metrics)
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos cargar la app')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function startEditing() {
    if (!app) return
    setDraft(draftFromApp(app))
    setSaveError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft(null)
    setSaveError(null)
  }

  async function handleSave() {
    if (!draft) return
    if (!/^[A-Z]{3}$/.test(draft.moneda)) {
      setSaveError('Moneda inválida (ISO-4217, ej. ARS, COP)')
      return
    }
    if (!/^[a-z]{2,3}(-[A-Z]{2,4})?$/.test(draft.locale)) {
      setSaveError('Idioma/locale inválido (ej. es-AR, es-CO)')
      return
    }
    setSaving(true)
    setSaveError(null)
    // logoUrl vacío → no lo mandamos (el backend valida que sea URL válida).
    const patch = {
      nombre: draft.nombre,
      ciudad: draft.ciudad,
      provincia: draft.provincia || undefined,
      pais: draft.pais || undefined,
      moneda: draft.moneda || undefined,
      locale: draft.locale || undefined,
      phonePrefix: draft.phonePrefix || undefined,
      precioMensual: draft.precioMensual ? Number(draft.precioMensual) : undefined,
      status: draft.status,
      customDomain: draft.customDomain || undefined,
      brand: {
        primaryColor: draft.primaryColor,
        accentColor: draft.accentColor,
        heroEyebrow: draft.heroEyebrow || undefined,
        heroHeadline: draft.heroHeadline || undefined,
        logoUrl: draft.logoUrl || undefined,
      },
      // Datos legales/fiscales: mandamos el objeto completo (el backend reemplaza
      // el subdoc). Campos vacíos → undefined → la página legal los omite.
      legal: {
        razonSocial: draft.razonSocial || undefined,
        taxId: draft.taxId || undefined,
        taxIdLabel: draft.taxIdLabel || undefined,
        condicionFiscal: draft.condicionFiscal || undefined,
        domicilio: draft.domicilio || undefined,
        jurisdiccion: draft.jurisdiccion || undefined,
      },
      geoCenter:
        draft.geoLat.trim() && draft.geoLng.trim()
          ? { lat: Number(draft.geoLat), lng: Number(draft.geoLng) }
          : undefined,
    }
    try {
      const res = await owner.updateApp(id, patch)
      if (res.ok && res.app) {
        setApp(res.app)
        setEditing(false)
        setDraft(null)
      } else {
        setSaveError('No pudimos guardar los cambios')
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Error guardando los cambios')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="rounded-2xl bg-danger-bg px-4 py-6 text-sm font-semibold text-danger">
        {error ?? 'App no encontrada'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Slug: ${app.slug}`}
        title={app.nombre}
        subtitle={`${app.ciudad} · ${app.provincia ?? 'Argentina'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/apps"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              <ArrowLeft size={12} /> Volver
            </Link>
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                <Pencil size={12} /> Editar
              </button>
            )}
            <a
              href={`https://${app.subdomain}.micuidad.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
            >
              Abrir <ExternalLink size={10} />
            </a>
          </div>
        }
      />

      <section className="flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-neutral-200">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${app.brand?.primaryColor ?? '#ea580c'}, ${app.brand?.accentColor ?? '#c2410c'})`,
          }}
        >
          {app.ciudad?.[0]?.toUpperCase() ?? 'M'}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={app.status} />
            <span className="text-xs text-neutral-500">Plan {app.plan}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            <strong>{app.subdomain}.micuidad.com</strong>
            {app.customDomain && ` · custom: ${app.customDomain}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span>
              {paisBandera(app.pais)} {app.pais ?? PAIS_DEFAULT.nombre}
            </span>
            <span className="text-neutral-300">·</span>
            <span>Moneda {app.moneda ?? PAIS_DEFAULT.moneda}</span>
            <span className="text-neutral-300">·</span>
            <span>Idioma {app.locale ?? PAIS_DEFAULT.locale}</span>
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">Creada {fmtDate(app.createdAt)}</p>
        </div>
      </section>

      {/* OW4: editor de datos + branding */}
      {editing && draft && (
        <section className="space-y-5 rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Editar app</h2>
            <button
              type="button"
              onClick={cancelEditing}
              className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Cancelar edición"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nombre comercial" value={draft.nombre} onChange={(v) => setDraft({ ...draft, nombre: v })} />
            <SelectField
              label="Estado"
              value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v as Draft['status'] })}
              options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'active', label: 'Activa' },
                { value: 'suspended', label: 'Suspendida' },
                { value: 'archived', label: 'Archivada' },
              ]}
            />
            <TextField label="Ciudad" value={draft.ciudad} onChange={(v) => setDraft({ ...draft, ciudad: v })} />
            <TextField label="Provincia" value={draft.provincia} onChange={(v) => setDraft({ ...draft, provincia: v })} />
            <TextField
              label="Dominio propio (opcional)"
              value={draft.customDomain}
              onChange={(v) => setDraft({ ...draft, customDomain: v })}
              placeholder="ramallodescuentos.com.ar"
            />
            <TextField
              label="Logo URL (opcional)"
              value={draft.logoUrl}
              onChange={(v) => setDraft({ ...draft, logoUrl: v })}
              placeholder="https://…/logo.png"
            />
          </div>

          {/* País / moneda / locale: contrato multi-país. El país auto-completa
              moneda y locale, pero ambos quedan editables. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="País"
              value={draft.pais}
              onChange={(v) => {
                const p = findPaisByNombre(v)
                setDraft({
                  ...draft,
                  pais: v,
                  moneda: p ? p.moneda : draft.moneda,
                  locale: p ? p.locale : draft.locale,
                  phonePrefix: p ? p.prefijo : draft.phonePrefix,
                })
              }}
              options={PAISES.map((p) => ({
                value: p.nombre,
                label: `${p.bandera ? `${p.bandera} ` : ''}${p.nombre}`,
              }))}
            />
            <TextField
              label="Moneda (ISO-4217)"
              value={draft.moneda}
              onChange={(v) => setDraft({ ...draft, moneda: v.toUpperCase() })}
              placeholder="ARS"
            />
            <TextField
              label="Idioma / locale (BCP-47)"
              value={draft.locale}
              onChange={(v) => setDraft({ ...draft, locale: v })}
              placeholder="es-AR"
            />
            <TextField
              label="Prefijo telefónico"
              value={draft.phonePrefix}
              onChange={(v) => setDraft({ ...draft, phonePrefix: v })}
              placeholder="+54"
            />
          </div>

          <TextField
            label={`Precio mensual del comercio (${draft.moneda || 'moneda'})`}
            value={draft.precioMensual}
            onChange={(v) => setDraft({ ...draft, precioMensual: v.replace(/[^0-9]/g, '') })}
            placeholder="50000"
          />

          {/* Centro del mapa de la ciudad — el alta de comercio centra el mapa acá
              (si no, cae en San Pedro). Buscá la ciudad en Google Maps y copiá lat/lng. */}
          <div>
            <div className="mb-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Centro del mapa de la ciudad
              </span>
              <p className="mt-0.5 text-xs text-neutral-500">
                Latitud y longitud del centro (ej. Pasto, Nariño: 1.2136 / -77.2811). El mapa del
                alta de comercio se centra acá.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Latitud"
                value={draft.geoLat}
                onChange={(v) => setDraft({ ...draft, geoLat: v.replace(/[^0-9.\-]/g, '') })}
                placeholder="1.2136"
              />
              <TextField
                label="Longitud"
                value={draft.geoLng}
                onChange={(v) => setDraft({ ...draft, geoLng: v.replace(/[^0-9.\-]/g, '') })}
                placeholder="-77.2811"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Color primario" value={draft.primaryColor} onChange={(v) => setDraft({ ...draft, primaryColor: v })} />
            <ColorField label="Color accent" value={draft.accentColor} onChange={(v) => setDraft({ ...draft, accentColor: v })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Hero eyebrow (opcional)"
              value={draft.heroEyebrow}
              onChange={(v) => setDraft({ ...draft, heroEyebrow: v })}
              placeholder="Para comercios de San Pedro"
            />
            <TextField
              label="Hero headline (opcional)"
              value={draft.heroHeadline}
              onChange={(v) => setDraft({ ...draft, heroHeadline: v })}
              placeholder="Override del título del Hero"
            />
          </div>

          {/* Datos legales/fiscales — alimentan las páginas de Términos y
              Privacidad (tenant-aware, por país). Lo que dejes vacío, la página
              lo omite (no muestra placeholders). El marco legal (ley de datos,
              defensa del consumidor) se deriva del País de arriba. */}
          <div className="space-y-4 border-t border-neutral-100 pt-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Datos legales / fiscales</h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Aparecen en Términos y Privacidad de esta ciudad. Las leyes citadas se ajustan
                automáticamente al país seleccionado arriba.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Razón social / responsable"
                value={draft.razonSocial}
                onChange={(v) => setDraft({ ...draft, razonSocial: v })}
                placeholder="Nombre del responsable o la empresa"
              />
              <TextField
                label="ID fiscal (CUIT / NIT)"
                value={draft.taxId}
                onChange={(v) => setDraft({ ...draft, taxId: v })}
                placeholder="20-12345678-9"
              />
              <TextField
                label="Etiqueta del ID fiscal (opcional)"
                value={draft.taxIdLabel}
                onChange={(v) => setDraft({ ...draft, taxIdLabel: v })}
                placeholder="CUIT / NIT — si vacío se deriva del país"
              />
              <TextField
                label="Condición fiscal (opcional)"
                value={draft.condicionFiscal}
                onChange={(v) => setDraft({ ...draft, condicionFiscal: v })}
                placeholder="Monotributista (Régimen Simplificado AFIP)"
              />
            </div>
            <TextField
              label="Domicilio legal / fiscal"
              value={draft.domicilio}
              onChange={(v) => setDraft({ ...draft, domicilio: v })}
              placeholder="Calle 123, Ciudad, Provincia"
            />
            <TextField
              label="Jurisdicción (opcional)"
              value={draft.jurisdiccion}
              onChange={(v) => setDraft({ ...draft, jurisdiccion: v })}
              placeholder="Tribunales Ordinarios de San Pedro, Buenos Aires"
            />
          </div>

          {saveError && (
            <div className="rounded-xl bg-danger-bg px-3 py-2 text-xs font-semibold text-danger">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-full px-4 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft.nombre.trim() || !draft.ciudad.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-2 text-xs font-bold text-white shadow shadow-accent-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </section>
      )}

      {metrics && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Store}
            label="Comercios"
            value={fmtNumber(metrics.merchants.total)}
            hint={`${metrics.merchants.active} activos`}
          />
          <StatCard
            icon={Users}
            label="Vecinos"
            value={fmtNumber(metrics.users.total)}
            accent="success"
          />
          <StatCard
            icon={Ticket}
            label="Cupones"
            value={fmtNumber(metrics.coupons.total)}
            hint={`${metrics.coupons.active} activos`}
          />
          <StatCard
            icon={Receipt}
            label="Canjes 30d"
            value={fmtNumber(metrics.redemptions.last30Days)}
            hint={`${metrics.redemptions.last7Days} en 7d`}
            accent="accent"
          />
        </section>
      )}

      <DnsSetupCard
        subdomain={app.subdomain}
        customDomain={app.customDomain}
        status={app.status}
      />

      <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
        <h2 className="text-sm font-bold text-neutral-900">Drill-down</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Ver datos cross-app filtrados a esta ciudad.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            to={`/comercios?appId=${app._id ?? id}`}
            className="group flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-accent-50 hover:text-accent-700"
          >
            Ver comercios de {app.ciudad}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <Link
            to={`/vecinos?appId=${app._id ?? id}`}
            className="group flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-accent-50 hover:text-accent-700"
          >
            Ver vecinos de {app.ciudad}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </section>
    </div>
  )
}

function paisBandera(nombre: string | undefined | null): string {
  return findPaisByNombre(nombre)?.bandera ?? PAIS_DEFAULT.bandera ?? '🌎'
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-accent-500">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm uppercase tracking-wider text-neutral-900 focus:outline-none"
        />
      </div>
    </label>
  )
}
