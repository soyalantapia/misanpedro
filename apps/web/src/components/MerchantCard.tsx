import { Link } from 'react-router-dom'
import { MapPin, Tag } from 'lucide-react'
import { CardImage } from './CardImage'
import { CATEGORIAS, type Coupon, type Merchant } from '@/lib/types'
import { distanceLabel } from '@/lib/format'

export function MerchantCard({
  merchant,
  coupons,
  distanceKm,
  index = 0,
}: {
  merchant: Merchant
  coupons: Coupon[]
  distanceKm?: number
  index?: number
}) {
  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const maxOff = coupons.reduce((m, c) => Math.max(m, c.porcentaje), 0)
  return (
    <Link
      to={`/comercio/${merchant.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-fade-up group flex overflow-hidden rounded-3xl bg-fin-surface ring-1 ring-fin-line shadow-fin-card transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-fin-lime"
    >
      <CardImage
        categoria={merchant.categoria}
        coverImageUrl={merchant.coverImageUrl}
        className="h-auto w-28 shrink-0"
        size="sm"
      />
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-fin-faint">{cat}</p>
        <h3 className="text-base font-bold leading-tight text-fin-ink">{merchant.nombre}</h3>
        <p className="text-xs text-fin-soft">{merchant.direccion}</p>
        <div className="mt-auto flex items-center gap-2 pt-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-fin-lime/15 px-2 py-0.5 text-[11px] font-bold text-fin-lime ring-1 ring-fin-lime/25">
            <Tag size={10} />
            {coupons.length} {coupons.length === 1 ? 'descuento' : 'descuentos'}
          </span>
          {maxOff > 0 && (
            <span className="text-[11px] font-semibold text-fin-soft">
              hasta <span className="text-fin-ink">{maxOff}%</span> off
            </span>
          )}
          {distanceKm !== undefined && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-fin-faint">
              <MapPin size={10} />
              {distanceLabel(distanceKm)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
