import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { App, Merchant, MerchantUser, Subscription } from '@/models'

// [cazabug loop2] El webhook de Mercado Pago decía "ok" incluso cuando no había
// procesado nada.
//
// Mercado Pago reintenta una notificación SÓLO si no le respondés 2xx. El handler
// devolvía `{ok:true}` con 200 en todos los caminos, incluidos los dos en los que
// no hizo absolutamente nada:
//
//  · `getPreapproval()` devuelve null (MP caído, red cortada, token vencido).
//  · No se encuentra la Subscription — que pasa de verdad por carrera: la
//    notificación de MP puede llegar ANTES de que terminemos de escribir el doc.
//
// En los dos casos le confirmábamos a MP la entrega, MP no reintentaba nunca más,
// y el comercio que YA PAGÓ quedaba en 'pending_payment' para siempre: pagando
// todos los meses una cuenta que nunca se activó. Nadie se entera, porque desde
// nuestro lado se ve un webhook exitoso.

const getPreapprovalMock = vi.fn()

vi.mock('@/services/mp.service', () => ({
  createPreapproval: vi.fn(),
  getPreapproval: (...args: any[]) => getPreapprovalMock(...args),
  cancelPreapproval: vi.fn(async () => true),
}))

// Sin secret configurado y fuera de producción, verifyMpSignature deja pasar:
// así el test se concentra en el procesamiento, no en la firma.
let mongod: MongoMemoryServer
let billingRoutes: any
const api = new Hono()
const appId = new Types.ObjectId()
let merchant: any

async function webhook(body: Record<string, unknown>) {
  const r = await api.request('/billing/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ billingRoutes } = await import('@/routes/billing'))
  api.route('/billing', billingRoutes)
  await App.create({
    _id: appId,
    slug: 'sanpedro',
    subdomain: 'sanpedro',
    nombre: 'Mi San Pedro',
    ciudad: 'San Pedro',
    status: 'active',
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
  getPreapprovalMock.mockReset()
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFWH01',
    estado: 'pending_payment',
  })
  await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

describe('el webhook sólo confirma la entrega si procesó de verdad', () => {
  it('🔴 si no pudimos consultar a MP, NO le decimos ok: tiene que reintentar', async () => {
    getPreapprovalMock.mockResolvedValueOnce(null)

    const r = await webhook({ type: 'preapproval', data: { id: 'PRE-1' } })

    // Cualquier 2xx haría que MP marque la notificación como entregada y no
    // vuelva nunca. El comercio que pagó quedaría en pending_payment para siempre.
    expect(r.status).toBeGreaterThanOrEqual(500)
  })

  it('🔴 si todavía no existe la suscripción, tampoco: la notificación se adelantó', async () => {
    getPreapprovalMock.mockResolvedValueOnce({
      id: 'PRE-HUERFANO',
      status: 'authorized',
      external_reference: 'cup-sanpedro-inexistente',
    })

    const r = await webhook({ type: 'preapproval', data: { id: 'PRE-HUERFANO' } })

    expect(r.status).toBeGreaterThanOrEqual(500)
  })

  it('procesado de verdad → 200 y el comercio queda activo', async () => {
    await Subscription.create({
      appId,
      merchantId: merchant._id,
      externalReference: 'cup-sanpedro-ok',
      preapprovalId: 'PRE-OK',
      amountARS: 30_000,
      currency: 'ARS',
      status: 'pending',
    })
    getPreapprovalMock.mockResolvedValueOnce({
      id: 'PRE-OK',
      status: 'authorized',
      external_reference: 'cup-sanpedro-ok',
    })

    const r = await webhook({ type: 'preapproval', data: { id: 'PRE-OK' } })

    expect(r.status).toBe(200)
    expect((await Subscription.findOne({ preapprovalId: 'PRE-OK' }))?.status).toBe('authorized')
    expect((await Merchant.findById(merchant._id))?.estado).toBe('activo')
  })

  it('un evento que no nos toca se confirma con 200: reintentarlo sería ruido eterno', async () => {
    const r = await webhook({ type: 'payment', data: { id: 'PAY-1' } })
    expect(r.status).toBe(200)
    expect(getPreapprovalMock).not.toHaveBeenCalled()
  })

  it('una notificación sin id se confirma: no hay nada que ir a buscar', async () => {
    const r = await webhook({ type: 'preapproval' })
    expect(r.status).toBe(200)
  })

  it('la cancelación del comercio se sigue respetando y se confirma con 200', async () => {
    await Subscription.create({
      appId,
      merchantId: merchant._id,
      externalReference: 'cup-sanpedro-cancel',
      preapprovalId: 'PRE-CANCEL',
      amountARS: 30_000,
      currency: 'ARS',
      status: 'cancelled',
      rawLast: { cancelledAt: new Date().toISOString() },
    })
    getPreapprovalMock.mockResolvedValueOnce({
      id: 'PRE-CANCEL',
      status: 'authorized',
      external_reference: 'cup-sanpedro-cancel',
    })

    const r = await webhook({ type: 'preapproval', data: { id: 'PRE-CANCEL' } })

    expect(r.status).toBe(200)
    expect((await Subscription.findOne({ preapprovalId: 'PRE-CANCEL' }))?.status).toBe('cancelled')
  })
})
