import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { referralsRoutes } from '@/routes/referrals'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { App, Merchant, MerchantUser, Referral } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2] El link de referido mandaba a la ciudad equivocada.
//
// `GET /referrals/me` armaba el link con `env.APP_URL_FRONT` —la URL GLOBAL— aunque
// la ruta tiene el tenant en contexto (usa tenantContext y getAppId). Entonces un
// comercio de cualquier ciudad que no sea la principal comparte su link y manda a
// sus conocidos a la ciudad de otro.
//
// Y el daño no termina ahí, porque el código de referido es único POR CIUDAD y el
// alta lo busca con `Merchant.findOne({ appId, referralCode })`: el código de la
// ciudad B simplemente NO EXISTE en la ciudad A. El alta se completa igual, sin
// error, pero el referido no se registra y el que refirió nunca recibe sus semanas
// gratis. Nadie se entera de que se perdió: no hay nada que falle.
//
// El helper correcto ya existe y se usa en billing (`tenantFrontUrl`, lib/urls.ts).

let mongod: MongoMemoryServer
const api = new Hono()
api.route('/referrals', referralsRoutes)
api.route('/merchant/auth', merchantAuthRoutes)

// Dos ciudades: la principal (a la que apunta APP_URL_FRONT) y otra.
const appPrincipal = new Types.ObjectId()
const appOtra = new Types.ObjectId()
let merchantOtra: any
let userOtra: any

function authOtra() {
  return (
    'Bearer ' +
    signAccessToken({
      sub: userOtra._id.toString(),
      type: 'merchant_user',
      merchantId: merchantOtra._id.toString(),
      appId: String(appOtra),
    })
  )
}

async function miReferido() {
  const r = await api.request('/referrals/me', {
    headers: { 'x-tenant-slug': 'minarino', authorization: authOtra() },
  })
  const body = (await r.json()) as any
  return body.referral as { code: string; link: string }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await App.create([
    {
      _id: appPrincipal,
      slug: 'sanpedro',
      subdomain: 'sanpedro',
      nombre: 'Mi San Pedro',
      ciudad: 'San Pedro',
      status: 'active',
    },
    {
      _id: appOtra,
      slug: 'minarino',
      subdomain: 'minarino',
      nombre: 'Mi Nariño',
      ciudad: 'Nariño',
      status: 'active',
    },
  ])
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([Merchant.deleteMany({}), MerchantUser.deleteMany({}), Referral.deleteMany({})])
  _resetRateLimits()
  merchantOtra = await Merchant.create({
    appId: appOtra,
    slug: 'panaderia',
    nombre: 'Panadería del Sur',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-77.28, 1.21] },
    telefono: '+573000000000',
    referralCode: 'REFNAR1',
    estado: 'activo',
  })
  userOtra = await MerchantUser.create({
    appId: appOtra,
    merchantId: merchantOtra._id,
    email: 'duenio@panaderia.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

describe('el link de referido lleva a la ciudad del comercio', () => {
  it('🔴 apunta al subdominio de SU ciudad, no al de la ciudad principal', async () => {
    const ref = await miReferido()
    expect(ref.link).toContain('minarino')
    expect(ref.link).not.toContain('sanpedro')
  })

  it('🔴 el código viaja en el link y es el del comercio', async () => {
    const ref = await miReferido()
    expect(ref.code).toBe('REFNAR1')
    expect(ref.link).toContain('ref=REFNAR1')
  })

  it('el link conserva la ruta de registro del panel', async () => {
    const ref = await miReferido()
    expect(ref.link).toContain('/#/admin/registro?ref=')
  })

  it('un dominio propio de la ciudad gana sobre el subdominio', async () => {
    await App.updateOne({ _id: appOtra }, { customDomain: 'descuentosnarino.com.co' })
    const ref = await miReferido()
    expect(ref.link).toContain('descuentosnarino.com.co')
    await App.updateOne({ _id: appOtra }, { $unset: { customDomain: 1 } })
  })

  it('🔴 el código de una ciudad NO resuelve en otra: por eso el link importa', async () => {
    // Esto es lo que hacía que el referido se perdiera en silencio. El alta busca
    // el código dentro de SU ciudad; el de Nariño no existe en San Pedro.
    const enSanPedro = await Merchant.findOne({
      appId: appPrincipal,
      referralCode: 'REFNAR1',
    })
    expect(enSanPedro).toBeNull()

    const enSuCiudad = await Merchant.findOne({ appId: appOtra, referralCode: 'REFNAR1' })
    expect(enSuCiudad).not.toBeNull()
  })
})
