import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { App, Merchant, MerchantUser, Subscription } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] Cancelar tiene que cancelar EN MERCADO PAGO.
//
// Antes, /billing/cancel sólo cambiaba el estado en NUESTRA base. Le decíamos al
// comercio "tu suscripción fue cancelada" y MP le seguía debitando todos los
// meses, porque el preapproval seguía vivo allá. Encima, el próximo webhook la
// revivía a 'authorized'.
//
// Mockeamos mp.service para poder probar los tres caminos (MP cancela / MP falla
// / no hay preapproval) sin credenciales reales.

const cancelPreapprovalMock = vi.fn()
const getPreapprovalMock = vi.fn()

vi.mock('@/services/mp.service', () => ({
  createPreapproval: vi.fn(),
  getPreapproval: (...args: any[]) => getPreapprovalMock(...args),
  cancelPreapproval: (...args: any[]) => cancelPreapprovalMock(...args),
}))

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
let merchant: any
let user: any
let billingRoutes: any
const api = new Hono()

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

async function cancelar() {
  const r = await api.request('/billing/cancel', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': 'sanpedro',
      authorization: auth(),
    },
    body: '{}',
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
  await Promise.all([Merchant.deleteMany({}), MerchantUser.deleteMany({}), Subscription.deleteMany({})])
  _resetRateLimits()
  cancelPreapprovalMock.mockReset()
  getPreapprovalMock.mockReset()
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería Test',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFCAN01',
    estado: 'activo',
    // Fuera del período de arrepentimiento: cancelación normal, no reembolso.
    arrepentimientoExpiraEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
  })
  user = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
  await Subscription.create({
    appId,
    merchantId: merchant._id,
    externalReference: 'cup-test-1',
    preapprovalId: 'PREAPPROVAL-123',
    amountARS: 50000,
    status: 'authorized',
    nextBillingAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  })
})

describe('POST /billing/cancel — cancela de verdad en Mercado Pago', () => {
  it('🔴 EL BUG: cancela EN MP, no sólo en nuestra base', async () => {
    cancelPreapprovalMock.mockResolvedValue(true)
    const r = await cancelar()
    expect(r.status).toBe(200)
    // Lo esencial: le pedimos a MP que corte el cobro.
    expect(cancelPreapprovalMock).toHaveBeenCalledWith('PREAPPROVAL-123')
    const sub = await Subscription.findOne({ merchantId: merchant._id })
    expect(sub!.status).toBe('cancelled')
  })

  it('si MP NO pudo cancelar, no le mentimos al comercio ni marcamos cancelado', async () => {
    cancelPreapprovalMock.mockResolvedValue(false)
    const r = await cancelar()
    expect(r.status).toBe(503)
    expect(r.body.error).toMatch(/Mercado Pago/i)
    // La suscripción sigue viva: mejor que el comercio reintente a que crea que
    // canceló mientras le siguen debitando.
    const sub = await Subscription.findOne({ merchantId: merchant._id })
    expect(sub!.status).toBe('authorized')
  })

  it('el webhook NO revive una cancelación pedida por el comercio', async () => {
    cancelPreapprovalMock.mockResolvedValue(true)
    await cancelar()

    // Llega un webhook tardío de MP diciendo que sigue autorizada.
    getPreapprovalMock.mockResolvedValue({
      status: 'authorized',
      external_reference: 'cup-test-1',
      next_payment_date: new Date().toISOString(),
    })
    const r = await api.request('/billing/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'preapproval', data: { id: 'PREAPPROVAL-123' } }),
    })
    expect(r.status).toBe(200)

    const sub = await Subscription.findOne({ merchantId: merchant._id })
    expect(sub!.status).toBe('cancelled') // sigue cancelada, no resucitó
  })
})
