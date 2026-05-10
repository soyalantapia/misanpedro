import { Outlet, NavLink, Navigate, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  ScanLine,
  Tag,
  Users,
  Store,
  LogOut,
  ShieldCheck,
  MessageCircle,
  HelpCircle,
} from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'
import { useMerchant } from '@/lib/merchantsStore'
import { cn } from '@/lib/cn'
import { NotificationsBell } from '@/components/NotificationsBell'

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ?? '5493329000000'
const SUPPORT_WA_LINK = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  'Hola Mi San Pedro, soy comercio adherido y necesito ayuda.',
)}`

const links = [
  { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/admin/validar', label: 'Validar', icon: ScanLine, end: false },
  { to: '/admin/cupones', label: 'Cupones', icon: Tag, end: false },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/admin/whatsapp', label: 'Promos', icon: MessageCircle, end: false },
  { to: '/admin/comercio', label: 'Comercio', icon: Store, end: false },
]

export function MerchantShell() {
  const sessionState = useMerchantSession()
  const { session } = sessionState
  const navigate = useNavigate()
  const localMerchant = useMerchant(session?.merchantId)

  if (!session) return <Navigate to="/admin/login" replace />

  const user = merchantAuth.getCurrentUser()
  // Preferimos el merchant del API (cuando la sesión vino de login real);
  // fallback al store local con merchants seed para la demo gh-pages.
  const merchant = sessionState.apiMerchant
    ? {
        id: sessionState.apiMerchant.id,
        nombre: sessionState.apiMerchant.nombre,
        categoria: sessionState.apiMerchant.categoria,
      }
    : localMerchant
  if (!user || !merchant) return <Navigate to="/admin/login" replace />

  function handleLogout() {
    merchantAuth.logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-primary-50 text-neutral-900 md:flex-row">
      <aside className="hidden shrink-0 border-r border-neutral-100 bg-white md:flex md:w-64 md:flex-col lg:w-72">
        <div className="flex flex-col gap-3 px-5 py-6">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-700">
            <ShieldCheck size={10} /> Panel comercio
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
              <Store size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-neutral-900">{merchant.nombre}</p>
              <p className="truncate text-xs text-neutral-500">{user.nombre}</p>
            </div>
            <NotificationsBell />
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
        <div className="mt-auto flex flex-col gap-1 p-3">
          <a
            href={SUPPORT_WA_LINK}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-neutral-500 hover:bg-status-success-bg/60 hover:text-status-success-fg"
          >
            <HelpCircle size={14} /> Soporte por WhatsApp
          </a>
          <Link
            to="/legal/terminos"
            className="flex items-center gap-2 rounded-2xl px-4 py-2 text-[11px] font-medium text-neutral-400 hover:bg-primary-100/60 hover:text-neutral-700"
          >
            Términos y Privacidad
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-neutral-500 hover:bg-primary-100/60 hover:text-neutral-900"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 bg-white/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <Store size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-neutral-900">
              {merchant.nombre}
            </p>
            <p className="truncate text-[11px] font-medium leading-tight text-accent-700">
              Panel comercio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell compact />
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="grid h-9 w-9 place-items-center rounded-full bg-primary-100 text-neutral-500 hover:text-neutral-900"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
        <Outlet />
      </main>

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
                  'flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                    : 'text-neutral-500',
                )
              }
            >
              <Icon size={18} />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
