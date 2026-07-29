import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { App, Merchant, MerchantUser, Subscription } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] "Activar pago" acuñaba una suscripción NUEVA en cada clic.
//
// POST /billing/preapproval creaba siempre un Subscription nuevo y un preapproval
// nuevo en Mercado Pago, sin mirar si el comercio ya tenía uno. El camino real no
// es el doble clic (el botón se deshabilita): es abandonar el checkout y volver a
// intentar. Cada intento deja un link de pago VIVO en MP. Si el comercio termina
// dos de ellos —por ejemplo completa el segundo y días después abre la pestaña
// vieja— quedan dos preapprovals autorizados y le debitan el doble todos los meses.
//
// Y no tenía cómo enterarse: /billing/me y /billing/cancel toman `.sort({createdAt:-1})`,
// o sea SOLO la más nueva. La duplicada quedaba cobrando, invisible desde el panel.

let preapprovalSeq = 0
const createPreapprovalMock = vi.fn(async () => {
  preapprovalSeq++
  return { id: `PRE-${preapprovalSeq}`, init_point: `https://mp.test/checkout/${preapprovalSeq}` }
})

vi.mock('@/services/mp.service', () => ({
  createPreapproval: (...args: any[]) => (createPreapprovalMock as any)(...args),
  getPreapproval: vi.fn(),
  cancelPreapproval: vi.fn(async () => true),
}))

let mongod: MongoMemoryServer
let billingRoutes: any
const api = new Hono()
const appId = new Types.ObjectId()
let merchant: any
let user: any

function auth() {
  return (
    'Bearer ' +
    signAccessToken({
      sub: user._id.toString(),
      type: 'merchant_user',
      merchantId: merchant._id.toString(),
      appId: String(appId),
    })
  )
}

async function activarPago() {
  const r = await api.request('/billing/preapproval', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': 'sanpedro',
      authorization: auth(),
    },
    body: JSON.stringify({ plan: 'standard' }),
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ billingRoutes } = await import('@/routes/billing'))
  api.route('/billing', billingRoutes)
  // El índice parcial único es la red para la carrera; mongoose lo crea async al
  // primer uso del modelo, así que lo esperamos para que el test no dependa del
  // timing. En prod lo garantiza db/connection.ts (Subscription.syncIndexes).
  await Subscription.syncIndexes()
  await App.create({
    _id: appId,
    slug: 'sanpedro',
    subdomain: 'sanpedro',
    nombre: 'Mi San Pedro',
    ciudad: 'San Pedro',
    status: 'active',
    precioMensual: 30_000,
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([
    Merchant.deleteMany({}),
    MerchantUser.deleteMany({}),
    Subscription.deleteMany({}),
  ])
  _resetRateLimits()
  createPreapprovalMock.mockClear()
  preapprovalSeq = 0
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFIDEM01',
    estado: 'pending_payment',
  })
  user = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

describe('POST /billing/preapproval es idempotente', () => {
  it('🔴 volver a intentar el pago reusa el link, no acuña otro en Mercado Pago', async () => {
    const primero = await activarPago()
    expect(primero.status).toBe(200)

    // El comercio abandona el checkout y vuelve a apretar "Activar pago".
    const segundo = await activarPago()
    expect(segundo.status).toBe(200)

    // Un solo preapproval en MP: si hay dos, hay dos débitos mensuales vivos.
    expect(createPreapprovalMock).toHaveBeenCalledTimes(1)
    expect(await Subscription.countDocuments({ merchantId: merchant._id })).toBe(1)
    expect(segundo.body.subscription.initPoint).toBe(primero.body.subscription.initPoint)
  })

  it('🔴 dos pestañas a la vez tampoco duplican el cobro', async () => {
    const [a, b] = await Promise.all([activarPago(), activarPago()])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(createPreapprovalMock).toHaveBeenCalledTimes(1)
    expect(await Subscription.countDocuments({ merchantId: merchant._id })).toBe(1)
  })

  it('con la suscripción ya activa no vuelve a mandar a pagar', async () => {
    await activarPago()
    await Subscription.updateOne({ merchantId: merchant._id }, { status: 'authorized' })

    const otra = await activarPago()
    expect(createPreapprovalMock).toHaveBeenCalledTimes(1)
    expect(await Subscription.countDocuments({ merchantId: merchant._id })).toBe(1)
    expect(otra.body.subscription?.status).toBe('authorized')
  })

  it('después de cancelar SÍ puede volver a suscribirse', async () => {
    await activarPago()
    await Subscription.updateOne({ merchantId: merchant._id }, { status: 'cancelled' })

    const nueva = await activarPago()
    expect(nueva.status).toBe(200)
    // Una cancelada no bloquea: acá sí corresponde un preapproval nuevo.
    expect(createPreapprovalMock).toHaveBeenCalledTimes(2)
    expect(await Subscription.countDocuments({ merchantId: merchant._id })).toBe(2)
  })

  it('una rechazada no deja al comercio encerrado sin poder reintentar', async () => {
    await activarPago()
    await Subscription.updateOne({ merchantId: merchant._id }, { status: 'rejected' })

    const reintento = await activarPago()
    expect(reintento.status).toBe(200)
    expect(createPreapprovalMock).toHaveBeenCalledTimes(2)
  })

  it('🔴 cancelar apaga TAMBIÉN las suscripciones viejas que quedaron vivas', async () => {
    // Duplicadas de antes del fix: el comercio no las ve (el panel muestra sólo
    // la última) pero MP se las debita igual.
    //
    // Se siembran con el índice caído a propósito, porque así es exactamente como
    // se ve la base real en ese caso: si ya había duplicados, el syncIndexes del
    // arranque no pudo crear el índice único y la base quedó sin la garantía. El
    // fix de cancelar tiene que funcionar igual en ese escenario.
    await Subscription.collection.dropIndex('appId_1_merchantId_1').catch(() => {})
    await Subscription.collection.insertMany([
      {
        appId, merchantId: merchant._id, externalReference: 'vieja-1',
        preapprovalId: 'PRE-VIEJA-1', status: 'authorized', plan: 'standard',
        amountARS: 30000, currency: 'ARS', createdAt: new Date(Date.now() - 90_000_000),
        updatedAt: new Date(),
      },
      {
        appId, merchantId: merchant._id, externalReference: 'vieja-2',
        preapprovalId: 'PRE-VIEJA-2', status: 'authorized', plan: 'standard',
        amountARS: 30000, currency: 'ARS', createdAt: new Date(Date.now() - 80_000_000),
        updatedAt: new Date(),
      },
    ])

    const r = await api.request('/billing/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-slug': 'sanpedro',
        authorization: auth(),
      },
      body: '{}',
    })
    expect(r.status).toBe(200)

    // Ninguna queda viva: si sobrevive una, el comercio sigue pagando después de
    // haber cancelado, y sin verla en ningún lado.
    const vivas = await Subscription.countDocuments({
      merchantId: merchant._id,
      status: { $in: ['pending', 'authorized'] },
    })
    expect(vivas).toBe(0)

    await Subscription.syncIndexes()
  })
})
