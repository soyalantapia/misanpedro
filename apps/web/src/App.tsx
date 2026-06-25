import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { MerchantShell } from '@/layouts/MerchantShell'
import { ToastProvider } from '@/components/Toast'
import { InstallPrompt } from '@/components/InstallPrompt'
import { ApiSync } from '@/components/ApiSync'
import { useTenant, clearTenantSlug } from '@/lib/tenant'

// Code-split: cada página se baja como chunk independiente para reducir el
// bundle inicial. Antes el `index-*.js` era ~547KB → ahora baja a ~200KB
// más chunks pequeños por ruta que se cargan on-demand.
const DescuentosPage = lazy(() =>
  import('@/pages/DescuentosPage').then((m) => ({ default: m.DescuentosPage })),
)
const MapaPage = lazy(() =>
  import('@/pages/MapaPage').then((m) => ({ default: m.MapaPage })),
)
const CanjeadosPage = lazy(() =>
  import('@/pages/CanjeadosPage').then((m) => ({ default: m.CanjeadosPage })),
)
const CuponDetailPage = lazy(() =>
  import('@/pages/CuponDetailPage').then((m) => ({ default: m.CuponDetailPage })),
)
const MerchantDetailPage = lazy(() =>
  import('@/pages/MerchantDetailPage').then((m) => ({ default: m.MerchantDetailPage })),
)
const RegistroPage = lazy(() =>
  import('@/pages/RegistroPage').then((m) => ({ default: m.RegistroPage })),
)
const CuponActivoPage = lazy(() =>
  import('@/pages/CuponActivoPage').then((m) => ({ default: m.CuponActivoPage })),
)
const PlanPage = lazy(() =>
  import('@/pages/PlanPage').then((m) => ({ default: m.PlanPage })),
)
const PerfilPage = lazy(() =>
  import('@/pages/PerfilPage').then((m) => ({ default: m.PerfilPage })),
)
const AlertasPage = lazy(() =>
  import('@/pages/AlertasPage').then((m) => ({ default: m.AlertasPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
const TenantSelectorPage = lazy(() =>
  import('@/pages/TenantSelectorPage').then((m) => ({ default: m.TenantSelectorPage })),
)
const TerminosPage = lazy(() =>
  import('@/pages/legal/TerminosPage').then((m) => ({ default: m.TerminosPage })),
)
const PrivacidadPage = lazy(() =>
  import('@/pages/legal/PrivacidadPage').then((m) => ({ default: m.PrivacidadPage })),
)
// Admin (panel comercio) — son los chunks más pesados (whatsapp, cuponEdit,
// clienteDetail). Lazy load asegura que un vecino que solo usa la app pública
// no descargue nada del admin.
const AdminLoginPage = lazy(() =>
  import('@/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })),
)
const AdminSignupPage = lazy(() =>
  import('@/pages/admin/AdminSignupPage').then((m) => ({ default: m.AdminSignupPage })),
)
const AdminClienteDetailPage = lazy(() =>
  import('@/pages/admin/AdminClienteDetailPage').then((m) => ({
    default: m.AdminClienteDetailPage,
  })),
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminValidarPage = lazy(() =>
  import('@/pages/admin/AdminValidarPage').then((m) => ({ default: m.AdminValidarPage })),
)
const AdminConfirmarCanjePage = lazy(() =>
  import('@/pages/admin/AdminConfirmarCanjePage').then((m) => ({
    default: m.AdminConfirmarCanjePage,
  })),
)
const AdminCuponesPage = lazy(() =>
  import('@/pages/admin/AdminCuponesPage').then((m) => ({ default: m.AdminCuponesPage })),
)
const AdminCuponEditPage = lazy(() =>
  import('@/pages/admin/AdminCuponEditPage').then((m) => ({ default: m.AdminCuponEditPage })),
)
const AdminClientesPage = lazy(() =>
  import('@/pages/admin/AdminClientesPage').then((m) => ({ default: m.AdminClientesPage })),
)
const AdminComercioPage = lazy(() =>
  import('@/pages/admin/AdminComercioPage').then((m) => ({ default: m.AdminComercioPage })),
)
const AdminWhatsappPage = lazy(() =>
  import('@/pages/admin/AdminWhatsappPage').then((m) => ({ default: m.AdminWhatsappPage })),
)
const AdminReferidosPage = lazy(() =>
  import('@/pages/admin/AdminReferidosPage').then((m) => ({ default: m.AdminReferidosPage })),
)
const AdminEstadisticasPage = lazy(() =>
  import('@/pages/admin/AdminEstadisticasPage').then((m) => ({ default: m.AdminEstadisticasPage })),
)

/**
 * Fallback minimalista mientras se carga el chunk de la página.
 * Las páginas tienen sus propios skeletons internos así que esto solo se ve
 * unos ms al primer navigate de cada ruta nueva.
 */
function PageSuspenseFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[60svh] place-items-center bg-fin-bg"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-fin-surface2" />
        <span className="sr-only">Cargando…</span>
      </div>
    </div>
  )
}

/** Fondo oscuro full-bleed para las pantallas del vecino fuera del AppShell. */
function VecinoBg() {
  return (
    <div className="min-h-[100svh] bg-fin-bg text-fin-ink">
      <Outlet />
    </div>
  )
}

/** Pantalla de error cuando el slug existe pero la ciudad no fue encontrada. */
function TenantNotFoundScreen({ slug }: { slug: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50 px-6">
      <div className="max-w-sm text-center">
        <p className="text-4xl">🏙️</p>
        <h1 className="mt-4 text-xl font-bold text-neutral-900">
          No encontramos esa ciudad
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          La ciudad <span className="font-semibold">"{slug}"</span> no existe o no está disponible.
          Probá con otra.
        </p>
        <button
          type="button"
          onClick={() => {
            clearTenantSlug()
            window.location.reload()
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-700 active:scale-[0.98]"
        >
          Ver ciudades disponibles
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { slug, config, loading, error } = useTenant()

  // Sin tenant resuelto → mostrar selector de ciudades.
  // El selector setea localStorage y recarga, cuando vuelve ya hay slug.
  if (!slug) {
    return (
      <ToastProvider>
        <Suspense fallback={<PageSuspenseFallback />}>
          <TenantSelectorPage />
        </Suspense>
      </ToastProvider>
    )
  }

  // Hay slug pero la config no cargó (ciudad inválida/404) → pantalla de error.
  // Solo mostramos el error cuando ya terminó de cargar (loading=false) y
  // efectivamente no hay config (config=null) y hay error — evitamos el flash
  // durante la carga inicial.
  if (!loading && !config && error) {
    return (
      <ToastProvider>
        <TenantNotFoundScreen slug={slug} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <HashRouter>
        {/* ApiSync usa useNavigate (manejo global de sesión-expirada del comercio)
            → DEBE ir dentro del HashRouter o tira "useNavigate may be used only in
            the context of a <Router>" y crashea toda la app (pantalla en blanco). */}
        <ApiSync />
        <Suspense fallback={<PageSuspenseFallback />}>
          <Routes>
            {/* App vecino — fondo oscuro (fuera del AppShell) */}
            <Route element={<VecinoBg />}>
              <Route path="plan" element={<PlanPage />} />
              <Route path="datos" element={<RegistroPage />} />
              <Route path="cupon/:id" element={<CuponDetailPage />} />
              <Route path="comercio/:id" element={<MerchantDetailPage />} />
              <Route path="activacion/:id" element={<CuponActivoPage />} />
            </Route>

            <Route element={<AppShell />}>
              <Route index element={<DescuentosPage />} />
              <Route path="locales" element={<DescuentosPage mode="locales" />} />
              <Route path="mapa" element={<MapaPage />} />
              <Route path="canjeados" element={<CanjeadosPage />} />
              <Route path="alertas" element={<AlertasPage />} />
              <Route path="perfil" element={<PerfilPage />} />
            </Route>

            {/* Rutas obsoletas del onboarding viejo (registro/login OTP) →
                redirigen al nuevo modelo: /datos es la captura liviana al canjear. */}
            <Route path="registro" element={<Navigate to="/datos" replace />} />
            <Route path="login" element={<Navigate to="/" replace />} />

            {/* Legal */}
            <Route path="legal/terminos" element={<TerminosPage />} />
            <Route path="legal/privacidad" element={<PrivacidadPage />} />

            {/* Panel comercio — rutas SIN shell (login OTP) */}
            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route path="admin/registro" element={<AdminSignupPage />} />
            <Route path="admin/canje/:activationId" element={<AdminConfirmarCanjePage />} />

            {/* N2: editor de cupón AHORA dentro del MerchantShell → hereda
                el PendingPaymentBanner sticky y el bottom nav del panel.
                Antes estaba fuera (regresión silenciosa del fix F7). */}
            <Route path="admin" element={<MerchantShell />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="validar" element={<AdminValidarPage />} />
              <Route path="cupones" element={<AdminCuponesPage />} />
              <Route path="cupones/nuevo" element={<AdminCuponEditPage />} />
              <Route path="cupones/:id/editar" element={<AdminCuponEditPage />} />
              <Route path="clientes" element={<AdminClientesPage />} />
              <Route path="clientes/:userId" element={<AdminClienteDetailPage />} />
              <Route path="estadisticas" element={<AdminEstadisticasPage />} />
              <Route path="whatsapp" element={<AdminWhatsappPage />} />
              <Route path="referidos" element={<AdminReferidosPage />} />
              <Route path="comercio" element={<AdminComercioPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </HashRouter>
      <InstallPrompt />
    </ToastProvider>
  )
}
