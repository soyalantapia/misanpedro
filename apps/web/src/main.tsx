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
  void loadTenantConfig(initialSlug)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
