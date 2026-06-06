import { test, expect } from '@playwright/test'

test.describe('Vecino · smoke E2E', () => {
  test('home carga con branding y nav mobile (Mapa/Locales/Cupones/Alertas/Perfil)', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Mi San Pedro/)
    const nav = page.getByRole('navigation', { name: 'Navegación móvil' })
    await expect(nav).toBeVisible()
    for (const label of ['Mapa', 'Locales', 'Cupones', 'Alertas', 'Perfil']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible()
    }
  })

  test('Perfil sin sesión redirige a /datos (registro)', async ({ page }) => {
    await page.goto('/#/perfil')
    await expect(page).toHaveURL(/#\/datos/)
    await expect(page.getByRole('heading', { name: /Completá tus datos/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Volver/ })).toBeVisible()
  })

  test('Registro /datos muestra el form con hint de WhatsApp', async ({ page }) => {
    await page.goto('/#/datos')
    await expect(page.getByRole('heading', { name: /Completá tus datos/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Volver/ })).toBeVisible()
    await expect(page.getByPlaceholder(/3329 555444/)).toBeVisible()
  })

  test('la bottom-nav navega (Cupones → Locales)', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Navegación móvil' })
    await nav.getByRole('link', { name: 'Locales' }).click()
    await expect(page).toHaveURL(/#\/locales/)
  })
})
