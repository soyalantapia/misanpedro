import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getTenantSnapshot, loadTenantConfig } from '@/lib/tenant'

// Bootstrap multi-tenant: si tenemos un slug detectado, intentamos cargar la
// config del tenant ANTES del primer render para que el branding ya esté
// aplicado al :root (CSS vars) cuando aparece la UI.
const initialSlug = getTenantSnapshot().slug
if (initialSlug) {
  // No bloqueamos render — si la config tarda, la UI muestra primero el
  // branding default y se re-pinta cuando llega.
  void loadTenantConfig(initialSlug).then((config) => {
    // MO03: actualizamos el <title> del browser con el nombre real del tenant
    // (default y fallback: "Mi San Pedro").
    if (config?.nombre) {
      document.title = `${config.nombre} · Descuentos vecinales`
    }
  })
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
