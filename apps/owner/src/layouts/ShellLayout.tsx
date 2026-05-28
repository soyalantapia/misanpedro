import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  AppWindow,
  Store,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { authActions, useAuth } from '@/lib/store'
import { owner } from '@/lib/api'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/apps', label: 'Apps', icon: AppWindow },
  { to: '/comercios', label: 'Comercios', icon: Store },
  { to: '/vecinos', label: 'Vecinos', icon: Users },
  { to: '/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function ShellLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!auth.access || !auth.owner) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  async function handleLogout() {
    try {
      if (auth.refresh) await owner.logout(auth.refresh)
    } catch {
      /* noop */
    }
    authActions.signOut()
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow">
            <span className="text-xs font-black">M</span>
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight">Mi San Pedro</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-accent-700">
              Owner
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-neutral-200 p-3">
          <OwnerBadge nombre={auth.owner.nombre} email={auth.owner.email} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white">
            <span className="text-xs font-black">c</span>
          </span>
          <span>Owner</span>
        </Link>
        <button
          type="button"
          aria-label={mobileOpen ? 'Cerrar' : 'Abrir menú'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sticky top-14 z-20 border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <SidebarLink key={item.to} {...item} onClick={() => setMobileOpen(false)} />
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-bg/50"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      {/* Main */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string
  label: string
  icon: any
  end?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-accent-50 text-accent-700'
            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
        )
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

function OwnerBadge({
  nombre,
  email,
  onLogout,
}: {
  nombre: string
  email: string
  onLogout: () => void
}) {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-neutral-50 px-2.5 py-2 ring-1 ring-neutral-200">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-xs font-bold text-white">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-neutral-900">{nombre}</p>
        <p className="truncate text-[10px] text-neutral-500">{email}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-danger-bg/50 hover:text-danger"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
