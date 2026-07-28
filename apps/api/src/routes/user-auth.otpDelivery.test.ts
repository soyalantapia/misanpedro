import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Mockeamos el envío real de mail: así podemos simular una caída de SMTP en
// producción sin depender de un transporte real. [cazabug]
vi.mock('@/services/email.service', () => ({
  sendOtpCode: vi.fn(),
}))

import { userAuthRoutes } from '@/routes/user-auth'
import { App, User, Otp } from '@/models'
import { _resetRateLimits } from '@/middleware/security'
import { sendOtpCode } from '@/services/email.service'

const sendOtpCodeMock = vi.mocked(sendOtpCode)

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()

const api = new Hono()
api.route('/auth', userAuthRoutes)

async function post(path: string, body: unknown, slug = 'ciudada') {
  const res = await api.request(`/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

const alta = (over: Record<string, unknown> = {}) => ({
  nombre: 'María González',
  email: 'maria@mail.com',
  telefono: '3329421234',
  acceptedTc: true,
  ...over,
})

/** Corre `fn` con NODE_ENV='production' y lo restaura al terminar (incluso si
 *  `fn` tira). Igual que `process.env.NODE_ENV` se lee dinámico en las rutas
 *  (no el `env.NODE_ENV` cacheado), esto alcanza para activar el camino de
 *  producción sin necesitar un proceso separado. */
async function withProdEnv(fn: () => Promise<void>) {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await fn()
  } finally {
    process.env.NODE_ENV = prev
  }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.syncIndexes()
  await App.create({
    _id: appId,
    slug: 'ciudada',
    subdomain: 'ciudada',
    nombre: 'Mi CiudadA',
    ciudad: 'A',
    status: 'active',
    phonePrefix: '+54',
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Otp.deleteMany({})])
  _resetRateLimits()
  sendOtpCodeMock.mockReset()
  sendOtpCodeMock.mockResolvedValue({ ok: true, id: 'mock' })
})

// [cazabug] El vecino NO puede quedar afuera EN SILENCIO si el mail no sale.
// Comercio y owner ya esperan el envío en producción y devuelven 503 si falla;
// el vecino era fire-and-forget (`.catch` que sólo logueaba) — se descartaba el
// `{ok:false}` y la pantalla decía igual "te mandamos un código" aunque nunca
// hubiera salido.
describe('/claim (rama existing) y /request-otp: en producción esperan el envío', () => {
  it('/claim con email EXISTENTE → 503 si el mail no sale (antes: needsCode:true en silencio)', async () => {
    await post('/claim', alta()) // María ya tiene cuenta (creada fuera de "producción")
    await withProdEnv(async () => {
      sendOtpCodeMock.mockResolvedValueOnce({ ok: false, error: 'smtp caído' })
      const r = await post('/claim', alta({ nombre: 'Atacante' }))
      expect(r.status).toBe(503)
      expect(r.body.ok).toBe(false)
      expect(r.body.needsCode).toBeUndefined()
      expect(typeof r.body.error).toBe('string')
    })
  })

  it('/request-otp → 503 si el mail no sale', async () => {
    await post('/claim', alta())
    await withProdEnv(async () => {
      sendOtpCodeMock.mockResolvedValueOnce({ ok: false, error: 'smtp caído' })
      const r = await post('/request-otp', { email: 'maria@mail.com' })
      expect(r.status).toBe(503)
      expect(r.body.ok).toBe(false)
    })
  })

  it('la carrera de alta simultánea (11000) también espera el envío y avisa con 503', async () => {
    await post('/claim', alta())
    await withProdEnv(async () => {
      sendOtpCodeMock.mockResolvedValueOnce({ ok: false, error: 'smtp caído' })
      // Mismo email de María: dispara el branch "existing" (equivalente al de
      // la carrera de índice único a los fines de este test — ambos llaman a
      // issueUserOtp con el mismo contrato de espera+503).
      const r = await post('/claim', alta({ nombre: 'Otro Atacante' }))
      expect(r.status).toBe(503)
    })
  })

  it('si el mail SÍ sale en producción, sigue respondiendo needsCode:true', async () => {
    await post('/claim', alta())
    await withProdEnv(async () => {
      sendOtpCodeMock.mockResolvedValueOnce({ ok: true, id: 'x' })
      const r = await post('/claim', alta({ nombre: 'Atacante' }))
      expect(r.status).toBe(200)
      expect(r.body.needsCode).toBe(true)
    })
  })

  it('fuera de producción sigue siendo fire-and-forget: needsCode:true aunque el mail "falle"', async () => {
    await post('/claim', alta())
    sendOtpCodeMock.mockRejectedValueOnce(new Error('smtp caído'))
    const r = await post('/claim', alta({ nombre: 'Atacante' }))
    expect(r.status).toBe(200)
    expect(r.body.needsCode).toBe(true)
  })
})

// [cazabug] `otpRequestLimiter` es 5/h "porque cada uno manda un mail", pero la
// rama `existing` de /claim TAMBIÉN manda mail y corría sólo bajo `claimLimiter`
// (30/h, pensado para el alta nueva que NO manda mail). Conociendo el email de
// una víctima se le podían disparar hasta 30 mails/hora, evadiendo el cap de 5.
describe('/claim (rama existing) comparte el límite de OTP (5/h), no el de alta (30/h)', () => {
  it('al 6º intento con el mismo email EXISTENTE, corta con 429 (antes: pasaban los 30 de claimLimiter)', async () => {
    await post('/claim', alta()) // alta real de María — no consume otpRequestLimiter
    for (let i = 0; i < 5; i++) {
      const r = await post('/claim', alta({ nombre: 'Atacante' }))
      expect(r.status).toBe(200)
    }
    const sexto = await post('/claim', alta({ nombre: 'Atacante' }))
    expect(sexto.status).toBe(429)
  })

  it('el cupo es COMPARTIDO con /request-otp (mismo bucket, no se puede evadir alternando)', async () => {
    await post('/claim', alta())
    for (let i = 0; i < 5; i++) {
      const r = await post('/request-otp', { email: 'maria@mail.com' })
      expect(r.status).toBe(200)
    }
    const r = await post('/claim', alta({ nombre: 'Atacante' }))
    expect(r.status).toBe(429)
  })

  it('el alta de cuentas NUEVAS no se ve afectada: sigue bajo el cupo alto (30/h)', async () => {
    // 6 altas nuevas (emails distintos) no deben verse afectadas por el cupo bajo
    // de OTP: esa rama no manda mail y varios comercios comparten IP.
    for (let i = 0; i < 6; i++) {
      const r = await post('/claim', alta({ email: `vecino${i}@mail.com`, nombre: `Vecino ${i}` }))
      expect(r.status).toBe(201)
    }
  })
})
