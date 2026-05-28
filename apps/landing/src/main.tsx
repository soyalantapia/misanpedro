import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { getTenantSnapshot, loadTenantConfig } from '@/lib/tenant'

// Si hay un tenant detectado (sanpedro.misanpedro.app), cargamos su config
// del API para aplicar branding antes del primer paint. Si no hay (misanpedro.app),
// arrancamos con el branding paraguas default.
if (getTenantSnapshot().slug) {
  void loadTenantConfig()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
