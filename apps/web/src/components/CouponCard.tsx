import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { CardImage } from './CardImage'
import { CATEGORIAS, type Coupon, type Merchant } from '@/lib/types'
import { formatVigencia, distanceLabel, calcAhorro, formatMoney } from '@/lib/format'

export function CouponCard({
  coupon,
  merchant,
  distanceKm,
  index = 0,
}: {
  coupon: Coupon
  merchant: Merchant
  distanceKm?: number
  index?: number
}) {
  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const ahorro = coupon.precioReferencia
    ? Math.round((coupon.precioReferencia * coupon.porcentaje) / 100)
    : calcAhorro(coupon.porcentaje)
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
        {distanceKm !== undefined && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-fin-bg px-2.5 py-1 text-[11px] font-semibold text-fin-ink shadow-fin-card ring-1 ring-fin-line">
            <MapPin size={11} />
            {distanceLabel(distanceKm)}
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
          {formatVigencia(coupon.vigenciaHasta)}
        </p>
      </div>
    </Link>
  )
}
