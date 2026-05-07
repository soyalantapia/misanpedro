import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ScanLine, Tag, Users, Store, Sparkles, MessageCircle } from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export function AdminDashboardPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const merchant = useMerchant(merchantId)
  const redemptions = useRedemptionsForMerchant(merchantId)

  const kpis = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startWeek = startToday - 6 * 24 * 60 * 60 * 1000
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const filterByMs = (ms: number) =>
      redemptions.filter((r) => r.redeemedAt && new Date(r.redeemedAt).getTime() >= ms)
    return {
      hoy: filterByMs(startToday).length,
      semana: filterByMs(startWeek).length,
      mes: filterByMs(startMonth).length,
      ahorroMes: filterByMs(startMonth).reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0),
    }
  }, [redemptions])

  const merchantCoupons = useCouponsByMerchant(merchantId)
  const cuponesActivos = merchantCoupons.filter((c) => c.estado === 'activo')
  const clientesUnicos = new Set(redemptions.map((r) => r.userId)).size
  const hasRedemptions = redemptions.length > 0
  const ahorroTotal = redemptions.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Sparkles size={12} /> Inicio
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {merchant?.nombre ?? 'Tu comercio'}
        </h1>
        <p className="text-sm text-neutral-500">
          Validá cupones, gestioná descuentos y mirá tu base de clientes Mi San Pedro.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2.5">
        <Kpi label="Canjes hoy" value={kpis.hoy} />
        <Kpi label="Esta semana" value={kpis.semana} />
        <Kpi label="Este mes" value={kpis.mes} accent />
      </section>

      {hasRedemptions && (
        <div className="rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-700">
            Ahorro generado a tus clientes
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-accent-700">
            {formatMoney(ahorroTotal)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-accent-700/80">
            {redemptions.length} {redemptions.length === 1 ? 'canje total' : 'canjes totales'}
            {kpis.ahorroMes > 0 && (
              <>
                {' · '}
                <span className="font-bold">{formatMoney(kpis.ahorroMes)}</span> este mes
              </>
            )}
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Acción rápida
        </p>
        <PrimaryAction
          to="/admin/validar"
          title="Validar cupón"
          description="Escaneá el QR del cliente o ingresá el código manual."
          icon={ScanLine}
        />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Gestión</p>
        <SecondaryAction
          to="/admin/cupones"
          title="Mis cupones"
          description={`${cuponesActivos.length} ${cuponesActivos.length === 1 ? 'descuento activo' : 'descuentos activos'}`}
          icon={Tag}
        />
        <SecondaryAction
          to="/admin/clientes"
          title="Mis clientes"
          description={
            hasRedemptions
              ? `${clientesUnicos} ${clientesUnicos === 1 ? 'cliente registrado' : 'clientes registrados'}`
              : 'Se desbloquea con el primer canje'
          }
          icon={Users}
          locked={!hasRedemptions}
        />
        <SecondaryAction
          to="/admin/whatsapp"
          title="Promociones por WhatsApp"
          description={hasRedemptions ? 'Hasta 4 envíos masivos por mes' : 'Disponible cuando tengas clientes'}
          icon={MessageCircle}
          locked={!hasRedemptions}
        />
        <SecondaryAction
          to="/admin/comercio"
          title="Mi comercio"
          description="Datos del local, horarios, contacto"
          icon={Store}
        />
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl px-3 py-3.5 text-center shadow-card ring-1 ring-neutral-100',
        accent ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white' : 'bg-white',
      )}
    >
      <p
        className={cn(
          'text-2xl font-bold tabular-nums leading-none',
          accent ? 'text-white' : 'text-accent-700',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'text-[10px] font-bold uppercase tracking-widest leading-tight',
          accent ? 'text-accent-50' : 'text-neutral-500',
        )}
      >
        {label}
      </p>
    </div>
  )
}

function PrimaryAction({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string
  title: string
  description: string
  icon: typeof ScanLine
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 p-5 text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-floating"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15">
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <p className="text-base font-bold">{title}</p>
        <p className="text-xs font-medium text-accent-50/90">{description}</p>
      </div>
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function SecondaryAction({
  to,
  title,
  description,
  icon: Icon,
  locked,
}: {
  to: string
  title: string
  description: string
  icon: typeof Tag
  locked?: boolean
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-neutral-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
          locked ? 'bg-primary-100 text-neutral-400' : 'bg-accent-50 text-accent-700',
        )}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-neutral-900">{title}</p>
        <p className={cn('text-xs', locked ? 'text-neutral-400' : 'text-neutral-500')}>
          {description}
        </p>
      </div>
      <ArrowRight size={16} className="text-neutral-400 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}
