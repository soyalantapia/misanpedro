import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ownerRoutes } from '@/routes/owner'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { App, Merchant, MerchantUser, SupportCode, Owner } from '@/models'
import { signAccessToken, verifyAccessToken } from '@/services/jwt.service'

// MODO SOPORTE: el owner genera un código de un solo uso y el panel del comercio
// lo canjea por una sesión que actúa como el propietario (sub = MerchantUser) con
// el rastro impersonatedBy = id del owner. Lo crítico es seguridad: código único,
// claim correcto, sin auth no entra, comercio inexistente 404.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const ownerId = new Types.ObjectId()

const ownerApp = new Hono()
ownerApp.route('/owner', ownerRoutes)
const merchantApp = new Hono()
merchantApp.route('/merchant/auth', merchantAuthRoutes)

function ownerAuth() {
  return 'Bearer ' + signAccessToken({ sub: ownerId.toString(), type: 'owner', rol: 'super' })
}

// Pone al owner en ese rol EN LA BASE y devuelve su token.
//
// Desde [cazabug loop2] el rol lo manda la base, no el token: requireOwnerAuth
// revalida en cada request. Firmar un token que diga 'viewer' ya no alcanza para
// probar el gate — si en la base sigue siendo super, es super (y está bien: es
// justo lo que evita que un degradado siga operando con el token viejo).
async function roleAuth(rol: string) {
  await Owner.updateOne({ _id: ownerId }, { rol, enabled: true })
  return 'Bearer ' + signAccessToken({ sub: ownerId.toString(), type: 'owner', rol })
}

async function refresh(refreshToken: string, slug = 'ciudada') {
  const res = await merchantApp.request('/merchant/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug },
    body: JSON.stringify({ refreshToken }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

async function startSupport(merchantId: string, auth = ownerAuth()) {
  const res = await ownerApp.request(`/owner/merchants/${merchantId}/support-session`, {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

async function exchange(code: string, slug = 'ciudada') {
  const res = await merchantApp.request('/merchant/auth/support-exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': slug },
    body: JSON.stringify({ code }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

const codeFromUrl = (url: string) => decodeURIComponent(url.split('?code=')[1] ?? '')

let merchant: any
let merchantUser: any
let seq = 0
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([Merchant.createIndexes(), MerchantUser.createIndexes(), SupportCode.createIndexes()])
  await App.create({ _id: appId, slug: 'ciudada', subdomain: 'ciudada', nombre: 'Mi CiudadA', ciudad: 'A', status: 'active' })
  await Owner.create({ _id: ownerId, email: 'owner@micuidad.com', nombre: 'Owner Test', rol: 'super', enabled: true })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([Merchant.deleteMany({}), MerchantUser.deleteMany({}), SupportCode.deleteMany({})])
  // El owner vuelve a super+habilitado: ahora el rol vive en la BASE, así que un
  // test que lo degrada se lo dejaba puesto al siguiente.
  await Owner.updateOne({ _id: ownerId }, { rol: 'super', enabled: true })
  seq++
  merchant = await Merchant.create({
    appId,
    slug: `local-${seq}`,
    nombre: 'Comercio Soporte',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: `REF${String(seq).padStart(5, '0')}`,
  })
  merchantUser = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@comercio.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

describe('modo soporte — owner impersona al comercio (integración Mongo real)', () => {
  it('flujo completo: owner crea sesión → comercio canjea → token actúa como propietario + impersonatedBy', async () => {
    const s = await startSupport(merchant._id.toString())
    expect(s.status).toBe(200)
    expect(s.body.panelUrl).toContain('ciudada.micuidad.com')
    expect(s.body.panelUrl).toContain('/admin/soporte?code=')

    const code = codeFromUrl(s.body.panelUrl)
    const x = await exchange(code)
    expect(x.status).toBe(200)
    expect(x.body.support.impersonatedBy).toBe(ownerId.toString())
    // El token actúa como el PROPIETARIO (sub = MerchantUser admin) con el rastro.
    const payload = verifyAccessToken(x.body.accessToken)
    expect(payload.sub).toBe(merchantUser._id.toString())
    expect(payload.type).toBe('merchant_user')
    expect(payload.merchantId).toBe(merchant._id.toString())
    expect(payload.impersonatedBy).toBe(ownerId.toString())
  })

  it('el código es de UN SOLO USO: el segundo canje falla', async () => {
    const s = await startSupport(merchant._id.toString())
    const code = codeFromUrl(s.body.panelUrl)
    expect((await exchange(code)).status).toBe(200)
    expect((await exchange(code)).status).toBe(401) // ya consumido
  })

  it('código inválido → 401', async () => {
    expect((await exchange('codigo-que-no-existe')).status).toBe(401)
  })

  it('código vencido → 401', async () => {
    const s = await startSupport(merchant._id.toString())
    const code = codeFromUrl(s.body.panelUrl)
    // Lo vencemos a mano.
    await SupportCode.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    expect((await exchange(code)).status).toBe(401)
  })

  it('sin auth de owner → 401 (no se puede generar la sesión de soporte)', async () => {
    const res = await ownerApp.request(`/owner/merchants/${merchant._id}/support-session`, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('comercio inexistente → 404', async () => {
    const s = await startSupport(new Types.ObjectId().toString())
    expect(s.status).toBe(404)
  })

  it('owner DESHABILITADO no puede generar sesión de soporte (aunque su token siga vivo)', async () => {
    // Token válido de un owner que ya no existe / fue deshabilitado.
    const ghost = 'Bearer ' + signAccessToken({ sub: new Types.ObjectId().toString(), type: 'owner', rol: 'super' })
    const s = await startSupport(merchant._id.toString(), ghost)
    expect(s.status).toBe(403)
    await Owner.updateOne({ _id: ownerId }, { enabled: false })
    const s2 = await startSupport(merchant._id.toString())
    expect(s2.status).toBe(403)
    await Owner.updateOne({ _id: ownerId }, { enabled: true }) // restaurar para otros tests
  })

  it('un código de la ciudad A no se canjea desde la ciudad B (aislamiento)', async () => {
    await App.create({ _id: new Types.ObjectId(), slug: 'ciudadb', subdomain: 'ciudadb', nombre: 'B', ciudad: 'B', status: 'active' })
    const s = await startSupport(merchant._id.toString())
    const code = codeFromUrl(s.body.panelUrl)
    expect((await exchange(code, 'ciudadb')).status).toBe(401) // appId no matchea
  })

  // [cazabug S2-01/S3-01/S4-02 · P0] Impersonar es ESCRITURA sobre comercios:
  // solo super/admin/soporte. viewer/finanzas (read-only) NO pueden.
  it('viewer NO puede generar sesión de soporte (403) — antes del fix daba 200', async () => {
    const s = await startSupport(merchant._id.toString(), await roleAuth('viewer'))
    expect(s.status).toBe(403)
    expect(s.body.error).toBe('forbidden')
  })

  it('finanzas NO puede generar sesión de soporte (403)', async () => {
    expect((await startSupport(merchant._id.toString(), await roleAuth('finanzas'))).status).toBe(403)
  })

  it('soporte SÍ puede generar sesión de soporte (200)', async () => {
    const s = await startSupport(merchant._id.toString(), await roleAuth('soporte'))
    expect(s.status).toBe(200)
    await Owner.updateOne({ _id: ownerId }, { rol: 'super' }) // restaurar
  })

  it('viewer NO puede revocar sesiones de soporte (403)', async () => {
    const res = await ownerApp.request(`/owner/merchants/${merchant._id}/revoke-support`, {
      method: 'POST',
      headers: { authorization: await roleAuth('viewer') },
    })
    expect(res.status).toBe(403)
  })

  // [cazabug S2-02/S4-01/S3-04 · P1] La sesión de soporte se revalida en cada
  // refresh: deshabilitar al owner la corta (≤1h). Antes vivía para siempre.
  it('sesión de soporte viva: deshabilitar al owner la corta en el próximo refresh', async () => {
    const s = await startSupport(merchant._id.toString())
    const x = await exchange(codeFromUrl(s.body.panelUrl))
    expect(x.status).toBe(200)
    const rt = x.body.refreshToken as string

    // Con el owner habilitado + super, el refresh de soporte funciona.
    expect((await refresh(rt)).status).toBe(200)

    // Lo deshabilitan del equipo → el refresh de soporte muere.
    await Owner.updateOne({ _id: ownerId }, { enabled: false })
    const dead = await refresh(rt)
    expect(dead.status).toBe(401)
    expect(dead.body.error).toBe('sesión de soporte revocada')
    await Owner.updateOne({ _id: ownerId }, { enabled: true }) // restaurar
  })

  it('sesión de soporte viva: bajarle el rol al owner por debajo de soporte la corta', async () => {
    const s = await startSupport(merchant._id.toString())
    const rt = (await exchange(codeFromUrl(s.body.panelUrl))).body.refreshToken as string
    expect((await refresh(rt)).status).toBe(200)
    await Owner.updateOne({ _id: ownerId }, { rol: 'viewer' })
    expect((await refresh(rt)).status).toBe(401)
    await Owner.updateOne({ _id: ownerId }, { rol: 'super' }) // restaurar
  })
})
