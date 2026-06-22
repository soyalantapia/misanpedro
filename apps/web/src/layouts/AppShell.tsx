import { Outlet, NavLink, Link } from 'react-router-dom'
import { Tag, Map, Store, User, Bell } from 'lucide-react'
import { cn } from '@/lib/cn'
import { OfflineBanner } from '@/components/OfflineBanner'
import { RedemptionWatcher } from '@/components/RedemptionWatcher'
import { useAlertCouponsSync } from '@/components/AlertsBell'
import { useAlerts } from '@/lib/alerts'
import { useTenant } from '@/lib/tenant'

// Orden: Mapa · Canjeados · [Cupones centro, FAB sobresalido] · Alertas · Perfil
const links = [
  { to: '/mapa', label: 'Mapa', icon: Map, end: false, center: false },
  { to: '/locales', label: 'Locales', icon: Store, end: false, center: false },
  { to: '/', label: 'Cupones', icon: Tag, end: true, center: true },
  { to: '/alertas', label: 'Alertas', icon: Bell, end: false, center: false },
  { to: '/perfil', label: 'Perfil', icon: User, end: false, center: false },
]

export function AppShell() {
  const tenant = useTenant()
  const appName = tenant.config?.nombre ?? 'Mi Ciudad'
  // El sync del catálogo de alertas vivía en la campana; ahora vive acá (la campana se quitó).
  useAlertCouponsSync()
  const { unread } = useAlerts()
  return (
    <div className="flex min-h-[100svh] flex-col bg-fin-bg text-fin-ink md:flex-row">
      {/* Sidebar (md+) */}
      <aside
        aria-label="Panel lateral"
        className="hidden shrink-0 border-r border-fin-line bg-fin-surface md:flex md:w-60 md:flex-col lg:w-64"
      >
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-fin-lime text-fin-bg shadow-fin-glow">
            <Tag size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-fin-ink">{appName}</p>
            <p className="text-xs font-medium text-fin-faint">Descuentos vecinales</p>
          </div>
        </div>
        <nav aria-label="Navegación principal" className="flex flex-col gap-1 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-fin-surface2 text-fin-lime ring-1 ring-fin-line'
                    : 'text-fin-soft hover:bg-fin-surface2/60 hover:text-fin-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={cn('transition-colors', isActive ? 'text-fin-lime' : 'text-fin-faint group-hover:text-fin-ink')} />
                  {label}
                  {to === '/alertas' && unread > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-status-error px-1 text-[10px] font-bold text-on-brand">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile header — compacto */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-fin-line bg-fin-bg/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-2" aria-label={`${appName} · inicio`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-fin-lime text-fin-bg">
            <Tag size={16} />
          </div>
          <span className="truncate text-[15px] font-bold leading-none text-fin-ink">{appName}</span>
        </Link>
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
        <OfflineBanner />
        <RedemptionWatcher />
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-3 bottom-3 z-30 rounded-3xl bg-fin-surface/95 p-1.5 ring-1 ring-fin-line shadow-fin-card backdrop-blur-xl md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end justify-around">
          {links.map(({ to, label, icon: Icon, end, center }) =>
            center ? (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        '-mt-9 grid h-16 w-16 place-items-center rounded-full bg-fin-lime text-fin-bg ring-4 ring-fin-bg shadow-fin-glow transition-transform duration-200',
                        isActive ? 'scale-105' : 'hover:scale-105',
                      )}
                    >
                      <Icon size={26} />
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-bold transition-colors',
                        isActive ? 'text-fin-lime' : 'text-fin-soft',
                      )}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2.5 text-[11px] font-semibold transition-all duration-200',
                    isActive ? 'bg-fin-lime text-fin-bg shadow-fin-glow' : 'text-fin-soft',
                  )
                }
              >
                <span className="relative">
                  <Icon size={20} />
                  {to === '/alertas' && unread > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-error px-1 text-[9px] font-bold text-on-brand ring-2 ring-fin-surface">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            ),
          )}
        </div>
      </nav>
    </div>
  )
}
