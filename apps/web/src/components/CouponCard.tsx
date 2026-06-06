import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { CardImage } from './CardImage'
import { CATEGORIAS, type Coupon, type Merchant } from '@/lib/types'
import { formatVigencia, distanceLabel, calcAhorro, formatMoney } from '@/lib/format'
import { textoDisponible, type UsoEstado } from '@/lib/usoLimite'

export function CouponCard({
  coupon,
  merchant,
  distanceKm,
  index = 0,
  compact = false,
  usoEstado = null,
}: {
  coupon: Coupon
  merchant: Merchant
  distanceKm?: number
  index?: number
  compact?: boolean
  usoEstado?: UsoEstado | null
}) {
  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const ahorro = coupon.precioReferencia
    ? Math.round((coupon.precioReferencia * coupon.porcentaje) / 100)
    : calcAhorro(coupon.porcentaje)
  const bloqueado = !!usoEstado?.bloqueado
  const dispoTxt = bloqueado ? textoDisponible(usoEstado?.nextDisponible ?? null) : null

  // Variante compacta: en la página del comercio el rubro y el nombre ya están
  // en el header → sin imagen repetida ni eyebrow redundante.
  if (compact) {
    return (
      <Link
        to={`/cupon/${coupon.id}`}
        style={{ animationDelay: `${index * 60}ms` }}
        className="animate-fade-up group flex items-center gap-3 rounded-2xl bg-fin-surface p-3 ring-1 ring-fin-line shadow-fin-card transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-fin-lime"
      >
        <span
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${
            bloqueado ? 'bg-fin-surface2 text-fin-soft' : 'bg-fin-lime text-fin-bg shadow-fin-glow'
          }`}
        >
          <span className="text-sm font-extrabold leading-none tabular-nums">{coupon.porcentaje}%</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight text-fin-ink">{coupon.titulo}</h3>
          {bloqueado ? (
            <>
              <p className="text-sm font-bold text-fin-soft">Ya lo usaste</p>
              <p className="text-[11px] font-medium text-fin-faint">{dispoTxt ?? 'No disponible'}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-fin-up">Ahorrás ~{formatMoney(ahorro)}</p>
              <p className="text-[11px] font-medium text-fin-soft">{formatVigencia(coupon.vigenciaHasta)}</p>
            </>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/cupon/${coupon.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-fade-up group flex flex-col overflow-hidden rounded-3xl bg-fin-surface ring-1 ring-fin-line shadow-fin-card transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-fin-lime"
    >
      <div className="relative">
        <CardImage
          categoria={merchant.categoria}
          coverImageUrl={coupon.imagenUrl ?? merchant.coverImageUrl}
          className="h-36 w-full"
        />
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-fin-bg px-3 py-1.5 font-bold text-fin-lime shadow-floating ring-1 ring-fin-line">
          <span className="text-base tabular-nums">{coupon.porcentaje}%</span>
          <span className="ml-1 text-[10px] font-extrabold tracking-widest">OFF</span>
        </span>
        {distanceKm !== undefined && !bloqueado && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-fin-bg px-2.5 py-1 text-[11px] font-semibold text-fin-ink shadow-fin-card ring-1 ring-fin-line">
            <MapPin size={11} />
            {distanceLabel(distanceKm)}
          </span>
        )}
        {bloqueado && (
          <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-fin-ink/85 px-3 py-1 text-[11px] font-bold text-fin-bg shadow-fin-card">
            Ya lo usaste
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-fin-faint">
          {cat} · {merchant.nombre}
        </p>
        <h3 className="text-base font-bold leading-tight text-fin-ink">{coupon.titulo}</h3>
        <p className="text-sm font-extrabold text-fin-up">Ahorrás ~{formatMoney(ahorro)}</p>
        <p className="mt-auto text-xs font-medium text-fin-soft">
          {bloqueado ? (dispoTxt ?? 'Ya lo usaste') : formatVigencia(coupon.vigenciaHasta)}
        </p>
      </div>
    </Link>
  )
}
