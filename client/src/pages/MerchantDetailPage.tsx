import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Phone, Clock, ExternalLink } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { CouponCard } from '@/components/CouponCard'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { CATEGORIAS } from '@/lib/types'

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const merchant = useMerchant(id)
  const allCoupons = useCouponsByMerchant(id ?? '')

  if (!merchant) return <Navigate to="/" replace />

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const coupons = allCoupons.filter((c) => c.estado === 'activo')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.nombre}, ${merchant.direccion}`)}`

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col">
      <div className="relative">
        <CardImage categoria={merchant.categoria} className="h-44 w-full sm:h-56" size="lg" />
        <Link
          to="/"
          aria-label="Volver"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-neutral-700 shadow-card backdrop-blur transition-all hover:-translate-y-0.5 hover:text-neutral-900"
        >
          <ChevronLeft size={20} />
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">{cat}</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            {merchant.nombre}
          </h1>
          <p className="text-sm text-neutral-500">{merchant.direccion}</p>
        </header>

        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-card ring-1 ring-neutral-100 text-sm text-neutral-700">
          <Row icon={MapPin}>{merchant.direccion}</Row>
          <Row icon={Phone}>{merchant.telefono}</Row>
          <Row icon={Clock}>{merchant.horarios}</Row>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-600"
          >
            Abrir en Google Maps <ExternalLink size={12} />
          </a>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
            Descuentos disponibles
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {coupons.map((c, i) => (
              <CouponCard key={c.id} coupon={c} merchant={merchant} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-neutral-400" />
      <span>{children}</span>
    </div>
  )
}
