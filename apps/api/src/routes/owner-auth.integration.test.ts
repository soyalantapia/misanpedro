import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ownerRoutes } from '@/routes/owner'
import { Owner, Otp } from '@/models'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug] Regresión del gate atómico anti-fuerza-bruta de `owner/auth/verify-otp`.
// Antes del fix (commit 951f7c3) este flujo — YA EN PRODUCCIÓN — no tenía NINGÚN
// test que tocara `attempts`/429: support.integration.test.ts monta ownerRoutes
// pero sólo ejercita el modo soporte (support-session/support-exchange), nunca el
// login OTP del owner. Sin cobertura acá, un cambio futuro podía reintroducir el
// TOCTOU sin que la suite se enterara. Mismo patrón que user-auth y merchant-auth.

let mongod: MongoMemoryServer

const api = new Hono()
api.route('/owner', ownerRoutes)

async function requestOtp(email: string) {
  const res = await api.request('/owner/auth/request-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

async function verifyOtp(email: string, code: string, extraHeaders: Record<string, string> = {}) {
  const res = await api.request('/owner/auth/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ email, code }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Owner.createIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([Owner.deleteMany({}), Otp.deleteMany({})])
  _resetRateLimits()
})

describe('owner /auth/verify-otp — gate anti-fuerza-bruta (regresión TOCTOU)', () => {
  async function crearOwner(email = 'gate@micuidad.com') {
    await Owner.create({ email, nombre: 'Gate Test', rol: 'super', enabled: true })
  }

  it('código equivocado → 401, y al 6to intento corta con 429', async () => {
    await crearOwner()
    await requestOtp('gate@micuidad.com')
    for (let i = 0; i < 5; i++) {
      const r = await verifyOtp('gate@micuidad.com', '000000')
      expect(r.status).toBe(401)
    }
    const sexto = await verifyOtp('gate@micuidad.com', '000000')
    expect(sexto.status).toBe(429)
  })

  it('una RÁFAGA concurrente no puede superar el límite (gate atómico)', async () => {
    await crearOwner()
    await requestOtp('gate@micuidad.com')
    // 20 intentos equivocados a la vez, cada uno con un User-Agent distinto: el
    // rate-limiter externo (10/min) clave por UA, así que sin esto tapa al gate
    // del OTP que queremos probar (mismo truco usado al verificar el fix).
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        verifyOtp('gate@micuidad.com', '000000', { 'user-agent': `burst-owner-${i}` }),
      ),
    )
    const otp = await Otp.findOne({ email: 'gate@micuidad.com', purpose: 'owner' })
    // Nunca por encima del máximo, sin importar cuántas llegaron a la vez.
    expect(otp!.attempts).toBe(5)
  })
})
