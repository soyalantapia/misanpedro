import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { ShellLayout } from './layouts/ShellLayout'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
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
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />
        {/* O1: password recovery — forgot pide email, reset cambia contraseña con token */}
        <Route
          path="/forgot-password"
          element={
            <AuthLayout>
              <ForgotPasswordPage />
            </AuthLayout>
          }
        />
        <Route
          path="/reset-password"
          element={
            <AuthLayout>
              <ResetPasswordPage />
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
