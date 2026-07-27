import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { App, MerchantUser, Otp } from '@/models'
import { _resetRateLimits } from '@/middleware/security'

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

async function verifyOtp(
  slug: string,
  email: string,
  code: string,
  extraHeaders: Record<string, string> = {},
) {
  const res = await app.request('/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug, ...extraHeaders },
    body: JSON.stringify({ email, code }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
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
  // El limiter de /request-otp es 5/h por cliente y en tests todas las requests
  // comparten IP: sin este reset, agregar un caso hace fallar por 429 a otro que
  // no tiene nada que ver (acoplamiento entre tests).
  _resetRateLimits()
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

  // [cazabug S1-04 + S2-03 · P1] El código OTP es bearer-equivalente (5 min). El
  // invariante que importa NO es el nombre del entorno sino a qué base apunta el
  // server: si la Mongo es REMOTA, esto no es una máquina de desarrollo y el
  // código no puede salir ni por log ni por HTTP —aunque NODE_ENV diga otra cosa,
  // que es exactamente lo que pasa en un deploy que se olvidó la variable.
  it('con base REMOTA no revela el OTP ni por log ni en la respuesta', async () => {
    await MerchantUser.create({
      appId,
      merchantId: new Types.ObjectId(),
      email: 'log@comercio.com',
      nombre: 'Log Test',
    })
    const original = process.env.MONGODB_URI
    process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster0.l1lvvlb.mongodb.net/'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { body } = await requestOtp('testcity', 'log@comercio.com')
      expect(body.ok).toBe(true)
      // Ni en la respuesta…
      expect(body._debugCode).toBeUndefined()
      // …ni en los logs.
      const otpLineLogged = spy.mock.calls.some(
        (args) => typeof args[0] === 'string' && args[0].startsWith('[otp/merchant]'),
      )
      expect(otpLineLogged).toBe(false)
    } finally {
      spy.mockRestore()
      process.env.MONGODB_URI = original
    }
  })

  it('con base LOCAL (desarrollo real) sí devuelve el código para poder testear', async () => {
    await MerchantUser.create({
      appId,
      merchantId: new Types.ObjectId(),
      email: 'local@comercio.com',
      nombre: 'Local Test',
    })
    const { body } = await requestOtp('testcity', 'local@comercio.com')
    expect(body._debugCode).toMatch(/^\d{6}$/)
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

// [cazabug] Regresión del gate atómico anti-fuerza-bruta de `verify-otp`. Antes
// del fix (commit 951f7c3) este flujo — YA EN PRODUCCIÓN — no tenía NINGÚN test
// que tocara `attempts`/429, ni siquiera en secuencia: un cambio futuro podía
// reintroducir el TOCTOU acá sin que la suite se enterara. Mismo par de casos que
// ya cubre user-auth.integration.test.ts, adaptado al comercio.
describe('merchant /verify-otp — gate anti-fuerza-bruta (regresión TOCTOU)', () => {
  async function crearComercio(email = 'gate@comercio.com') {
    await MerchantUser.create({
      appId,
      merchantId: new Types.ObjectId(),
      email,
      nombre: 'Gate Test',
    })
  }

  it('código equivocado → 401, y al 6to intento corta con 429', async () => {
    await crearComercio()
    await requestOtp('testcity', 'gate@comercio.com')
    for (let i = 0; i < 5; i++) {
      const r = await verifyOtp('testcity', 'gate@comercio.com', '000000')
      expect(r.status).toBe(401)
    }
    const sexto = await verifyOtp('testcity', 'gate@comercio.com', '000000')
    expect(sexto.status).toBe(429)
  })

  it('una RÁFAGA concurrente no puede superar el límite (gate atómico)', async () => {
    await crearComercio()
    await requestOtp('testcity', 'gate@comercio.com')
    // 20 intentos equivocados a la vez, cada uno con un User-Agent distinto: el
    // rate-limiter externo (10/min) clave por UA, así que sin esto tapa al gate
    // del OTP que queremos probar (mismo truco usado al verificar el fix).
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        verifyOtp('testcity', 'gate@comercio.com', '000000', {
          'user-agent': `burst-merchant-${i}`,
        }),
      ),
    )
    const otp = await Otp.findOne({ appId, email: 'gate@comercio.com', purpose: 'merchant' })
    // Nunca por encima del máximo, sin importar cuántas llegaron a la vez.
    expect(otp!.attempts).toBe(5)
  })
})
