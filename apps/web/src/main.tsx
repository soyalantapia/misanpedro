import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureDemoDataLoaded, refreshDemoActiveCoupon } from '@/lib/demoSeeder'

ensureDemoDataLoaded()
refreshDemoActiveCoupon()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
