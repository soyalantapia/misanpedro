import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { couponsRoutes } from '@/routes/coupons'
import { merchantsRoutes } from '@/routes/merchants'
import { App, Merchant, User, Coupon } from '@/models'

// AISLAMIENTO MULTI-TENANT: los datos (comercios/locales + cupones) de una ciudad
// NO se ven en otra. Dos apps CON datos; cada tenant (resuelto por X-Tenant-Slug)
// solo ve lo suyo, y no puede leer por-id/por-slug lo de la otra ciudad.

const DIA = 86_400_000
let mongod: MongoMemoryServer
const appA = new Types.ObjectId()
const appB = new Types.ObjectId()

const app = new Hono()
app.route('/merchants', merchantsRoutes)
app.route('/coupons', couponsRoutes)

async function get(slug: string, path: string) {
  const res = await app.request(path, { headers: { 'x-tenant-slug': slug } })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

function arr(b: Record<string, any>, ...keys: string[]) {
  for (const k of keys) if (Array.isArray(b?.[k])) return b[k]
  return []
}

let seq = 0
function mkMerchant(appId: Types.ObjectId, nombre: string, slug: string) {
  seq++
  return Merchant.create({
    appId,
    slug,
    nombre,
    categoria: 'gastronomia',
    direccion: 'Calle Falsa 123',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: `REF${String(seq).padStart(5, '0')}`,
    estado: 'activo',
  })
}
function mkCoupon(appId: Types.ObjectId, merchantId: Types.ObjectId, titulo: string) {
  return Coupon.create({
    appId,
    merchantId,
    titulo,
    descripcion: 'x'.repeat(25),
    porcentaje: 20,
    estado: 'activo',
    vigenciaHasta: new Date(Date.now() + 30 * DIA),
  })
}

let merchA: any, merchB: any, coupA: any, coupB: any
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Merchant.createIndexes(), Coupon.createIndexes(), User.createIndexes()])
  await App.create([
    { _id: appA, slug: 'ciudada', subdomain: 'ciudada', nombre: 'Mi CiudadA', ciudad: 'A', status: 'active' },
    { _id: appB, slug: 'ciudadb', subdomain: 'ciudadb', nombre: 'Mi CiudadB', ciudad: 'B', status: 'active' },
  ])
  merchA = await mkMerchant(appA, 'Comercio de CiudadA', 'local-a')
  merchB = await mkMerchant(appB, 'Comercio de CiudadB', 'local-b')
  coupA = await mkCoupon(appA, merchA._id, 'Cupón de CiudadA')
  coupB = await mkCoupon(appB, merchB._id, 'Cupón de CiudadB')
  // mismo vecino (mismo email Y teléfono) en ambas ciudades: deben ser usuarios
  // DISTINTOS (scoped por appId). La identidad es (appId, email); el índice
  // único no colisiona entre tenants. [cazabug S1-01]
  await User.create({
    appId: appA,
    nombre: 'Vecino A',
    email: 'vecino@example.com',
    telefono: '+5491155550001',
  })
  await User.create({
    appId: appB,
    nombre: 'Vecino B',
    email: 'vecino@example.com',
    telefono: '+5491155550001',
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('aislamiento multi-tenant — los locales de una ciudad NO se ven en otra', () => {
  it('catálogo de comercios: cada ciudad solo ve los suyos', async () => {
    const a = await get('ciudada', '/merchants')
    const b = await get('ciudadb', '/merchants')
    const aNames = arr(a.body, 'merchants', 'data').map((m: any) => m.nombre)
    const bNames = arr(b.body, 'merchants', 'data').map((m: any) => m.nombre)
    expect(aNames).toContain('Comercio de CiudadA')
    expect(aNames).not.toContain('Comercio de CiudadB') // no se cruza
    expect(bNames).toContain('Comercio de CiudadB')
    expect(bNames).not.toContain('Comercio de CiudadA')
  })

  it('catálogo de cupones: cada ciudad solo ve los suyos', async () => {
    const a = await get('ciudada', '/coupons')
    const b = await get('ciudadb', '/coupons')
    const aIds = arr(a.body, 'coupons', 'data').map((x: any) => x.id)
    const bIds = arr(b.body, 'coupons', 'data').map((x: any) => x.id)
    expect(aIds).toContain(coupA._id.toString())
    expect(aIds).not.toContain(coupB._id.toString())
    expect(bIds).toContain(coupB._id.toString())
    expect(bIds).not.toContain(coupA._id.toString())
  })

  it('por-id: un cupón de CiudadB NO se puede leer desde CiudadA (404)', async () => {
    const ok = await get('ciudadb', `/coupons/${coupB._id}`)
    expect(ok.status).toBe(200) // su propia ciudad sí
    const cross = await get('ciudada', `/coupons/${coupB._id}`)
    expect(cross.status).toBe(404) // otra ciudad NO, aunque tenga el id
  })

  it('por-slug: el comercio de CiudadB NO se resuelve desde CiudadA', async () => {
    const ok = await get('ciudadb', `/merchants/${merchB.slug}`)
    expect(ok.status).toBe(200)
    const cross = await get('ciudada', `/merchants/${merchB.slug}`)
    expect(cross.status).toBe(404)
  })

  it('el mismo teléfono de vecino en dos ciudades son usuarios DISTINTOS (scoped por appId)', async () => {
    const ua = await User.find({ appId: appA, telefono: '+5491155550001' })
    const ub = await User.find({ appId: appB, telefono: '+5491155550001' })
    expect(ua).toHaveLength(1)
    expect(ub).toHaveLength(1)
    expect(ua[0]._id.toString()).not.toBe(ub[0]._id.toString()) // no se pisan
  })
})
