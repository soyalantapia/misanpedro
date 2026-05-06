import { Link, Navigate } from 'react-router-dom'
import { Store, MapPin, Phone, Clock, ExternalLink, Tag } from 'lucide-react'
import { useMerchantSession, merchantAuth } from '@/lib/merchantStore'
import { CardImage } from '@/components/CardImage'
import { CATEGORIAS } from '@/lib/types'
import { COUPONS, getMerchant } from '@/data/mockData'

export function AdminComercioPage() {
  const { session } = useMerchantSession()
  const merchant = session ? getMerchant(session.merchantId) : undefined
  const user = merchantAuth.getCurrentUser()

  if (!merchant) return <Navigate to="/admin/login" replace />

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const cuponesActivos = COUPONS.filter(
    (c) => c.merchantId === merchant.id && c.estado === 'activo',
  ).length

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Store size={12} /> Mi comercio
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {merchant.nombre}
        </h1>
        <p className="text-sm text-neutral-500">
          Así te ven los vecinos en la app de Mi San Pedro.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-neutral-100">
        <CardImage categoria={merchant.categoria} className="h-32" size="md" />
        <div className="flex flex-col gap-2 p-5 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">{cat}</p>
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

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
        <Store size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          La edición de datos del comercio (logo, foto de portada, horarios) llega en la próxima
          iteración. Si querés actualizar algo, contactá al equipo de Mi San Pedro.
        </p>
      </div>

      <p className="text-center text-xs text-neutral-400">
        ¿Querés ver cómo te muestra la app del vecino?{' '}
        <Link to={`/comercio/${merchant.id}`} className="font-bold text-accent-700">
          Ver mi ficha pública
        </Link>
      </p>
    </div>
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
