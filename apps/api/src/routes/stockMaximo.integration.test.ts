import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Coupon } from '@/models'

// Regresión: stockMaximo con claim ATÓMICO ($inc condicional) — la lógica de
// redemptions.ts /confirm. Verifica que canjes concurrentes no se pasen del tope
// (no overselling), que el cupón quede 'agotado' al límite, y por qué la ruta
// guarda `stockMaximo != null` antes de reclamar.
// Found by /qa on 2026-06-23.

const DIA = 86400000
let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const merchantId = new Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

// Mismo claim atómico que usa redemptions.ts /confirm: $inc condicional a que
// stockUsado < stockMaximo. Devuelve el doc actualizado o null si no hay stock.
async function claimStock(couponId: Types.ObjectId) {
  return Coupon.findOneAndUpdate(
    { _id: couponId, appId, $expr: { $lt: [{ $ifNull: ['$stockUsado', 0] }, '$stockMaximo'] } },
    { $inc: { stockUsado: 1 } },
    { new: true },
  )
}

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

describe('stockMaximo — claim atómico (integración Mongo real)', () => {
  it('canjes concurrentes NO se pasan del tope (no overselling)', async () => {
    const c = await mkCoupon({ stockMaximo: 2, stockUsado: 0 })
    // 5 canjes concurrentes sobre stockMaximo=2 → exactamente 2 exitosos.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimStock(c._id as Types.ObjectId)),
    )
    expect(results.filter(Boolean)).toHaveLength(2)
    const fresh = await Coupon.findById(c._id)
    expect(fresh?.stockUsado).toBe(2)
  })

  it('rechaza el claim en el tope y el cupón queda agotado (sin incrementar de más)', async () => {
    const c = await mkCoupon({ stockMaximo: 1, stockUsado: 0 })
    const first = await claimStock(c._id as Types.ObjectId)
    expect(first).not.toBeNull()
    expect(first?.stockUsado).toBe(1)
    // Al alcanzar el tope la ruta marca 'agotado'.
    if ((first?.stockUsado ?? 0) >= (first?.stockMaximo ?? 0)) {
      await Coupon.updateOne({ _id: c._id, appId }, { estado: 'agotado' })
    }
    const second = await claimStock(c._id as Types.ObjectId)
    expect(second).toBeNull()
    const fresh = await Coupon.findById(c._id)
    expect(fresh?.estado).toBe('agotado')
    expect(fresh?.stockUsado).toBe(1) // el claim rechazado NO incrementó
  })

  it('sin stockMaximo el claim no matchea (por eso la ruta lo guarda con != null)', async () => {
    const c = await mkCoupon({}) // sin stockMaximo => ilimitado
    expect(c.stockMaximo).toBeUndefined()
    // El $expr stockUsado < stockMaximo nunca matchea con stockMaximo null:
    // por eso /confirm solo llama al claim cuando stockMaximo != null y, sin tope,
    // cuenta el uso con un $inc plano aparte.
    const claimed = await claimStock(c._id as Types.ObjectId)
    expect(claimed).toBeNull()
  })
})
