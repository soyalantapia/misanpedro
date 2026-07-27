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
