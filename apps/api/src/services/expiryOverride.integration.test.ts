import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Merchant, Subscription, OwnerAuditLog } from '@/models'
import { runExpirySweep } from '@/services/expiry.service'

// [cazabug loop2] Cuando un humano decide, la automatización no lo pisa.
//
// El reconciliador de suscripciones (que agregamos en el barrido anterior) baja a
// 'suspendido' a todo comercio con la suscripción vencida, cada 10 minutos. El
// problema: el owner reactiva a mano un comercio —porque pagó por transferencia,
// porque hubo un error, porque lo que sea— y diez minutos después el sweep lo
// vuelve a suspender EN SILENCIO. El owner ve "Activo" en su panel (no refresca)
// y el comercio lo llama de nuevo.
//
// Causa raíz: se metió un escritor automático sobre un estado que ya tenía un
// escritor humano, sin definir quién gana ni dejar rastro.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const PASADO = new Date(Date.now() - 24 * 60 * 60 * 1000)
let seq = 0

async function comercioConSuscripcionVencida(over: Record<string, unknown> = {}) {
  seq++
  const m = await Merchant.create({
    appId,
    slug: `local-${seq}`,
    nombre: `Comercio ${seq}`,
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: `+54911000000${seq}`,
    referralCode: `REFOV${String(seq).padStart(4, '0')}`,
    estado: 'activo',
    ...over,
  })
  await Subscription.create({
    appId,
    merchantId: m._id,
    status: 'cancelled',
    amountARS: 50000,
    nextBillingAt: PASADO,
  })
  return m
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
  await Promise.all([
    Merchant.deleteMany({}),
    Subscription.deleteMany({}),
    OwnerAuditLog.deleteMany({}),
  ])
})

describe('el sweep respeta la decisión manual del owner', () => {
  it('sin override, suspende (el reconciliador sigue haciendo su trabajo)', async () => {
    const m = await comercioConSuscripcionVencida()
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('suspendido')
  })

  it('🔴 con reactivación manual del owner, NO lo vuelve a suspender', async () => {
    const m = await comercioConSuscripcionVencida({ estadoManualAt: new Date() })
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('activo')
  })

  it('cuando el sweep suspende, queda registrado en la auditoría', async () => {
    // Antes bajaba comercios sin dejar rastro: el owner miraba la Auditoría y no
    // encontraba quién lo había suspendido, porque no había sido nadie.
    const m = await comercioConSuscripcionVencida()
    await runExpirySweep()
    const entradas = await OwnerAuditLog.find({ recursoId: String(m._id) }).lean()
    expect(entradas).toHaveLength(1)
    expect(entradas[0].action).toBe('system.merchant.suspend')
    expect(entradas[0].detail).toContain(m.nombre)
  })

  it('no suspende a los que están en free-trial vigente', async () => {
    const m = await comercioConSuscripcionVencida({
      freeTrialUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    await runExpirySweep()
    expect((await Merchant.findById(m._id))!.estado).toBe('activo')
  })
})
