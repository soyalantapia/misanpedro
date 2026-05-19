import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { ShellLayout } from './layouts/ShellLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AppsPage } from './pages/AppsPage'
import { NewAppPage } from './pages/NewAppPage'
import { AppDetailPage } from './pages/AppDetailPage'
import { MerchantsPage } from './pages/MerchantsPage'
import { UsersPage } from './pages/UsersPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />
        <Route element={<ShellLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="apps" element={<AppsPage />} />
          <Route path="apps/nueva" element={<NewAppPage />} />
          <Route path="apps/:id" element={<AppDetailPage />} />
          <Route path="comercios" element={<MerchantsPage />} />
          <Route path="vecinos" element={<UsersPage />} />
          <Route path="pagos" element={<SubscriptionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
