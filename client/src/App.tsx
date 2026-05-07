import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { MerchantShell } from '@/layouts/MerchantShell'
import { DescuentosPage } from '@/pages/DescuentosPage'
import { MisCuponesPage } from '@/pages/MisCuponesPage'
import { CanjeadosPage } from '@/pages/CanjeadosPage'
import { CuponDetailPage } from '@/pages/CuponDetailPage'
import { MerchantDetailPage } from '@/pages/MerchantDetailPage'
import { RegistroPage } from '@/pages/RegistroPage'
import { CuponActivoPage } from '@/pages/CuponActivoPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminSignupPage } from '@/pages/admin/AdminSignupPage'
import { AdminClienteDetailPage } from '@/pages/admin/AdminClienteDetailPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminValidarPage } from '@/pages/admin/AdminValidarPage'
import { AdminConfirmarCanjePage } from '@/pages/admin/AdminConfirmarCanjePage'
import { AdminCuponesPage } from '@/pages/admin/AdminCuponesPage'
import { AdminCuponEditPage } from '@/pages/admin/AdminCuponEditPage'
import { AdminClientesPage } from '@/pages/admin/AdminClientesPage'
import { AdminComercioPage } from '@/pages/admin/AdminComercioPage'
import { AdminWhatsappPage } from '@/pages/admin/AdminWhatsappPage'
import { ToastProvider } from '@/components/Toast'
import { InstallPrompt } from '@/components/InstallPrompt'
import { DemoBar } from '@/components/DemoBar'

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          {/* App vecino */}
          <Route path="registro" element={<RegistroPage />} />
          <Route path="cupon/:id" element={<CuponDetailPage />} />
          <Route path="comercio/:id" element={<MerchantDetailPage />} />
          <Route path="activacion/:id" element={<CuponActivoPage />} />

          <Route element={<AppShell />}>
            <Route index element={<DescuentosPage />} />
            <Route path="mis-cupones" element={<MisCuponesPage />} />
            <Route path="canjeados" element={<CanjeadosPage />} />
          </Route>

          {/* Panel comercio */}
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route path="admin/registro" element={<AdminSignupPage />} />
          <Route path="admin/canje/:activationId" element={<AdminConfirmarCanjePage />} />
          <Route path="admin/cupones/nuevo" element={<AdminCuponEditPage />} />
          <Route path="admin/cupones/:id/editar" element={<AdminCuponEditPage />} />

          <Route path="admin" element={<MerchantShell />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="validar" element={<AdminValidarPage />} />
            <Route path="cupones" element={<AdminCuponesPage />} />
            <Route path="clientes" element={<AdminClientesPage />} />
            <Route path="clientes/:userId" element={<AdminClienteDetailPage />} />
            <Route path="whatsapp" element={<AdminWhatsappPage />} />
            <Route path="comercio" element={<AdminComercioPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </HashRouter>
      <DemoBar />
      <InstallPrompt />
    </ToastProvider>
  )
}
