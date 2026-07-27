import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { userAuthRoutes } from '@/routes/user-auth'
import { App, User, Otp } from '@/models'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug S1-01 · P0] EL TEST QUE JUSTIFICA TODO EL TRABAJO:
// antes, sabiendo un dato público del vecino se entraba a su cuenta. Ahora, con
// el email de otro NO se entra: hay que probar que la casilla es tuya.

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
})

describe('POST /auth/claim — alta sin fricción', () => {
  it('vecino NUEVO entra al instante, SIN código', async () => {
    const r = await post('/claim', alta())
    expect(r.status).toBe(201)
    expect(r.body.created).toBe(true)
    expect(r.body.accessToken).toBeTruthy()
    expect(r.body.refreshToken).toBeTruthy()
    expect(r.body.user.email).toBe('maria@mail.com')
    // No se generó ningún código: el alta no lo necesita.
    expect(await Otp.countDocuments({})).toBe(0)
  })

  it('🔴 EL AGUJERO: con el email de otro NO se entra — pide código', async () => {
    await post('/claim', alta()) // María ya tiene cuenta

    // Un atacante que sabe su email intenta entrar.
    const r = await post('/claim', alta({ nombre: 'Atacante' }))

    expect(r.status).toBe(200)
    expect(r.body.created).toBe(false)
    expect(r.body.needsCode).toBe(true)
    // Lo esencial: NO le dimos sesión.
    expect(r.body.accessToken).toBeUndefined()
    expect(r.body.refreshToken).toBeUndefined()
  })

  it('el atacante NO puede pisarle el nombre a la víctima', async () => {
    await post('/claim', alta())
    await post('/claim', alta({ nombre: 'Atacante' }))
    const maria = await User.findOne({ appId, email: 'maria@mail.com' })
    expect(maria!.nombre).toBe('María González')
  })

  it('el email repetido genera un código para recuperar la cuenta', async () => {
    await post('/claim', alta())
    await post('/claim', alta())
    expect(await Otp.countDocuments({ appId, email: 'maria@mail.com', purpose: 'user' })).toBe(1)
  })

  it('sin email → 400 (cliente viejo con el bundle cacheado)', async () => {
    const r = await post('/claim', { nombre: 'Vieja App', telefono: '3329421234', acceptedTc: true })
    expect(r.status).toBe(400)
  })

  it('el mismo email en OTRA ciudad es otra cuenta', async () => {
    await App.create({
      _id: new Types.ObjectId(),
      slug: 'ciudadb',
      subdomain: 'ciudadb',
      nombre: 'B',
      ciudad: 'B',
      status: 'active',
    })
    await post('/claim', alta())
    const r = await post('/claim', alta(), 'ciudadb')
    expect(r.status).toBe(201)
    expect(r.body.created).toBe(true)
  })
})

describe('recuperar la cuenta con el código', () => {
  async function crearMaria() {
    const r = await post('/claim', alta())
    return r.body.user.id as string
  }

  it('con el código correcto entra y CONSERVA su cuenta (mismo id)', async () => {
    const idOriginal = await crearMaria()

    const pedido = await post('/request-otp', { email: 'maria@mail.com' })
    expect(pedido.status).toBe(200)
    expect(pedido.body.registered).toBe(true)
    const code = pedido.body._debugCode as string
    expect(code).toMatch(/^\d{6}$/)

    const entrada = await post('/verify-otp', { email: 'maria@mail.com', code })
    expect(entrada.status).toBe(200)
    expect(entrada.body.accessToken).toBeTruthy()
    expect(entrada.body.refreshToken).toBeTruthy()
    // Es la MISMA cuenta: su historial sigue colgando de este id.
    expect(entrada.body.user.id).toBe(idOriginal)
  })

  it('el código sirve UNA sola vez (anti-replay)', async () => {
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(200)
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(401)
  })

  it('código vencido → 401', async () => {
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    await Otp.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    expect((await post('/verify-otp', { email: 'maria@mail.com', code })).status).toBe(401)
  })

  it('código equivocado → 401, y a los 5 intentos corta', async () => {
    await crearMaria()
    await post('/request-otp', { email: 'maria@mail.com' })
    for (let i = 0; i < 5; i++) {
      expect((await post('/verify-otp', { email: 'maria@mail.com', code: '000000' })).status).toBe(401)
    }
    expect((await post('/verify-otp', { email: 'maria@mail.com', code: '000000' })).status).toBe(429)
  })

  it('email sin cuenta → registered:false y NO manda código', async () => {
    const r = await post('/request-otp', { email: 'nadie@mail.com' })
    expect(r.status).toBe(200)
    expect(r.body.registered).toBe(false)
    expect(await Otp.countDocuments({})).toBe(0)
  })

  it('un código de la ciudad A no sirve en la ciudad B', async () => {
    await App.create({
      _id: new Types.ObjectId(),
      slug: 'ciudadc',
      subdomain: 'ciudadc',
      nombre: 'C',
      ciudad: 'C',
      status: 'active',
    })
    await crearMaria()
    const code = (await post('/request-otp', { email: 'maria@mail.com' })).body._debugCode
    expect((await post('/verify-otp', { email: 'maria@mail.com', code }, 'ciudadc')).status).toBe(401)
  })

  it('los intentos fallidos CONCURRENTES también cuentan (no se puede evadir el corte)', async () => {
    await crearMaria()
    await post('/request-otp', { email: 'maria@mail.com' })
    // Cinco intentos equivocados a la vez: el contador tiene que registrarlos todos.
    await Promise.all(
      Array.from({ length: 5 }, () => post('/verify-otp', { email: 'maria@mail.com', code: '000000' })),
    )
    const otp = await Otp.findOne({ appId, email: 'maria@mail.com', purpose: 'user' })
    expect(otp!.attempts).toBe(5)
    // Y el siguiente intento ya está cortado.
    expect((await post('/verify-otp', { email: 'maria@mail.com', code: '000000' })).status).toBe(429)
  })
})
