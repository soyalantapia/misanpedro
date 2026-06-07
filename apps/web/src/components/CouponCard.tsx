import { Link } from 'react-router-dom'
import { MapPin, Zap } from 'lucide-react'
import { CardImage } from './CardImage'
import { CATEGORIAS, type Coupon, type Merchant } from '@/lib/types'
import { formatVigencia, distanceLabel, formatMoney } from '@/lib/format'
import { valorCupon, franjaTexto, type ValorDisplay } from '@/lib/cuponValor'

/**
 * Valor HONESTO del cupón — nunca inventa pesos. Ramifica por tipo/alcance/
 * precio/toggle (ver valorCupon). El ahorro en verde (--color-up), el % en marca.
 */
function ValorLinea({ v }: { v: ValorDisplay }) {
  if (v.modo === 'precio_fijo') {
    return (
      <p className="text-sm font-extrabold text-fin-ink">
        Pagás {formatMoney(v.precioFijo ?? 0)}
        {v.ahorro != null && (
          <span className="ml-1.5 text-fin-up">· ahorrás {formatMoney(v.ahorro)}</span>
        )}
      </p>
    )
  }
  if (v.modo === 'pesos_exacto') {
    return (
      <p className="text-sm font-bold text-fin-ink">
        Pagás {formatMoney(v.paga ?? 0)} ·{' '}
        <span className="font-extrabold text-fin-up">ahorrás {formatMoney(v.ahorro ?? 0)}</span>
      </p>
    )
  }
  if (v.modo === 'pesos_aprox') {
    return (
      <p className="text-sm font-extrabold text-fin-up">
        Ahorrás ~{formatMoney(v.ahorro ?? 0)}
        {v.precioRef != null && (
          <span className="font-medium text-fin-soft"> (en una de {formatMoney(v.precioRef)})</span>
        )}
      </p>
    )
  }
  // solo_pct — sin pesos (toggle OFF o sin precio)
  return (
    <p className="text-sm font-extrabold text-fin-lime">
      {v.porcentaje}% OFF
      {v.sobre && <span className="font-semibold text-fin-soft"> en {v.sobre}</span>}
    </p>
  )
}

/** Chip "⚡ Oportunidad" + franja, para happy_hour. */
function HappyChip({ v }: { v: ValorDisplay }) {
  if (!v.esHappyHour) return null
  const f = franjaTexto(v.franja)
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-fin-lime/15 px-2 py-0.5 text-[11px] font-bold text-fin-lime ring-1 ring-fin-lime/30">
      <Zap size={11} /> Oportunidad{f ? ` · ${f}` : ''}
    </span>
  )
}

export function CouponCard({
  coupon,
  merchant,
  distanceKm,
  index = 0,
  compact = false,
}: {
  coupon: Coupon
  merchant: Merchant
  distanceKm?: number
  index?: number
  compact?: boolean
}) {
  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const v = valorCupon(coupon)

  if (compact) {
    return (
      <Link
        to={`/cupon/${coupon.id}`}
        style={{ animationDelay: `${index * 60}ms` }}
        className="animate-fade-up group flex items-center gap-3 rounded-2xl bg-fin-surface p-3 ring-1 ring-fin-line shadow-fin-card transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-fin-lime"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-fin-lime text-fin-bg shadow-fin-glow">
          <span className="text-sm font-extrabold leading-none tabular-nums">{coupon.porcentaje}%</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight text-fin-ink">{coupon.titulo}</h3>
          <ValorLinea v={v} />
          <p className="text-[11px] font-medium text-fin-soft">
            {v.esHappyHour && franjaTexto(v.franja)
              ? `⚡ Solo ${franjaTexto(v.franja)}`
              : formatVigencia(coupon.vigenciaHasta)}
          </p>
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
        <HappyChip v={v} />
        <ValorLinea v={v} />
        <p className="mt-auto text-xs font-medium text-fin-soft">
          {formatVigencia(coupon.vigenciaHasta)}
        </p>
      </div>
    </Link>
  )
}
