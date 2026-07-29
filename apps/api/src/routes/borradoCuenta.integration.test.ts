import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { userAuthRoutes } from '@/routes/user-auth'
import { App, User, Activation, Redemption, CustomerNote, PushSubscription } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] Derecho de supresión (Ley 25.326): "eliminamos tus datos
// personales" tiene que ser cierto.
//
// Se borraban las activaciones y se anonimizaban los canjes, pero quedaban vivas
// DOS cosas: las notas privadas que el comercio escribió sobre el vecino (texto
// libre de hasta 1000 caracteres, donde perfectamente puede haber datos de salud
// o de consumo) y su suscripción push (el dispositivo seguía siendo notificable).
//
// El canje se ANONIMIZA en vez de borrarse porque es el registro de venta del
// comercio: sin userId ya no es un dato personal. Una nota de texto libre sobre
// una persona, en cambio, no se puede anonimizar sacándole el id — el texto
// sigue siendo sobre ella. Por eso se borra.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const otroAppId = new Types.ObjectId()
const merchantId = new Types.ObjectId()

const api = new Hono()
api.route('/auth', userAuthRoutes)

let vecino: any

function auth() {
  return 'Bearer ' + signAccessToken({ sub: String(vecino._id), type: 'user', appId: String(appId) })
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.syncIndexes()
  await App.create([
    { _id: appId, slug: 'sanpedro', subdomain: 'sanpedro', nombre: 'Mi San Pedro', ciudad: 'SP', status: 'active' },
    { _id: otroAppId, slug: 'ramallo', subdomain: 'ramallo', nombre: 'Mi Ramallo', ciudad: 'RA', status: 'active' },
  ])
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Activation.deleteMany({}),
    Redemption.deleteMany({}),
    CustomerNote.deleteMany({}),
    PushSubscription.deleteMany({}),
  ])
  _resetRateLimits()
  vecino = await User.create({
    appId,
    nombre: 'María González',
    email: 'maria@mail.com',
    telefono: '3329421234',
  })
  // Una nota privada del comercio sobre ella, con un dato sensible.
  await CustomerNote.create({
    appId,
    merchantId,
    userId: vecino._id,
    createdBy: new Types.ObjectId(),
    text: 'Celíaca, avisar siempre en cocina',
  })
  // Su celular, suscripto a notificaciones.
  await PushSubscription.create({
    appId,
    userId: vecino._id,
    endpoint: 'https://push.example.com/abc123',
    keys: { p256dh: 'k1', auth: 'k2' },
  })
  await Redemption.create({
    appId,
    userId: vecino._id,
    merchantId,
    couponId: new Types.ObjectId(),
    activationId: new Types.ObjectId(),
    merchantUserId: new Types.ObjectId(),
    montoTicket: 5000,
    ahorroEstimado: 1000,
  })
})

async function borrarCuenta() {
  const r = await api.request('/auth/me', {
    method: 'DELETE',
    headers: { 'x-tenant-slug': 'sanpedro', authorization: auth() },
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
}

describe('DELETE /auth/me — "eliminamos tus datos personales" tiene que ser cierto', () => {
  it('🔴 borra las notas privadas que el comercio escribió sobre el vecino', async () => {
    expect(await CustomerNote.countDocuments({ userId: vecino._id })).toBe(1)
    const r = await borrarCuenta()
    expect(r.status).toBe(200)
    expect(await CustomerNote.countDocuments({ userId: vecino._id })).toBe(0)
  })

  it('🔴 borra su suscripción push: el celular deja de ser notificable', async () => {
    const r = await borrarCuenta()
    expect(r.status).toBe(200)
    expect(await PushSubscription.countDocuments({ userId: vecino._id })).toBe(0)
  })

  it('el canje se ANONIMIZA, no se borra: es el registro de venta del comercio', async () => {
    await borrarCuenta()
    const canjes = await Redemption.find({ appId, merchantId }).lean()
    expect(canjes).toHaveLength(1)
    expect(canjes[0].userId).toBeUndefined()
    expect(canjes[0].montoTicket).toBe(5000) // el comercio conserva su venta
  })

  it('no toca los datos del vecino en OTRA ciudad', async () => {
    // Misma persona, cuenta independiente en Ramallo (identidad = appId+email).
    const enRamallo = await User.create({
      appId: otroAppId,
      nombre: 'María González',
      email: 'maria@mail.com',
      telefono: '3329421234',
    })
    await CustomerNote.create({
      appId: otroAppId,
      merchantId,
      userId: enRamallo._id,
      createdBy: new Types.ObjectId(),
      text: 'Nota de la otra ciudad',
    })
    await borrarCuenta()
    // La cuenta y la nota de Ramallo siguen intactas.
    expect(await User.countDocuments({ _id: enRamallo._id })).toBe(1)
    expect(await CustomerNote.countDocuments({ userId: enRamallo._id })).toBe(1)
  })
})
