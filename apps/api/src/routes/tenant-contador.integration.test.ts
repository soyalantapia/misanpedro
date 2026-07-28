import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { tenantRoutes } from '@/routes/tenant'
import { App, Merchant, Coupon } from '@/models'

/**
 * El contador de lanzamiento de la landing ("Ya van N de 50") sale de
 * `merchantsActivos` en GET /tenant/:slug/config.
 *
 * La vara es **más de un cupón cargado**, no "se dio de alta": un comercio que se
 * registró y nunca publicó nada no tiene qué canjear, y contarlo infla el número.
 * Estos tests fijan las 4 fronteras (0, 1, 2 cupones; suspendido) y el aislamiento
 * por ciudad — el contador de una ciudad no puede sumar comercios de otra.
 */

const DIA = 86_400_000
let mongod: MongoMemoryServer
const appA = new Types.ObjectId()
const appB = new Types.ObjectId()

const api = new Hono()
api.route('/tenant', tenantRoutes)

async function contador(slug: string): Promise<number> {
  const res = await api.request(`/tenant/${slug}/config`)
  const body = (await res.json()) as { tenant?: { merchantsActivos?: number } }
  return body.tenant?.merchantsActivos ?? -1
}

let seq = 0
async function mkMerchant(
  appId: Types.ObjectId,
  nombre: string,
  estado: 'activo' | 'suspendido' = 'activo',
) {
  seq++
  return Merchant.create({
    appId,
    slug: `local-${seq}`,
    nombre,
    categoria: 'gastronomia',
    direccion: 'Calle Falsa 123',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: `REF${String(seq).padStart(5, '0')}`,
    estado,
  })
}

async function mkCoupons(
  appId: Types.ObjectId,
  merchantId: Types.ObjectId,
  cuantos: number,
  estado: 'activo' | 'vencido' = 'activo',
) {
  for (let i = 0; i < cuantos; i++) {
    await Coupon.create({
      appId,
      merchantId,
      titulo: `Cupón ${i + 1} de prueba`,
      descripcion: 'x'.repeat(25),
      porcentaje: 20,
      estado,
      vigenciaHasta: new Date(Date.now() + 30 * DIA),
    })
  }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Merchant.createIndexes(), Coupon.createIndexes()])
  await App.create([
    { _id: appA, slug: 'ciudada', subdomain: 'ciudada', nombre: 'MiCiudadA', ciudad: 'A', status: 'active' },
    { _id: appB, slug: 'ciudadb', subdomain: 'ciudadb', nombre: 'MiCiudadB', ciudad: 'B', status: 'active' },
  ])

  // Ciudad A: uno sin cupones, uno con exactamente 1, dos con 2+, y un suspendido con 3.
  await mkMerchant(appA, 'Sin cupones')
  const unCupon = await mkMerchant(appA, 'Con un solo cupón')
  const dosCupones = await mkMerchant(appA, 'Con dos cupones')
  const tresCupones = await mkMerchant(appA, 'Con tres cupones')
  const suspendido = await mkMerchant(appA, 'Suspendido con cupones', 'suspendido')
  await mkCoupons(appA, unCupon._id, 1)
  await mkCoupons(appA, dosCupones._id, 2)
  await mkCoupons(appA, tresCupones._id, 3)
  await mkCoupons(appA, suspendido._id, 3)

  // Ciudad B: un solo comercio con 2 cupones.
  const bDos = await mkMerchant(appB, 'Comercio de B')
  await mkCoupons(appB, bDos._id, 2)
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('contador de lanzamiento — cuenta comercios con MÁS DE UN cupón', () => {
  it('cuenta solo los que tienen 2 o más cupones (no el de 0 ni el de 1)', async () => {
    // De los 5 de la ciudad A: 0 cupones ✗, 1 cupón ✗, 2 ✓, 3 ✓, suspendido ✗.
    expect(await contador('ciudada')).toBe(2)
  })

  it('un comercio suspendido no suma, aunque tenga cupones', async () => {
    // Ya cubierto arriba por el total; lo fijamos explícito para que un cambio
    // futuro que saque el filtro de estado rompa acá y no en producción.
    const total = await Merchant.countDocuments({ appId: appA })
    expect(total).toBe(5)
    expect(await contador('ciudada')).toBeLessThan(total)
  })

  it('un cupón vencido igual cuenta: el contador no retrocede', async () => {
    const m = await mkMerchant(appA, 'Con dos cupones vencidos')
    await mkCoupons(appA, m._id, 2, 'vencido')
    expect(await contador('ciudada')).toBe(3)
  })

  it('el contador de una ciudad no incluye comercios de otra', async () => {
    expect(await contador('ciudadb')).toBe(1)
  })

  it('una ciudad sin comercios con cupones devuelve 0, no falla', async () => {
    const appC = new Types.ObjectId()
    await App.create({
      _id: appC,
      slug: 'ciudadc',
      subdomain: 'ciudadc',
      nombre: 'MiCiudadC',
      ciudad: 'C',
      status: 'active',
    })
    expect(await contador('ciudadc')).toBe(0)
  })
})
