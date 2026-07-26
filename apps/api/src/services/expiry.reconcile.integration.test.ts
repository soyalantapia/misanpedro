import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Merchant, Subscription } from '@/models'
import { runExpirySweep } from '@/services/expiry.service'

// [cazabug S11-01 · P1] Reconciliación suscripción → acceso del comercio. Un
// comercio cuya suscripción venció (cancelled/paused/rejected + nextBillingAt
// pasado) seguía 'activo' para siempre. El sweep ahora lo suspende, sin tocar a
// los que están en free-trial ni dentro del período pagado.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000)
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000)
let seq = 0

async function mkMerchant(estado: string, freeTrialUntil?: Date) {
  seq++
  return Merchant.create({
    appId,
    slug: `m-${seq}`,
    nombre: `Comercio ${seq}`,
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: `+54911000000${seq}`,
    referralCode: `REF${String(seq).padStart(5, '0')}`,
    estado,
    ...(freeTrialUntil ? { freeTrialUntil } : {}),
  })
}

function mkSub(merchantId: Types.ObjectId, status: string, nextBillingAt?: Date) {
  return Subscription.create({ appId, merchantId, status, amountARS: 50000, nextBillingAt })
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([Merchant.deleteMany({}), Subscription.deleteMany({})])
})

describe('runExpirySweep — reconciliación de suscripciones vencidas', () => {
  it('suspende al comercio activo cuya suscripción venció (cancelled + nextBillingAt pasado)', async () => {
    const m = await mkMerchant('activo')
    await mkSub(m._id, 'cancelled', PAST)
    const res = await runExpirySweep()
    expect(res.merchantsSuspended).toBe(1)
    expect((await Merchant.findById(m._id))!.estado).toBe('suspendido')
  })

  it('NO suspende si la suscripción sigue authorized', async () => {
    const m = await mkMerchant('activo')
    await mkSub(m._id, 'authorized', FUTURE)
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('activo')
  })

  it('NO suspende si todavía está dentro del período pagado (nextBillingAt futuro)', async () => {
    const m = await mkMerchant('activo')
    await mkSub(m._id, 'cancelled', FUTURE)
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('activo')
  })

  it('NO suspende a un comercio en free-trial vigente aunque tenga sub vencida', async () => {
    const m = await mkMerchant('activo', FUTURE)
    await mkSub(m._id, 'rejected', PAST)
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('activo')
  })

  it('idempotente: correrlo dos veces no vuelve a contar al ya suspendido', async () => {
    const m = await mkMerchant('activo')
    await mkSub(m._id, 'paused', PAST)
    expect((await runExpirySweep()).merchantsSuspended).toBe(1)
    expect((await runExpirySweep()).merchantsSuspended).toBe(0)
    expect((await Merchant.findById(m._id))!.estado).toBe('suspendido')
  })
})
