import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getTenantSnapshot, loadTenantConfig } from '@/lib/tenant'

// Bootstrap multi-tenant: si tenemos un slug detectado, intentamos cargar la
// config del tenant ANTES del primer render para que el branding ya esté
// aplicado al :root (CSS vars) cuando aparece la UI.
const initialSlug = getTenantSnapshot().slug
if (initialSlug) {
  // No bloqueamos render — si la config tarda, la UI muestra primero el
  // branding default y se re-pinta cuando llega.
  // El <title> y el branding los aplica loadTenantConfig → applyBrandingToDom
  // (única fuente; corre también al cambiar de ciudad). No lo duplicamos acá.
  void loadTenantConfig(initialSlug)
}

// Axe-core sólo en dev: loguea violaciones de accesibilidad en la consola
// cada vez que el DOM cambia. No corre en prod (gracias al guard de import.meta.env
// + dynamic import, no se incluye en el bundle de prod).
if (import.meta.env.DEV) {
  void import('@axe-core/react').then(({ default: axe }) =>
    import('react').then((React) =>
      import('react-dom').then((ReactDOM) => axe(React, ReactDOM, 1000)),
    ),
  )
}

// Service worker: sólo en producción. Registra el SW generado por Workbox,
// que incluye los handlers de Web Push (importScripts push-sw.js). En dev no
// hay SW (devOptions off), por eso las notificaciones se prueban en build/PWA.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch((err) => console.error('[sw] registro falló', err))
  })
}

// El ErrorBoundary envuelve TODO: sin él, cualquier throw en render dejaba la
// pantalla en blanco, sin mensaje ni salida. El caso frecuente es deployar
// mientras el vecino tiene la app abierta (rutas `lazy()` → chunk viejo que ya
// no existe). Ver components/ErrorBoundary.tsx. [cazabug loop2]
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
