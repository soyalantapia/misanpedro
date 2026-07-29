import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { App, Merchant, MerchantUser, Subscription } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] El precio que la ciudad ANUNCIA tiene que ser el que se COBRA.
//
// El monto mensual efectivo se calculaba por separado en cuatro lugares, cada uno
// con su propio fallback: la landing (30.000), el env del backend (50.000), la
// pantalla de plan del comercio (50.000) y el JSON-LD estático (30.000). Mientras
// el tenant tenga `precioMensual` cargado los cuatro coinciden por casualidad;
// apenas falta —y es OPCIONAL en la API, owner.ts:632, aunque el panel lo pida—
// el comercio lee "$30.000/mes congelado de por vida" y le debitan $50.000.
//
// La causa no es cuál de los dos números está bien: es que el endpoint público
// devolvía `precioMensual` CRUDO (posiblemente undefined) y obligaba a cada
// consumidor a inventarse un fallback. Ahora resuelve el precio efectivo con la
// MISMA función que usa el cobro, así no hay dos números que puedan divergir.

vi.mock('@/services/mp.service', () => ({
  createPreapproval: vi.fn(async () => ({ id: 'PRE-1', init_point: 'https://mp/x' })),
  getPreapproval: vi.fn(),
  cancelPreapproval: vi.fn(),
}))

let mongod: MongoMemoryServer
let billingRoutes: any
let tenantRoutes: any
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

/** Lo que la ciudad le ANUNCIA al comercio (lo que consume la landing). */
async function precioAnunciado(): Promise<number | undefined> {
  const r = await api.request('/tenant/pueblochico/config')
  const body = (await r.json()) as any
  return body?.tenant?.precioMensual
}

/** Lo que efectivamente se le va a DEBITAR (lo que se manda a Mercado Pago). */
async function precioCobrado(): Promise<number | undefined> {
  const r = await api.request('/billing/preapproval', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': 'pueblochico',
      authorization: auth(),
    },
    body: JSON.stringify({ plan: 'standard' }),
  })
  expect(r.status).toBe(200)
  const sub = await Subscription.findOne({ appId }).lean()
  return sub?.amountARS
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ billingRoutes } = await import('@/routes/billing'))
  ;({ tenantRoutes } = await import('@/routes/tenant'))
  api.route('/billing', billingRoutes)
  api.route('/tenant', tenantRoutes)
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([
    App.deleteMany({}),
    Merchant.deleteMany({}),
    MerchantUser.deleteMany({}),
    Subscription.deleteMany({}),
  ])
  _resetRateLimits()
})

async function sembrarCiudad(precioMensual?: number) {
  await App.create({
    _id: appId,
    slug: 'pueblochico',
    subdomain: 'pueblochico',
    nombre: 'Mi Pueblo Chico',
    ciudad: 'Pueblo Chico',
    status: 'active',
    ...(precioMensual != null ? { precioMensual } : {}),
  })
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFPRE01',
    estado: 'activo',
  })
  user = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
}

describe('el precio anunciado es el precio cobrado', () => {
  it('🔴 ciudad SIN precioMensual: lo anunciado coincide con lo debitado', async () => {
    await sembrarCiudad(undefined)
    const anunciado = await precioAnunciado()
    const cobrado = await precioCobrado()
    // Antes: anunciado === undefined → la landing mostraba su propio 30.000
    // mientras el cobro salía 50.000. Un comercio de más.
    expect(anunciado).toBeTypeOf('number')
    expect(anunciado).toBe(cobrado)
  })

  it('ciudad CON precioMensual: manda el del tenant, no el default global', async () => {
    await sembrarCiudad(30_000)
    const anunciado = await precioAnunciado()
    const cobrado = await precioCobrado()
    expect(anunciado).toBe(30_000)
    expect(cobrado).toBe(30_000)
  })

  it('precioMensual en 0 no se toma como precio: cae al default y sigue coincidiendo', async () => {
    await sembrarCiudad(0)
    const anunciado = await precioAnunciado()
    const cobrado = await precioCobrado()
    expect(anunciado).toBeGreaterThan(0)
    expect(anunciado).toBe(cobrado)
  })
})
