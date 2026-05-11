import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Importante: NO precargamos seed demo aquí. La app trabaja exclusivamente
// contra el backend (Mongo Atlas). Si querés volver a habilitar el modo
// demo offline para gh-pages, importá y llamá ensureDemoDataLoaded() de
// '@/lib/demoSeeder' y refreshDemoActiveCoupon() acá.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
