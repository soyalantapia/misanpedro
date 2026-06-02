import { useEffect } from 'react'
import { Outlet, NavLink, Navigate, useNavigate, useLocation, Link } from 'react-router-dom'
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
  CreditCard,
  Gift,
} from 'lucide-react'
import { merchantAuth, useMerchantSession } from '@/lib/merchantStore'
import { useMerchant } from '@/lib/merchantsStore'
import { cn } from '@/lib/cn'
import { getSupportLink } from '@/lib/tenant'
import { NotificationsBell } from '@/components/NotificationsBell'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useState } from 'react'

// C3/V1: soporte con fallback a email si el WhatsApp es placeholder o no está
// seteado (helper compartido con PerfilPage del vecino).
const SUPPORT = getSupportLink(
  'Hola, soy comercio adherido a Mi San Pedro y necesito ayuda.',
  'Soporte comercio Mi San Pedro',
)

// F13 glosario: del lado del comercio usamos "Descuentos" (lo que crea).
// "Cupones" queda reservado para el lado del vecino (lo que activa).
const links = [
  { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/admin/validar', label: 'Validar', icon: ScanLine, end: false },
  { to: '/admin/cupones', label: 'Descuentos', icon: Tag, end: false },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
  // F17: "Promos" era ambiguo (¿ver promos disponibles? ¿gestionar mis promos?).
  // "WhatsApp" describe exactamente la funcionalidad (campañas masivas).
  { to: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle, end: false },
  { to: '/admin/comercio', label: 'Comercio', icon: Store, end: false },
]

// Referidos vive en el sidebar desktop y en el header mobile (NO en el bottom
// nav: ya tiene 6 ítems y sumar un 7º aprieta los tap targets en 375px).
const referidosLink = { to: '/admin/referidos', label: 'Recomendá y ganá', icon: Gift, end: false }

export function MerchantShell() {
  const sessionState = useMerchantSession()
  const { session } = sessionState
  const navigate = useNavigate()
  const localMerchant = useMerchant(session?.merchantId)
  // N7: confirmación antes de logout para evitar mistap en mobile (el icono de
  // salida es un círculo chico en el header, sin label visible). Declarado acá
  // arriba (antes de los returns condicionales de abajo) para no violar las
  // Rules of Hooks de React — C1 audit v5.
  const [confirmLogout, setConfirmLogout] = useState(false)

  // Si en cualquier momento se pierde la sesión (refresh token falló, etc.),
  // el cliente HTTP dispara `msp:session-expired`. Limpiamos sesión local y
  // redirigimos al login con flag para mostrar mensaje "Tu sesión expiró".
  useEffect(() => {
    const onExpired = (e: Event) => {
      const detail = (e as CustomEvent<{ subject: string }>).detail
      if (detail?.subject !== 'merchant') return
      void merchantAuth.logout()
      navigate('/admin/login?reason=expired', { replace: true })
    }
    window.addEventListener('msp:session-expired', onExpired)
    return () => window.removeEventListener('msp:session-expired', onExpired)
  }, [navigate])

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

  // Sesión existe pero los datos todavía no llegaron: mostramos un skeleton
  // en lugar de redirigir al login y generar un flash falso.
  if (!user || !merchant) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-brand-soft" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>
    )
  }

  function handleLogout() {
    merchantAuth.logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-bg text-ink md:flex-row">
      <aside aria-label="Panel lateral comercio" className="hidden shrink-0 border-r border-line bg-surface md:flex md:w-64 md:flex-col lg:w-72">
        <div className="flex flex-col gap-3 px-5 py-6">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-strong">
            <ShieldCheck size={10} /> Panel comercio
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
              <Store size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-ink">{merchant.nombre}</p>
              <p className="truncate text-xs text-ink-soft">{user.nombre}</p>
            </div>
            <NotificationsBell />
          </div>
        </div>
        <nav aria-label="Navegación panel comercio" className="flex flex-col gap-1 px-3">
          {[...links, referidosLink].map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-brand-soft text-brand-strong'
                    : 'text-ink-soft hover:bg-surface-2/60 hover:text-ink',
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
                        ? 'text-brand'
                        : 'text-ink-faint group-hover:text-ink',
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
            href={SUPPORT.href}
            target={SUPPORT.isWhatsapp ? '_blank' : undefined}
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-ink-soft hover:bg-status-success-bg/60 hover:text-status-success-fg"
          >
            <HelpCircle size={14} /> {SUPPORT.label}
          </a>
          <Link
            to="/legal/terminos"
            className="flex items-center gap-2 rounded-2xl px-4 py-2 text-[11px] font-medium text-ink-faint hover:bg-surface-2/60 hover:text-ink"
          >
            Términos y Privacidad
          </Link>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-ink-soft hover:bg-surface-2/60 hover:text-ink"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta">
            <Store size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-ink">
              {merchant.nombre}
            </p>
            <p className="truncate text-[11px] font-medium leading-tight text-brand-strong">
              Panel comercio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/referidos"
            aria-label="Recomendá y ganá"
            title="Recomendá y ganá"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand-strong hover:bg-brand-soft"
          >
            <Gift size={15} />
          </Link>
          <NotificationsBell compact />
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink-soft hover:text-ink"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
        {/* F7: banner sticky pending_payment en TODAS las pantallas del admin.
            Antes vivía solo en AdminDashboardPage → si Sandra entraba directo
            a /admin/validar o /admin/cupones, no veía el aviso y trabajaba
            creyendo que su comercio era visible. */}
        <PendingPaymentBanner />
        <Outlet />
      </main>

      {/* F9: 6 ítems en bottom nav. En mobile chico (375px) cada uno tiene
          ~62px → tap targets apretados (borderline WCAG 44x44). Solución:
          inset lateral reducido (`inset-x-2` en lugar de `inset-x-3`) para
          ganar 8px, y label `text-[9px]` con icono `size={20}` para mejor
          ratio visual/tappable. Si en el futuro la cantidad sube a 7+,
          conviene migrar a "Más" menú. */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-2 bottom-3 z-30 rounded-3xl bg-surface p-1 shadow-floating md:hidden"
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
                  'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[9px] font-semibold transition-all duration-200',
                  // min-h asegura tap target ≥44px (WCAG 2.1 SC 2.5.5)
                  'min-h-[44px] justify-center',
                  isActive
                    ? 'bg-gradient-to-br from-brand to-brand-strong text-on-brand shadow-cta'
                    : 'text-ink-soft active:bg-surface-2',
                )
              }
            >
              <Icon size={18} />
              <span className="truncate px-0.5">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* N7: ConfirmDialog para evitar mistap del icono logout en mobile.
          Antes un toque accidental te sacaba sin warning. */}
      <ConfirmDialog
        open={confirmLogout}
        title="¿Cerrar sesión?"
        description="Vas a tener que volver a ingresar email + contraseña para entrar al panel."
        confirmLabel="Sí, cerrar sesión"
        cancelLabel="Volver"
        variant="warning"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false)
          handleLogout()
        }}
      />
    </div>
  )
}

/**
 * Banner sticky-top que se muestra en TODO el admin cuando el comercio está
 * en `pending_payment`. Se oculta en /admin/comercio (donde el merchant ya
 * está viendo el SubscriptionCard con detalle) para no duplicar el aviso.
 *
 * F7 — antes este aviso vivía solo en AdminDashboardPage, así que un
 * comerciante que entraba directo a /admin/validar (por bookmark, o porque
 * el cliente está en el mostrador) no veía el aviso y trabajaba creyendo
 * que su comercio era visible.
 */
function PendingPaymentBanner() {
  const sessionState = useMerchantSession()
  const location = useLocation()
  if (sessionState.apiMerchant?.estado !== 'pending_payment') return null
  // En /admin/comercio el SubscriptionCard ya cuenta toda la historia, no
  // queremos duplicar visualmente.
  if (location.pathname.startsWith('/admin/comercio')) return null

  return (
    <Link
      to="/admin/comercio"
      role="alert"
      className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 shadow-card ring-1 ring-amber-200 transition-colors hover:bg-amber-100 md:top-0"
    >
      <CreditCard size={13} aria-hidden="true" />
      <span>
        Suscripción pendiente · tu comercio <strong>no es visible</strong>.{' '}
        <span className="underline underline-offset-2">Tocá para pagar</span>
      </span>
    </Link>
  )
}

