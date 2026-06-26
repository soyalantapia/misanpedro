import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { redemptionsRoutes } from '@/routes/redemptions'
import { App, Merchant, User, Coupon, Activation, Redemption } from '@/models'
import { signAccessToken } from '@/services/jwt.service'

// Auditoría de lanzamiento del CAMINO DEL DINERO (canje). Ejercita los handlers
// REALES /validate y /confirm con Mongo en memoria + JWT de comercio minteado.
// Lockea los invariantes críticos: no doble-canje, no oversell, ahorro correcto,
// rechazos (vencido/pausado/agotado/otro-comercio), límite por persona y
// aislamiento multi-tenant. NODE_ENV='test' (setup.ts). tenantContext resuelve el
// tenant por X-Tenant-Slug contra un App sembrado.

const DIA = 86_400_000
let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const appBId = new Types.ObjectId()

const app = new Hono()
app.route('/', redemptionsRoutes)

function authHeader(merchantUserId: Types.ObjectId, merchantId: Types.ObjectId, tenantId = appId) {
  const token = signAccessToken({
    sub: merchantUserId.toString(),
    type: 'merchant_user',
    merchantId: merchantId.toString(),
    appId: tenantId.toString(),
  })
  return `Bearer ${token}`
}

async function validate(slug: string, auth: string, body: Record<string, unknown>) {
  const res = await app.request('/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug, authorization: auth },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

async function confirm(slug: string, auth: string, body: Record<string, unknown>) {
  const res = await app.request('/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug, authorization: auth },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

let merchantSeq = 1
function mkMerchant(tenantId = appId) {
  const n = merchantSeq++
  return Merchant.create({
    appId: tenantId,
    slug: `comercio-${n}-${new Types.ObjectId().toString().slice(-6)}`,
    nombre: 'Comercio Test',
    categoria: 'gastronomia',
    direccion: 'Calle Falsa 123',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    // el signup real siempre genera un referralCode único (índice {appId,referralCode} unique sparse).
    referralCode: `REF${String(n).padStart(5, '0')}`,
  })
}

let phoneSeq = 1
function mkUser(tenantId = appId) {
  // teléfono único: el modelo User tiene índice único {appId, telefono}.
  return User.create({ appId: tenantId, nombre: 'Vecino Test', telefono: `+54911${String(phoneSeq++).padStart(8, '0')}` })
}

function mkCoupon(merchantId: Types.ObjectId, extra: Record<string, unknown> = {}, tenantId = appId) {
  return Coupon.create({
    appId: tenantId,
    merchantId,
    titulo: 'Cupón Test',
    descripcion: 'x'.repeat(25),
    porcentaje: 20,
    vigenciaHasta: new Date(Date.now() + 30 * DIA),
    ...extra,
  })
}

let codeSeq = 100000
function mkActivation(coupon: any, user: any, tenantId = appId) {
  const codigoNumerico = String(codeSeq++)
  return Activation.create({
    appId: tenantId,
    couponId: coupon._id,
    userId: user._id,
    codigoNumerico,
    qrPayload: `msp:act:${codigoNumerico}:${coupon._id.toString()}`,
    status: 'activo',
  })
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  // Mongoose construye índices async tras conectar; los forzamos ANTES de testear.
  // Crítico: el índice único {activationId} de Redemption es el guard de
  // doble-canje concurrente (en prod se construye en el deploy).
  await Promise.all([
    Redemption.createIndexes(),
    Activation.createIndexes(),
    User.createIndexes(),
    Coupon.createIndexes(),
    Merchant.createIndexes(),
  ])
  await App.create([
    { _id: appId, slug: 'ciudada', subdomain: 'ciudada', nombre: 'Mi CiudadA', ciudad: 'A', status: 'active' },
    { _id: appBId, slug: 'ciudadb', subdomain: 'ciudadb', nombre: 'Mi CiudadB', ciudad: 'B', status: 'active' },
  ])
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([
    Merchant.deleteMany({}),
    User.deleteMany({}),
    Coupon.deleteMany({}),
    Activation.deleteMany({}),
    Redemption.deleteMany({}),
  ])
})

describe('canje /validate + /confirm — invariantes del dinero (integración Mongo real)', () => {
  it('happy path: validar → confirmar → ahorro = % del ticket, estados y stock OK', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { porcentaje: 20 })
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)

    const v = await validate('ciudada', auth, { codigoNumerico: act.codigoNumerico })
    expect(v.status).toBe(200)
    expect(v.body.validation.activationId).toBe(act._id.toString())

    const r = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 5000 })
    expect(r.status).toBe(200)
    expect(r.body.redemption.ahorroEstimado).toBe(1000) // 20% de 5000
    const freshAct = await Activation.findById(act._id)
    expect(freshAct?.status).toBe('canjeado')
    expect(await Redemption.countDocuments({ activationId: act._id })).toBe(1)
    const freshCoupon = await Coupon.findById(coupon._id)
    expect(freshCoupon?.stockUsado).toBe(1)
  })

  it('ahorro sin monto: usa precioReferencia del cupón', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { porcentaje: 10, precioReferencia: 8000 })
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString() })
    expect(r.status).toBe(200)
    expect(r.body.redemption.ahorroEstimado).toBe(800) // 10% de 8000 (precioReferencia)
  })

  it('ahorro sin monto NI precioReferencia: ahorro 0 pero el canje se confirma', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { porcentaje: 30 }) // sin precioReferencia
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString() })
    expect(r.status).toBe(200)
    expect(r.body.redemption.ahorroEstimado).toBe(0)
    expect((await Activation.findById(act._id))?.status).toBe('canjeado')
  })

  it('precio_fijo: ahorro = ticket − precio fijo', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { tipoOferta: 'precio_fijo', precioFijo: 3000, porcentaje: 1 })
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 5000 })
    expect(r.body.redemption.ahorroEstimado).toBe(2000)
  })

  it('NO doble-canje (secuencial): el 2do confirm da 409 y queda 1 solo Redemption', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id)
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r1 = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 })
    expect(r1.status).toBe(200)
    const r2 = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 })
    expect(r2.status).toBe(409)
    expect(await Redemption.countDocuments({ activationId: act._id })).toBe(1)
  })

  it('NO doble-canje (concurrente, misma activación): exactamente 1 éxito', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id)
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 }),
      ),
    )
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await Redemption.countDocuments({ activationId: act._id })).toBe(1)
  })

  it('NO oversell: 2 activaciones, stockMaximo=1, confirms concurrentes → 1 canje y 1 agotado', async () => {
    const merchant = await mkMerchant()
    const user1 = await mkUser()
    const user2 = await mkUser()
    const coupon = await mkCoupon(merchant._id, { stockMaximo: 1 })
    const act1 = await mkActivation(coupon, user1)
    const act2 = await mkActivation(coupon, user2)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const [r1, r2] = await Promise.all([
      confirm('ciudada', auth, { activationId: act1._id.toString(), montoTicket: 1000 }),
      confirm('ciudada', auth, { activationId: act2._id.toString(), montoTicket: 1000 }),
    ])
    const oks = [r1, r2].filter((r) => r.status === 200)
    expect(oks).toHaveLength(1)
    const freshCoupon = await Coupon.findById(coupon._id)
    expect(freshCoupon?.stockUsado).toBe(1) // exactamente el tope, no 2
    expect(await Redemption.countDocuments({ couponId: coupon._id })).toBe(1)
  })

  it('rechaza cupón VENCIDO', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { vigenciaHasta: new Date(Date.now() - DIA) })
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/vencid/i)
    expect(await Redemption.countDocuments({})).toBe(0)
  })

  it('rechaza cupón PAUSADO', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { estado: 'pausado' })
    const act = await mkActivation(coupon, user)
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 })
    expect(r.status).toBe(409)
    expect(await Redemption.countDocuments({})).toBe(0)
  })

  it('rechaza canjear cupón de OTRO comercio (403)', async () => {
    const merchantDuenio = await mkMerchant()
    const merchantOtro = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchantDuenio._id)
    const act = await mkActivation(coupon, user)
    // El comercio "otro" intenta confirmar un cupón que no es suyo.
    const auth = authHeader(new Types.ObjectId(), merchantOtro._id)
    const r = await confirm('ciudada', auth, { activationId: act._id.toString(), montoTicket: 1000 })
    expect(r.status).toBe(403)
    expect(await Redemption.countDocuments({})).toBe(0)
  })

  it('aislamiento multi-tenant: un comercio de ciudadB NO ve un código de ciudadA', async () => {
    const merchantA = await mkMerchant(appId)
    const userA = await mkUser(appId)
    const couponA = await mkCoupon(merchantA._id, {}, appId)
    const actA = await mkActivation(couponA, userA, appId)
    // Comercio de ciudadB (tenant distinto) intenta validar el código de ciudadA.
    const merchantB = await mkMerchant(appBId)
    const authB = authHeader(new Types.ObjectId(), merchantB._id, appBId)
    const v = await validate('ciudadb', authB, { codigoNumerico: actA.codigoNumerico })
    expect(v.status).toBe(404) // no existe en ese tenant
  })

  it('límite por persona: usoMaxPorPersona=1 → el 2do canje del mismo vecino se bloquea', async () => {
    const merchant = await mkMerchant()
    const user = await mkUser()
    const coupon = await mkCoupon(merchant._id, { usoMaxPorPersona: 1, usoVentana: 'devida' })
    const auth = authHeader(new Types.ObjectId(), merchant._id)
    const act1 = await mkActivation(coupon, user)
    const r1 = await confirm('ciudada', auth, { activationId: act1._id.toString(), montoTicket: 1000 })
    expect(r1.status).toBe(200)
    const act2 = await mkActivation(coupon, user)
    const r2 = await confirm('ciudada', auth, { activationId: act2._id.toString(), montoTicket: 1000 })
    expect(r2.status).toBe(409)
    expect(r2.body.motivo).toBe('limite_por_persona')
    expect(await Redemption.countDocuments({ userId: user._id })).toBe(1)
  })
})
