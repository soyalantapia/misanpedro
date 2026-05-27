import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ScanLine,
  Tag,
  Users,
  Store,
  Sparkles,
  MessageCircle,
  TrendingUp,
  HandCoins,
  Receipt,
  UserPlus,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { useCouponsByMerchant, useCoupons } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useApiMerchantStats, useApiRecentRedemptions, useApiMyCoupons } from '@/lib/apiQueries'

export function AdminDashboardPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const merchant = useMerchant(merchantId)
  const localRedemptions = useRedemptionsForMerchant(merchantId)
  const apiStats = useApiMerchantStats()
  const apiRecent = useApiRecentRedemptions(200)

  const redemptions = apiRecent.data
    ? apiRecent.data.map((r: any) => ({
        id: r.id,
        couponId: String(r.couponId),
        userId: String(r.userId),
        codigoNumerico: '',
        qrPayload: '',
        activatedAt: r.redeemedAt,
        expiresAt: r.redeemedAt,
        status: 'canjeado' as const,
        redeemedAt: r.redeemedAt,
        ahorroEstimado: r.ahorroEstimado,
        montoTicket: r.montoTicket,
      }))
    : localRedemptions

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

  const localMerchantCoupons = useCouponsByMerchant(merchantId)
  const apiCupones = useApiMyCoupons()
  const merchantCoupons: any[] = apiCupones.data ?? localMerchantCoupons
  const cuponesActivos = merchantCoupons.filter((c) => c.estado === 'activo')
  const allCoupons = useCoupons()
  const couponMap = useMemo(() => {
    const m = new Map<string, any>()
    allCoupons.forEach((c) => m.set(c.id, c))
    merchantCoupons.forEach((c) => m.set(c.id, c))
    return m
  }, [allCoupons, merchantCoupons])

  // Si tenemos stats del API, usamos esos números (más precisos);
  // si no, calculamos desde los redemptions locales.
  const clientesUnicos =
    apiStats.data?.clientesUnicos ?? new Set(redemptions.map((r) => r.userId)).size
  const hasRedemptions = redemptions.length > 0
  const ahorroTotal =
    apiStats.data?.ahorroTotal ?? redemptions.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
  const ingresosTotal =
    apiStats.data?.ingresosTotal ??
    redemptions.reduce((s, r) => {
      if (r.montoTicket) return s + r.montoTicket
      const c = couponMap.get(r.couponId)
      if (!c || !r.ahorroEstimado || c.porcentaje === 0) return s
      return s + (r.ahorroEstimado * 100) / c.porcentaje
    }, 0)
  const ventasTotal = apiStats.data?.canjes ?? redemptions.length

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
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              <TrendingUp size={11} /> Generado por la app · de por vida
            </p>
            <span className="text-[10px] font-medium text-neutral-400">
              desde que sumaste tu comercio
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <LifetimeStat
              icon={Receipt}
              label="Ingresos generados"
              value={formatMoney(ingresosTotal)}
              hint="Suma estimada de los tickets pagados con cupón"
              accent
            />
            <LifetimeStat
              icon={HandCoins}
              label="Ahorro a clientes"
              value={formatMoney(ahorroTotal)}
              hint="Lo que tus clientes ahorraron gracias a tus descuentos"
            />
            <LifetimeStat
              icon={ScanLine}
              label="Ventas con la app"
              value={String(ventasTotal)}
              hint={`${ventasTotal === 1 ? 'transacción' : 'transacciones'} canjeadas`}
            />
            <LifetimeStat
              icon={UserPlus}
              label="Clientes nuevos"
              value={String(clientesUnicos)}
              hint={`${clientesUnicos === 1 ? 'vecino' : 'vecinos'} llegaron por Mi San Pedro`}
            />
          </div>
        </section>
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

function LifetimeStat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-4 shadow-card ring-1 ring-neutral-100',
        accent
          ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white'
          : 'bg-white text-neutral-900',
      )}
    >
      <div
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
          accent ? 'bg-white/15 text-accent-50' : 'bg-accent-50 text-accent-700',
        )}
      >
        <Icon size={10} />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums leading-tight tracking-tight">{value}</p>
      {hint && (
        <p
          className={cn(
            'text-[11px] leading-snug',
            accent ? 'text-accent-50/80' : 'text-neutral-500',
          )}
        >
          {hint}
        </p>
      )}
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
  const inner = (
    <>
      <div
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
          locked ? 'bg-primary-100 text-neutral-400' : 'bg-accent-50 text-accent-700',
        )}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <p className={cn('text-sm font-bold', locked ? 'text-neutral-400' : 'text-neutral-900')}>{title}</p>
        <p className={cn('text-xs', locked ? 'text-neutral-400' : 'text-neutral-500')}>
          {description}
        </p>
      </div>
      <ArrowRight size={16} className={cn('transition-transform', locked ? 'text-neutral-200' : 'text-neutral-400 group-hover:translate-x-1')} />
    </>
  )

  if (locked) {
    return (
      <div
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-4 rounded-3xl bg-white p-4 opacity-60 shadow-card ring-1 ring-neutral-100"
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-neutral-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      {inner}
    </Link>
  )
}
