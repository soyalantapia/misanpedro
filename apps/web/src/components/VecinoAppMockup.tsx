import { Search, MapPin, Store, Ticket, User, Flame } from 'lucide-react'
import { useTenant } from '@/lib/tenant'
import { formatMoney } from '@/lib/format'

/**
 * Mockup de la PWA del vecino — tenant-aware (nombre, ciudad, color de marca y
 * moneda salen del tenant). Pensado para el lado "marketing" de las pantallas del
 * comercio (login / registro). Es decorativo: aria-hidden.
 */
export function VecinoAppMockup({ className = '' }: { className?: string }) {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  const ciudad = tenant.config?.ciudad ?? 'tu ciudad'
  const inicial = (ciudad.trim().charAt(0) || 'M').toUpperCase()

  return (
    <div className={`relative mx-auto w-full max-w-[260px] ${className}`} aria-hidden="true">
      {/* Glow de marca detrás del teléfono */}
      <div className="absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-on-brand/20 blur-3xl" />

      {/* Marco del teléfono */}
      <div className="relative rounded-[2.6rem] bg-neutral-900 p-2.5 shadow-[0_40px_90px_-25px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
        {/* Notch */}
        <div className="absolute left-1/2 top-3 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
        {/* Pantalla */}
        <div className="overflow-hidden rounded-[2.1rem] bg-neutral-50">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-semibold text-neutral-500">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3.5 rounded-sm bg-neutral-300" />
            </span>
          </div>

          {/* Header app */}
          <div className="flex items-center justify-between px-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-strong text-[12px] font-black text-on-brand">
                {inicial}
              </div>
              <span className="text-[13px] font-bold tracking-tight text-neutral-900">{appName}</span>
            </div>
            <div className="h-7 w-7 rounded-full bg-neutral-200" />
          </div>

          {/* Savings card */}
          <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-br from-brand to-brand-strong p-4 text-on-brand shadow-cta">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-on-brand/70">
              Ahorrado en {ciudad}
            </p>
            <p className="mt-1 text-[30px] font-black leading-none tracking-tight">
              {formatMoney(14300)}
            </p>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-on-brand/80">12 canjes</span>
              <span className="flex items-center gap-1 rounded-full bg-surface/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-white/20">
                <Flame size={9} /> Ahorrador Plata
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-neutral-400">
            <Search size={13} />
            <span className="text-[11px] font-medium">Buscar comercio o descuento</span>
          </div>

          {/* Cupones */}
          <div className="space-y-2.5 px-4 pb-3">
            <CouponRow categoria="Panadería" titulo="Docena de facturas" off="25%" ahorro={900} />
            <CouponRow categoria="Almacén" titulo="La compra de la semana" off="20%" ahorro={2400} />
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-around border-t border-neutral-100 bg-surface px-2 py-2.5">
            <NavIcon icon={MapPin} label="Mapa" />
            <NavIcon icon={Store} label="Locales" />
            <NavIcon icon={Ticket} label="Cupones" active />
            <NavIcon icon={User} label="Perfil" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CouponRow({
  categoria,
  titulo,
  off,
  ahorro,
}: {
  categoria: string
  titulo: string
  off: string
  ahorro: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-2.5 ring-1 ring-neutral-100">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft">
        <span className="text-[13px] font-black text-brand-strong">{off}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-bold uppercase tracking-wider text-neutral-400">
          {categoria}
        </p>
        <p className="truncate text-[12px] font-bold text-neutral-900">{titulo}</p>
        <p className="text-[10px] font-semibold text-status-success-fg">
          Ahorrás ~{formatMoney(ahorro)}
        </p>
      </div>
    </div>
  )
}

function NavIcon({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Store
  label: string
  active?: boolean
}) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${active ? 'text-brand-strong' : 'text-neutral-400'}`}>
      <Icon size={16} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[8px] font-bold">{label}</span>
    </div>
  )
}
