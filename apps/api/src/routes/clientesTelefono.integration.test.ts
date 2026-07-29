import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { redemptionsRoutes } from '@/routes/redemptions'
import { App, User, Merchant, MerchantUser, Redemption } from '@/models'
import { signAccessToken } from '@/services/jwt.service'

// [cazabug loop2] La campaña de WhatsApp del comercio no le llegaba a NADIE.
//
// El cambio de identidad (teléfono → email) tocó el modelo y el alta, pero no
// este serializador: sigue mandando `whatsapp`, que es un campo legacy que el
// alta actual ya no llena, y omite `telefono` por completo. Entonces el front
// arma la lista de destinatarios vacía, manda recipients:[] y el comercio recibe
// un "invalid input" que no le dice nada.
//
// En prod no se veía probando a mano porque los vecinos VIEJOS sí tienen
// `whatsapp` cargado y enmascaran el problema.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const api = new Hono()
api.route('/redemptions', redemptionsRoutes)

let merchant: any
let merchantUser: any

function auth() {
  return (
    'Bearer ' +
    signAccessToken({
      sub: merchantUser._id.toString(),
      type: 'merchant_user',
      merchantId: merchant._id.toString(),
      appId: String(appId),
    })
  )
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await App.create({
    _id: appId,
    slug: 'sanpedro',
    subdomain: 'sanpedro',
    nombre: 'Mi San Pedro',
    ciudad: 'SP',
    status: 'active',
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Merchant.deleteMany({}), MerchantUser.deleteMany({}), Redemption.deleteMany({})])
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFCLI01',
    estado: 'activo',
  })
  merchantUser = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

async function crearClienteConCanje(over: Record<string, unknown>) {
  const u = await User.create({ appId, nombre: 'Cliente', email: `c${Math.random()}@t.com`, ...over })
  await Redemption.create({
    appId,
    userId: u._id,
    merchantId: merchant._id,
    merchantUserId: merchantUser._id,
    couponId: new Types.ObjectId(),
    activationId: new Types.ObjectId(),
    montoTicket: 5000,
    ahorroEstimado: 1000,
  })
  return u
}

async function listarClientes() {
  const r = await api.request('/redemptions/clientes', {
    headers: { 'x-tenant-slug': 'sanpedro', authorization: auth() },
  })
  return { status: r.status, body: (await r.json()) as Record<string, any> }
}

describe('GET /redemptions/clientes — el comercio necesita el teléfono para su campaña', () => {
  it('🔴 devuelve el telefono del vecino dado de alta con el flujo ACTUAL', async () => {
    await crearClienteConCanje({ telefono: '3329421234' })
    const r = await listarClientes()
    expect(r.status).toBe(200)
    expect(r.body.clientes).toHaveLength(1)
    expect(r.body.clientes[0].telefono).toBe('3329421234')
  })

  it('sigue devolviendo whatsapp para los vecinos legacy que lo tienen', async () => {
    await crearClienteConCanje({ telefono: '3329400000', whatsapp: '+54 9 3329 555444' })
    const r = await listarClientes()
    expect(r.body.clientes[0].whatsapp).toBe('+54 9 3329 555444')
    expect(r.body.clientes[0].telefono).toBe('3329400000')
  })
})
