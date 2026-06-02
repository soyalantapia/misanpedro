import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import {
  merchantOtpRequestSchema,
  merchantOtpVerifySchema,
  merchantSignupSchema,
} from '@misanpedro/shared'
import { Otp } from '@/models'

/**
 * Regresión del login OTP del comercio (passwordless). Cubre:
 *  - schemas de request/verify del OTP
 *  - alta SIN contraseña (OTP-only) + compat con clientes que aún la manden
 *  - default `purpose='user'` del modelo Otp (no rompe OTPs del vecino)
 */

describe('merchant OTP — schemas', () => {
  it('request acepta email y lo normaliza a minúsculas', () => {
    const r = merchantOtpRequestSchema.safeParse({ email: 'Dueno@Comercio.COM' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('dueno@comercio.com')
  })
  it('request rechaza email inválido o ausente', () => {
    expect(merchantOtpRequestSchema.safeParse({ email: 'no-es-email' }).success).toBe(false)
    expect(merchantOtpRequestSchema.safeParse({}).success).toBe(false)
  })
  it('verify exige código de exactamente 6 dígitos', () => {
    expect(merchantOtpVerifySchema.safeParse({ email: 'a@b.com', code: '123456' }).success).toBe(true)
    expect(merchantOtpVerifySchema.safeParse({ email: 'a@b.com', code: '12345' }).success).toBe(false)
    expect(merchantOtpVerifySchema.safeParse({ email: 'a@b.com', code: 'abcdef' }).success).toBe(false)
  })
})

describe('merchantSignupSchema — OTP-only (sin contraseña)', () => {
  const base = {
    comercio: {
      nombre: 'Pizzería Centro',
      categoria: 'gastronomia',
      direccion: 'Calle Falsa 123',
      telefono: '3329-123456',
    },
    admin: { nombre: 'Juan Pérez', email: 'juan@pizza.com' },
    acceptedTc: true as const,
  }
  it('acepta alta SIN contraseña', () => {
    expect(merchantSignupSchema.safeParse(base).success).toBe(true)
  })
  it('sigue aceptando alta CON contraseña (compat cliente viejo)', () => {
    const withPwd = { ...base, admin: { ...base.admin, password: 'supersegura1' } }
    expect(merchantSignupSchema.safeParse(withPwd).success).toBe(true)
  })
})

describe('Otp model — purpose discrimina vecino/comercio', () => {
  it('default purpose = "user" (backward-compatible)', () => {
    const otp = new Otp({
      appId: new Types.ObjectId(),
      email: 'a@b.com',
      codeHash: 'x',
      expiresAt: new Date(),
    })
    expect(otp.purpose).toBe('user')
  })
  it('acepta purpose = "merchant"', () => {
    const otp = new Otp({
      appId: new Types.ObjectId(),
      email: 'a@b.com',
      purpose: 'merchant',
      codeHash: 'x',
      expiresAt: new Date(),
    })
    expect(otp.purpose).toBe('merchant')
  })
})
