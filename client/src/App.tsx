import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { DescuentosPage } from '@/pages/DescuentosPage'
import { MisCuponesPage } from '@/pages/MisCuponesPage'
import { CanjeadosPage } from '@/pages/CanjeadosPage'
import { ToastProvider } from '@/components/Toast'

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DescuentosPage />} />
            <Route path="mis-cupones" element={<MisCuponesPage />} />
            <Route path="canjeados" element={<CanjeadosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
