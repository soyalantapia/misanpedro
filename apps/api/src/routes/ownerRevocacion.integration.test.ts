import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ownerRoutes } from '@/routes/owner'
import { Owner } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { _resetRateLimits } from '@/middleware/security'

// [cazabug loop2 · P0] Echar a alguien del equipo tiene que cortarle el acceso YA.
//
// Antes, la autorización se resolvía 100% con los claims del JWT: `requireOwnerAuth`
// sólo validaba la firma y `requireOwnerRole` leía el rol del token, sin tocar la
// base. Como el access vive 1h, el owner deshabilitado seguía operando toda esa
// hora — y lo peor: podía invitarse a sí mismo con otro email y rol super, y
// quedarse con una cuenta nueva y limpia. La revocación del refresh no ayudaba:
// no invalida un access ya emitido.
//
// El barrido anterior había parchado SÓLO support-session ("alto poder"), pero
// crear un super es estrictamente más peligroso que impersonar un comercio.

let mongod: MongoMemoryServer
const api = new Hono()
api.route('/owner', ownerRoutes)

let superA: any
let superB: any

const tok = (o: any, rolEnElToken?: string) =>
  'Bearer ' + signAccessToken({ sub: String(o._id), type: 'owner', rol: rolEnElToken ?? o.rol })

async function post(path: string, auth: string, body: unknown = {}) {
  const r = await api.request(`/owner${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
}

async function get(path: string, auth: string) {
  const r = await api.request(`/owner${path}`, { headers: { authorization: auth } })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }
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
  await Owner.deleteMany({})
  _resetRateLimits()
  superA = await Owner.create({ email: 'a@equipo.com', nombre: 'A', rol: 'super', enabled: true })
  superB = await Owner.create({ email: 'b@equipo.com', nombre: 'B', rol: 'super', enabled: true })
})

describe('echar a alguien del equipo le corta el acceso al instante', () => {
  it('🔴 EL ATAQUE: el deshabilitado NO puede crearse otro super con su token viejo', async () => {
    const tokenViejo = tok(superA)
    // Con el equipo intacto, A puede invitar (control: el token sirve).
    expect((await get('/admins', tokenViejo)).status).toBe(200)

    // B lo deshabilita.
    await Owner.updateOne({ _id: superA._id }, { enabled: false })

    // A intenta perpetuarse con el MISMO access token, que todavía no venció.
    const r = await post('/admins', tokenViejo, {
      email: 'atacante@gmail.com',
      nombre: 'Cuenta Nueva',
      rol: 'super',
    })
    expect(r.status).toBe(403)
    // Y no quedó ninguna cuenta nueva.
    expect(await Owner.countDocuments({ email: 'atacante@gmail.com' })).toBe(0)
  })

  it('el deshabilitado tampoco puede leer ni tocar nada más', async () => {
    const tokenViejo = tok(superA)
    await Owner.updateOne({ _id: superA._id }, { enabled: false })

    expect((await get('/admins', tokenViejo)).status).toBe(403)
    expect((await get('/stats', tokenViejo)).status).toBe(403)
    expect((await get('/merchants', tokenViejo)).status).toBe(403)
    expect((await post('/apps', tokenViejo, { slug: 'x', nombre: 'X', ciudad: 'X' })).status).toBe(403)
  })

  it('un owner BORRADO del equipo queda afuera igual', async () => {
    const tokenViejo = tok(superA)
    await Owner.deleteOne({ _id: superA._id })
    expect((await get('/stats', tokenViejo)).status).toBe(403)
  })

  it('el rol lo manda la BASE, no el token: degradar a viewer corta al instante', async () => {
    // Token que dice 'super' pero en la base ya es 'viewer' (lo degradaron).
    const tokenQueMiente = tok(superA, 'super')
    await Owner.updateOne({ _id: superA._id }, { rol: 'viewer' })

    // /admins es sólo para super: el token miente, la base manda.
    expect((await get('/admins', tokenQueMiente)).status).toBe(403)
    // Pero lo que un viewer SÍ puede, lo puede.
    expect((await get('/stats', tokenQueMiente)).status).toBe(200)
  })

  it('el owner habilitado sigue trabajando normal (no rompimos el caso feliz)', async () => {
    expect((await get('/admins', tok(superB))).status).toBe(200)
    expect((await get('/stats', tok(superB))).status).toBe(200)
  })
})
