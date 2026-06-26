import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { App, MerchantUser, Otp } from '@/models'

// Regresión del onboarding (login del comercio): POST /request-otp expone el flag
// `registered` para que el front sepa si mandar al alta (email SIN comercio) o al
// paso del código OTP (email CON comercio). AdminLoginPage redirige a
// /admin/registro?email=&nuevo=1 cuando registered:false.
// NODE_ENV='test' (setup.ts) → el handler toma el path dev: devuelve _debugCode y
// no hace envío real de email. El tenant se resuelve por el header X-Tenant-Slug.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const otherAppId = new Types.ObjectId()

// merchantAuthRoutes ya aplica tenantContext internamente → el tenant se resuelve
// por el header X-Tenant-Slug contra un App sembrado en la DB.
const app = new Hono()
app.route('/', merchantAuthRoutes)

async function requestOtp(slug: string, email: string) {
  const res = await app.request('/request-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug },
    body: JSON.stringify({ email }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await App.create([
    { _id: appId, slug: 'testcity', subdomain: 'testcity', nombre: 'Mi Test', ciudad: 'Test City', status: 'active' },
    { _id: otherAppId, slug: 'othercity', subdomain: 'othercity', nombre: 'Mi Otra', ciudad: 'Otra City', status: 'active' },
  ])
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await MerchantUser.deleteMany({})
  await Otp.deleteMany({})
})

describe('merchant /request-otp — flag registered (integración Mongo real)', () => {
  it('email SIN comercio en la ciudad → { ok:true, registered:false } y NO crea OTP', async () => {
    const { status, body } = await requestOtp('testcity', 'nuevo@comercio.com')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.registered).toBe(false)
    expect(body._debugCode).toBeUndefined()
    expect(await Otp.countDocuments({ email: 'nuevo@comercio.com' })).toBe(0)
  })

  it('email CON comercio → { ok:true, registered:true } y crea el OTP', async () => {
    await MerchantUser.create({
      appId,
      merchantId: new Types.ObjectId(),
      email: 'duenio@comercio.com',
      nombre: 'Dueño Test',
    })
    const { status, body } = await requestOtp('testcity', 'duenio@comercio.com')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.registered).toBe(true)
    expect(
      await Otp.countDocuments({ appId, email: 'duenio@comercio.com', purpose: 'merchant' }),
    ).toBe(1)
  })

  it('scoping por tenant: el mismo email registrado en OTRA ciudad cuenta como sin comercio acá', async () => {
    // Registrado solo en otherAppId, NO en el tenant actual (appId / 'testcity').
    await MerchantUser.create({
      appId: otherAppId,
      merchantId: new Types.ObjectId(),
      email: 'multi@comercio.com',
      nombre: 'Multi Ciudad',
    })
    const { body } = await requestOtp('testcity', 'multi@comercio.com')
    expect(body.registered).toBe(false)
  })

  it('normaliza el email (espacios + mayúsculas) antes de buscar el comercio', async () => {
    await MerchantUser.create({
      appId,
      merchantId: new Types.ObjectId(),
      email: 'Case@Comercio.com', // el model lo guarda lowercase
      nombre: 'Case Test',
    })
    // Pedimos con espacios y mayúsculas → el schema trimea+lowercasea → matchea
    // el MerchantUser guardado en minúsculas → registered:true (sin 400).
    const { status, body } = await requestOtp('testcity', '  CASE@COMERCIO.COM  ')
    expect(status).toBe(200)
    expect(body.registered).toBe(true)
  })
})
