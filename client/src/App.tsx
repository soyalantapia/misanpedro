import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { DescuentosPage } from '@/pages/DescuentosPage'
import { MisCuponesPage } from '@/pages/MisCuponesPage'
import { CanjeadosPage } from '@/pages/CanjeadosPage'
import { CuponDetailPage } from '@/pages/CuponDetailPage'
import { MerchantDetailPage } from '@/pages/MerchantDetailPage'
import { RegistroPage } from '@/pages/RegistroPage'
import { CuponActivoPage } from '@/pages/CuponActivoPage'
import { ToastProvider } from '@/components/Toast'

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="registro" element={<RegistroPage />} />
          <Route path="cupon/:id" element={<CuponDetailPage />} />
          <Route path="comercio/:id" element={<MerchantDetailPage />} />
          <Route path="activacion/:id" element={<CuponActivoPage />} />

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
