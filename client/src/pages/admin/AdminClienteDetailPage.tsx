import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ChevronLeft,
  Mail,
  Phone,
  IdCard,
  Cake,
  Clock,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Sparkles,
  MessageCircle,
} from 'lucide-react'
import { useMerchantSession } from '@/lib/merchantStore'
import { useRedemptionsForMerchant } from '@/lib/merchantQueries'
import { useUser } from '@/lib/stores'
import { useCoupons } from '@/lib/couponsStore'
import { formatMoney, formatRedeemedDate } from '@/lib/format'

export function AdminClienteDetailPage() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? ''
  const redemptions = useRedemptionsForMerchant(merchantId)
  const user = useUser()
  const coupons = useCoupons()

  const couponMap = useMemo(() => new Map(coupons.map((c) => [c.id, c])), [coupons])

  if (redemptions.length === 0 || !user) {
    return <Navigate to="/admin/clientes" replace />
  }

  const ahorroTotal = redemptions.reduce((s, r) => s + (r.ahorroEstimado ?? 0), 0)
  const sortedDesc = [...redemptions].sort((a, b) =>
    new Date(b.redeemedAt!).getTime() - new Date(a.redeemedAt!).getTime(),
  )
  const firstAt = sortedDesc[sortedDesc.length - 1]?.redeemedAt
  const lastAt = sortedDesc[0]?.redeemedAt
  const monthsActive = monthsSince(firstAt)
  const avgPerMonth = monthsActive > 0 ? Math.round((redemptions.length / monthsActive) * 10) / 10 : redemptions.length

  // Patrón: día de la semana más frecuente
  const dayCount = new Map<number, number>()
  redemptions.forEach((r) => {
    if (!r.redeemedAt) return
    const d = new Date(r.redeemedAt).getDay()
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
  })
  const topDay = [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  // Cupón más usado
  const couponCount = new Map<string, number>()
  redemptions.forEach((r) => {
    couponCount.set(r.couponId, (couponCount.get(r.couponId) ?? 0) + 1)
  })
  const topCoupon = [...couponCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const topCouponData = topCoupon ? couponMap.get(topCoupon[0]) : undefined

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const edad = ageFrom(user.fechaNacimiento)

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-32 sm:px-6 sm:pt-10">
      <Link
        to="/admin/clientes"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Mis clientes
      </Link>

      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-2xl font-bold text-white shadow-cta">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
            {user.nombre}
          </h1>
          <p className="text-xs text-neutral-500">
            Cliente Mi San Pedro · desde {firstAt ? formatRedeemedDate(firstAt) : '—'}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5">
        <BigStat
          label="Dinero ahorrado"
          value={formatMoney(ahorroTotal)}
          icon={TrendingUp}
          accent
        />
        <BigStat
          label="Total de canjes"
          value={String(redemptions.length)}
          icon={Calendar}
        />
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-neutral-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Datos personales
        </p>
        <div className="mt-3 flex flex-col gap-2.5 text-sm">
          <Row icon={IdCard} label="DNI">
            {user.dni}
          </Row>
          <Row icon={Mail} label="Email">
            <a href={`mailto:${user.email}`} className="text-accent-700 hover:underline">
              {user.email}
            </a>
          </Row>
          <Row icon={Phone} label="WhatsApp">
            <a
              href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent-700 hover:underline"
            >
              {user.whatsapp} <MessageCircle size={11} />
            </a>
          </Row>
          <Row icon={Cake} label="Nacimiento">
            {formatBirthdate(user.fechaNacimiento)}
            {edad !== null && <span className="ml-1 text-neutral-400">· {edad} años</span>}
          </Row>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Patrones de visita
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <PatternCard
            icon={Calendar}
            label="Día más visitado"
            value={topDay ? dayNames[topDay[0]] : '—'}
            sub={topDay ? `${topDay[1]} ${topDay[1] === 1 ? 'visita' : 'visitas'}` : undefined}
          />
          <PatternCard
            icon={TrendingUp}
            label="Frecuencia"
            value={`${avgPerMonth}/mes`}
            sub={
              monthsActive > 0
                ? `${monthsActive} ${monthsActive === 1 ? 'mes' : 'meses'} de actividad`
                : 'Cliente nuevo'
            }
          />
          <PatternCard
            icon={Sparkles}
            label="Cupón favorito"
            value={topCouponData?.titulo ?? '—'}
            sub={topCoupon ? `${topCoupon[1]}× usado` : undefined}
          />
          <PatternCard
            icon={Clock}
            label="Última visita"
            value={lastAt ? formatRedeemedDate(lastAt) : '—'}
          />
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Historial completo · {redemptions.length}{' '}
          {redemptions.length === 1 ? 'canje' : 'canjes'}
        </p>
        <div className="flex flex-col gap-2">
          {sortedDesc.map((r, i) => {
            const c = couponMap.get(r.couponId)
            if (!c || !r.redeemedAt) return null
            return (
              <div
                key={r.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-up flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 font-bold tabular-nums">
                  {c.porcentaje}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{c.titulo}</p>
                  <p className="text-xs text-neutral-500">{formatRedeemedDate(r.redeemedAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-status-success-fg tabular-nums">
                  {formatMoney(r.ahorroEstimado ?? 0)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-2xl bg-status-info-bg p-4 text-status-info-fg">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium">
          Estos datos son tuyos para gestionar tu relación con el cliente. No los compartas con
          terceros sin consentimiento expreso (Ley 25.326).
        </p>
      </div>

      <div
        className="fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-3xl bg-white p-3 shadow-floating ring-1 ring-neutral-100 sm:inset-x-auto sm:right-6 sm:left-auto sm:max-w-md md:bottom-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <a
          href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-cta transition-all hover:-translate-y-0.5"
        >
          <MessageCircle size={16} /> Escribir por WhatsApp
        </a>
      </div>
    </div>
  )
}

function BigStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: typeof TrendingUp
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-card ring-1 ring-neutral-100 ${
        accent ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={accent ? 'text-accent-50' : 'text-accent-500'} />
        <p
          className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-accent-50/90' : 'text-neutral-500'}`}
        >
          {label}
        </p>
      </div>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${accent ? 'text-white' : 'text-neutral-900'}`}
      >
        {value}
      </p>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-100 text-neutral-500">
        <Icon size={14} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 text-sm">
        <span className="text-neutral-500">{label}</span>
        <span className="text-right text-neutral-900 font-semibold">{children}</span>
      </div>
    </div>
  )
}

function PatternCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Calendar
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-neutral-100">
      <div className="flex items-center gap-1.5 text-accent-500">
        <Icon size={12} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
      </div>
      <p className="mt-1 text-sm font-bold text-neutral-900">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  )
}

function monthsSince(iso: string | undefined): number {
  if (!iso) return 0
  const months = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.max(1, Math.round(months))
}

function ageFrom(iso: string): number | null {
  if (!iso) return null
  const dob = new Date(iso)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function formatBirthdate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}
