import { test, expect } from '@playwright/test'

test.describe('Vecino · smoke E2E', () => {
  test('home carga con branding Cuponcito y nav mobile', async ({ page }) => {
    await page.goto('/')
    // Branding
    await expect(page).toHaveTitle(/Cuponcito/)
    await expect(page.getByText('Cuponcito', { exact: true })).toBeVisible()
    // Header
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Bottom nav presente con 4 items
    const nav = page.getByRole('navigation', { name: 'Navegación móvil' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Descuentos' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Mis cupones' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Canjeados' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Perfil' })).toBeVisible()
  })

  test('navega a login desde Perfil sin sesión', async ({ page }) => {
    await page.goto('/#/perfil')
    // Sin sesión → redirige a login
    await expect(page).toHaveURL(/#\/login/)
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible()
    // Botón "Volver" (no "Cancelar" — F5 del audit)
    await expect(page.getByRole('link', { name: /Volver/ })).toBeVisible()
  })

  test('validación inline de email sin submit nativo del browser', async ({ page }) => {
    await page.goto('/#/login')
    // Submit con email vacío → debe mostrar error in-app (no popup browser)
    await page.getByRole('button', { name: /Enviarme el código/ }).click()
    await expect(page.getByRole('alert')).toContainText(/email/i)
  })

  test('registro muestra el form con hint de WhatsApp con ejemplo', async ({ page }) => {
    await page.goto('/#/registro')
    await expect(page.getByText(/Creá tu cuenta/i)).toBeVisible()
    // F5: el "Volver" arriba (no "Cancelar")
    await expect(page.getByRole('link', { name: /Volver/ })).toBeVisible()
    // MO11: hint inline con ejemplo de WhatsApp
    await expect(
      page.getByText(/\+54 9 3329 555444/),
    ).toBeVisible()
  })
})
