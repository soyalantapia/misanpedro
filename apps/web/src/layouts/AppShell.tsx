import { Outlet, NavLink, Link } from 'react-router-dom'
import { Tag, Ticket, CheckCircle2, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { OfflineBanner } from '@/components/OfflineBanner'
import { RedemptionWatcher } from '@/components/RedemptionWatcher'

const links = [
  { to: '/', label: 'Descuentos', icon: Tag, end: true },
  { to: '/mis-cupones', label: 'Mis cupones', icon: Ticket, end: false },
  { to: '/canjeados', label: 'Canjeados', icon: CheckCircle2, end: false },
  { to: '/perfil', label: 'Perfil', icon: User, end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-primary-50 text-neutral-900 md:flex-row">
      {/* Sidebar (md+) */}
      <aside className="hidden shrink-0 border-r border-neutral-100 bg-white md:flex md:w-60 md:flex-col lg:w-64">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <Tag size={22} />
          </div>
          <div>
            <p className="text-base font-bold text-neutral-900">Mi San Pedro</p>
            <p className="text-xs font-medium text-neutral-400">Descuentos vecinales</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                  'focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-neutral-500 hover:bg-primary-100/60 hover:text-neutral-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={cn(
                      'transition-colors',
                      isActive
                        ? 'text-accent-500'
                        : 'text-neutral-400 group-hover:text-neutral-700',
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 bg-white/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <Tag size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-neutral-900">Mi San Pedro</p>
            <p className="text-[11px] font-medium leading-tight text-neutral-400">Descuentos vecinales</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
        <OfflineBanner />
        <RedemptionWatcher />
        <Outlet />
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-4 text-[11px] text-neutral-400">
          <Link to="/legal/terminos" className="hover:text-neutral-700">
            Términos
          </Link>
          <span>·</span>
          <Link to="/legal/privacidad" className="hover:text-neutral-700">
            Privacidad
          </Link>
          <span>·</span>
          <Link to="/perfil" className="hover:text-neutral-700">
            Mi cuenta
          </Link>
          <span>·</span>
          <a
            href="mailto:soporte@misanpedro.app"
            className="hover:text-neutral-700"
          >
            soporte@misanpedro.app
          </a>
        </footer>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-3xl bg-white p-1.5 shadow-floating md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2.5 text-[11px] font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                    : 'text-neutral-500',
                )
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
