import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { activationsRoutes } from '@/routes/activations'
import { couponsRoutes } from '@/routes/coupons'
import { App, User, Merchant, MerchantUser, Coupon, Activation } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] Borrar un cupón dejaba al vecino con un código zombi.
//
// `DELETE /coupons/:id` hace `coupon.deleteOne()` y nada más. Las activaciones que
// apuntaban a ese cupón quedan en 'activo' para siempre, y como el snapshot
// (couponTituloSnapshot…) sólo se escribía AL CANJEAR, no hay nada que las
// describa. El vecino termina con dos síntomas del mismo problema:
//
//  · MisCuponesPage renderiza un esqueleto gris que late para siempre
//    (apps/web/src/pages/MisCuponesPage.tsx: `if (!c || !m) return <skeleton>`).
//  · CuponActivoPage lo expulsa al inicio sin explicación
//    (`return <Navigate to="/" replace />` cuando el cupón no resuelve).
//
// Y no puede sacárselo de encima: el botón de cancelar está DEBAJO de ese guard,
// así que nunca llega a tocarlo. Encima el índice único {appId,couponId,userId}
// sobre status 'activo' lo deja apuntando a un cupón que ya no existe.
//
// La causa terminal es que el snapshot se escribía demasiado tarde: el mecanismo
// para sobrevivir a un cupón borrado YA existía, sólo que recién al canjear.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const api = new Hono()
api.route('/activations', activationsRoutes)
api.route('/coupons', couponsRoutes)

let merchant: any
let merchantUser: any
let vecino: any
let coupon: any

function authVecino() {
  return 'Bearer ' + signAccessToken({ sub: vecino._id.toString(), type: 'user', appId: String(appId) })
}
function authComercio() {
  return (
    'Bearer ' +
    signAccessToken({
      sub: merchantUser._id.toString(),
      type: 'merchant_user',
      merchantId: merchant._id.toString(),
      appId: String(appId),
    })
  )
}

async function activar() {
  const r = await api.request('/activations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': 'sanpedro',
      authorization: authVecino(),
    },
    body: JSON.stringify({ couponId: coupon._id.toString() }),
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
}

async function borrarCupon() {
  const r = await api.request(`/coupons/${coupon._id.toString()}`, {
    method: 'DELETE',
    headers: { 'x-tenant-slug': 'sanpedro', authorization: authComercio() },
  })
  return r.status
}

async function miBilletera() {
  const r = await api.request('/activations/me', {
    headers: { 'x-tenant-slug': 'sanpedro', authorization: authVecino() },
  })
  const body = (await r.json()) as any
  return body.activations as any[]
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
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
    User.deleteMany({}),
    Merchant.deleteMany({}),
    MerchantUser.deleteMany({}),
    Coupon.deleteMany({}),
    Activation.deleteMany({}),
  ])
  _resetRateLimits()
  merchant = await Merchant.create({
    appId,
    slug: 'pizzeria',
    nombre: 'Pizzería Don Luis',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFHUER01',
    estado: 'activo',
  })
  merchantUser = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@pizzeria.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
  vecino = await User.create({ appId, nombre: 'Vecina', email: 'vecina@test.com', telefono: '3329421234' })
  coupon = await Coupon.create({
    appId,
    merchantId: merchant._id,
    titulo: '20% en pizzas grandes',
    descripcion: 'Pizzas grandes de muzzarella',
    porcentaje: 20,
    vigenciaDesde: new Date(Date.now() - 86_400_000),
    vigenciaHasta: new Date(Date.now() + 30 * 86_400_000),
    estado: 'activo',
  })
})

describe('un cupón borrado no puede dejar al vecino con un código zombi', () => {
  it('🔴 la activación se describe sola desde que nace, sin esperar al canje', async () => {
    const r = await activar()
    expect(r.status).toBe(201)
    const act = await Activation.findById(r.body.activation.id).lean()
    // Sin esto, si el cupón desaparece no queda NADA para renderizar la tarjeta.
    expect(act?.couponTituloSnapshot).toBe('20% en pizzas grandes')
    expect(act?.couponPorcentajeSnapshot).toBe(20)
    expect(act?.merchantNombreSnapshot).toBe('Pizzería Don Luis')
  })

  it('🔴 borrar el cupón saca la activación de "activo" en vez de dejarla colgada', async () => {
    const r = await activar()
    expect(await borrarCupon()).toBe(200)

    const act = await Activation.findById(r.body.activation.id).lean()
    expect(act?.status).not.toBe('activo')
  })

  it('🔴 la billetera sigue pudiendo mostrar la tarjeta, no un esqueleto eterno', async () => {
    await activar()
    await borrarCupon()

    const activaciones = await miBilletera()
    expect(activaciones).toHaveLength(1)
    // El front hace `if (!c || !m) return <skeleton>`: sin estos campos, el vecino
    // ve una tarjeta gris latiendo para siempre y al tocarla lo echa al inicio.
    expect(activaciones[0].coupon?.titulo).toBe('20% en pizzas grandes')
    expect(activaciones[0].merchant?.nombre).toBe('Pizzería Don Luis')
  })

  it('borrar el cupón no toca las activaciones de OTROS cupones', async () => {
    const otro = await Coupon.create({
      appId,
      merchantId: merchant._id,
      titulo: '10% en empanadas',
      descripcion: 'Empanadas de carne',
      porcentaje: 10,
      vigenciaDesde: new Date(Date.now() - 86_400_000),
      vigenciaHasta: new Date(Date.now() + 30 * 86_400_000),
      estado: 'activo',
    })
    await activar()
    const rOtro = await api.request('/activations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-slug': 'sanpedro',
        authorization: authVecino(),
      },
      body: JSON.stringify({ couponId: otro._id.toString() }),
    })
    expect(rOtro.status).toBe(201)

    await borrarCupon()

    const intacta = await Activation.findOne({ couponId: otro._id }).lean()
    expect(intacta?.status).toBe('activo')
  })

  it('borrar el cupón no revive un canje ya hecho', async () => {
    const r = await activar()
    await Activation.updateOne(
      { _id: r.body.activation.id },
      { status: 'canjeado', redeemedAt: new Date() },
    )
    await borrarCupon()

    const act = await Activation.findById(r.body.activation.id).lean()
    expect(act?.status).toBe('canjeado')
  })
})
