import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Coupon, Redemption } from '@/models'
import { checkUsoLimite } from './usageLimit'

// Integración REAL contra Mongo (in-memory): prueba el guard end-to-end —
// la query de Redemption + la decisión. Cubre lo que el unit puro no puede:
// canjes backdateados (la ventana temporal que VUELVE a liberar) y un cupón
// SIN los campos (backward-compat de cupones viejos).

const DIA = 86400000
let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const merchantId = new Types.ObjectId()
const merchantUserId = new Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

function mkCoupon(extra: Record<string, unknown> = {}) {
  return Coupon.create({
    appId,
    merchantId,
    titulo: 'Cupón test',
    descripcion: 'x'.repeat(25),
    porcentaje: 20,
    vigenciaHasta: new Date(Date.now() + 30 * DIA),
    ...extra,
  })
}
function mkRedemption(couponId: Types.ObjectId, userId: Types.ObjectId, redeemedAt: Date) {
  return Redemption.create({
    appId,
    activationId: new Types.ObjectId(),
    couponId,
    merchantId,
    userId,
    merchantUserId,
    ahorroEstimado: 100,
    redeemedAt,
  })
}

describe('checkUsoLimite — integración con Mongo real (in-memory)', () => {
  it('devida max1: 0 canjes permite, 1 canje bloquea (nextDisponible null)', async () => {
    const c = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'devida' })
    const u = new Types.ObjectId()
    expect((await checkUsoLimite(appId, c._id, u, c)).bloqueado).toBe(false)
    await mkRedemption(c._id as any, u, new Date())
    const r = await checkUsoLimite(appId, c._id, u, c)
    expect(r.bloqueado).toBe(true)
    expect(r.nextDisponible).toBeNull()
  })

  it('semana: bloquea con canje de hace 3d; LIBERA con canje de hace 8d (ventana vuelve)', async () => {
    const c = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'semana' })
    const dentro = new Types.ObjectId()
    await mkRedemption(c._id as any, dentro, new Date(Date.now() - 3 * DIA))
    expect((await checkUsoLimite(appId, c._id, dentro, c)).bloqueado).toBe(true)
    const fuera = new Types.ObjectId()
    await mkRedemption(c._id as any, fuera, new Date(Date.now() - 8 * DIA))
    expect((await checkUsoLimite(appId, c._id, fuera, c)).bloqueado).toBe(false) // ya pasó la semana
  })

  it('mes (30d): hace 20d bloquea, hace 31d libera', async () => {
    const c = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'mes' })
    const a = new Types.ObjectId(); const b = new Types.ObjectId()
    await mkRedemption(c._id as any, a, new Date(Date.now() - 20 * DIA))
    await mkRedemption(c._id as any, b, new Date(Date.now() - 31 * DIA))
    expect((await checkUsoLimite(appId, c._id, a, c)).bloqueado).toBe(true)
    expect((await checkUsoLimite(appId, c._id, b, c)).bloqueado).toBe(false)
  })

  it('aislamiento por persona: A bloqueado, B no', async () => {
    const c = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'devida' })
    const a = new Types.ObjectId(); const b = new Types.ObjectId()
    await mkRedemption(c._id as any, a, new Date())
    expect((await checkUsoLimite(appId, c._id, a, c)).bloqueado).toBe(true)
    expect((await checkUsoLimite(appId, c._id, b, c)).bloqueado).toBe(false)
  })

  it('usoMax 2: 1 permite, 2 bloquea; un canje fuera de ventana no cuenta', async () => {
    const c = await mkCoupon({ usoMaxPorPersona: 2, usoVentana: 'semana' })
    const u = new Types.ObjectId()
    await mkRedemption(c._id as any, u, new Date(Date.now() - 9 * DIA)) // fuera
    await mkRedemption(c._id as any, u, new Date(Date.now() - 1 * DIA)) // dentro
    let r = await checkUsoLimite(appId, c._id, u, c)
    expect(r.usos).toBe(1)
    expect(r.bloqueado).toBe(false)
    await mkRedemption(c._id as any, u, new Date(Date.now() - 2 * DIA)) // 2do dentro
    r = await checkUsoLimite(appId, c._id, u, c)
    expect(r.usos).toBe(2)
    expect(r.bloqueado).toBe(true)
  })

  it('ilimitado: nunca bloquea (5 canjes)', async () => {
    const c = await mkCoupon({ usoVentana: 'ilimitado' })
    const u = new Types.ObjectId()
    for (let i = 0; i < 5; i++) await mkRedemption(c._id as any, u, new Date())
    expect((await checkUsoLimite(appId, c._id, u, c)).bloqueado).toBe(false)
  })

  it('backward-compat: cupón SIN los campos (insert crudo) → {1,devida}, bloquea con 1', async () => {
    const ins = await mongoose.connection.collection('coupons').insertOne({
      appId, merchantId, titulo: 'viejo', descripcion: 'z'.repeat(25), porcentaje: 20,
      vigenciaHasta: new Date(Date.now() + 30 * DIA), estado: 'activo',
    })
    const cid = ins.insertedId as unknown as Types.ObjectId
    const couponDoc = await mongoose.connection.collection('coupons').findOne({ _id: ins.insertedId })
    const u = new Types.ObjectId()
    await mkRedemption(cid, u, new Date())
    const r = await checkUsoLimite(appId, cid, u, couponDoc as any)
    expect(r.ventana).toBe('devida')
    expect(r.bloqueado).toBe(true)
  })

  it('aislamiento por cupón: bloqueado en X no afecta a Y', async () => {
    const x = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'devida' })
    const y = await mkCoupon({ usoMaxPorPersona: 1, usoVentana: 'devida' })
    const u = new Types.ObjectId()
    await mkRedemption(x._id as any, u, new Date())
    expect((await checkUsoLimite(appId, x._id, u, x)).bloqueado).toBe(true)
    expect((await checkUsoLimite(appId, y._id, u, y)).bloqueado).toBe(false)
  })
})
