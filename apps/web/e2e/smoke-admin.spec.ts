import { test, expect } from '@playwright/test'

test.describe('Comerciante · smoke E2E', () => {
  test('login admin es OTP (email + "Enviar código", sin contraseña)', async ({ page }) => {
    await page.goto('/#/admin/login')
    await expect(page.getByRole('button', { name: /Enviar código/i })).toBeVisible()
    await expect(page.getByText(/te mandamos un código/i)).toBeVisible()
    // Ya NO hay login con contraseña (migró a OTP)
    await expect(page.getByLabel(/Contraseña/i)).toHaveCount(0)
  })

  test('signup admin: 3 meses gratis (sin tarjeta)', async ({ page }) => {
    await page.goto('/#/admin/registro')
    await expect(page.getByText(/Datos del comercio/i).first()).toBeVisible()
    await expect(page.getByText(/3 meses gratis/i).first()).toBeVisible()
  })

  test('legales T&C: $50.000 ARS finales + identidad jurídica', async ({ page }) => {
    await page.goto('/#/legal/terminos')
    await expect(page.getByText(/\$50\.000 ARS finales/i).first()).toBeVisible()
    await expect(page.getByText(/20-43316638-9/).first()).toBeVisible()
    await expect(page.getByText(/Monotributista/i).first()).toBeVisible()
  })

  test('legales Privacidad: responsable Ley 25.326', async ({ page }) => {
    await page.goto('/#/legal/privacidad')
    await expect(page.getByText(/Ley 25.326/i).first()).toBeVisible()
    await expect(page.getByText(/20-43316638-9/).first()).toBeVisible()
    await expect(page.getByText(/Alan Naim Tapia/)).toBeVisible()
  })
})
