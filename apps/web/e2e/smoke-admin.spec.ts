import { test, expect } from '@playwright/test'

test.describe('Comerciante · smoke E2E', () => {
  test('login admin carga con campos email + password', async ({ page }) => {
    await page.goto('/#/admin/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Ingresar|Iniciar/i })).toBeVisible()
  })

  test('signup admin muestra pricing $25.000 final (B1)', async ({ page }) => {
    await page.goto('/#/admin/registro')
    // Stepper visible
    await expect(page.getByText(/Datos del comercio/i).first()).toBeVisible()
    // Precio visible en el header del signup
    await expect(page.getByText(/\$25\.000/)).toBeVisible()
  })

  test('legales: T&C incluye identidad jurídica B2 + precio B1', async ({ page }) => {
    await page.goto('/#/legal/terminos')
    // B2: CUIT del responsable visible
    await expect(page.getByText(/20-43316638-9/)).toBeVisible()
    // B2: condición fiscal monotributo
    await expect(page.getByText(/Monotributista/i).first()).toBeVisible()
    // B1: precio $25.000 final, sin mención de "+ IVA"
    await expect(page.getByText(/\$25\.000 ARS finales/i)).toBeVisible()
    await expect(page.getByText(/factura C/i).first()).toBeVisible()
  })

  test('legales: Privacidad incluye responsable Ley 25.326', async ({ page }) => {
    await page.goto('/#/legal/privacidad')
    await expect(page.getByText(/Ley 25.326/i).first()).toBeVisible()
    await expect(page.getByText(/20-43316638-9/)).toBeVisible()
    await expect(page.getByText(/Alan Naim Tapia/)).toBeVisible()
  })
})
