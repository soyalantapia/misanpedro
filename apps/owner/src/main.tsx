import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Sin ErrorBoundary, cualquier throw en render dejaba al super-admin con la
// pantalla en blanco — y este panel es justo desde donde se apagan incendios.
// [cazabug loop2]
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
