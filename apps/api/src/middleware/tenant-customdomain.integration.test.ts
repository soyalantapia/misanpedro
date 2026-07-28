import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { tenantContext } from '@/middleware/tenant'
import { App } from '@/models'

/**
 * Resolución de tenant por DOMINIO PROPIO (`customDomain`).
 *
 * Estaba documentada en el middleware y era código MUERTO: el lookup vivía
 * después del guard de `slug`, y resolveTenantSlug devuelve null para un host de
 * dos labels que no termina en un dominio de la plataforma (misanpedro.com), así
 * que el request moría con 400 antes de llegar al lookup.
 *
 * Estos tests fijan las cuatro fronteras: dominio propio resuelve; el subdominio
 * de siempre sigue funcionando; el header explícito conserva prioridad; y un host
 * desconocido sigue cortando con 400 en vez de caer en un tenant cualquiera.
 */

let mongod: MongoMemoryServer
const appSP = new Types.ObjectId()
const appNA = new Types.ObjectId()

const api = new Hono()
api.use('/probe', tenantContext)
api.get('/probe', (c) => c.json({ ok: true, slug: c.get('tenant').slug }))

async function get(headers: Record<string, string>) {
  const res = await api.request('/probe', { headers })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await App.create([
    {
      _id: appSP,
      slug: 'sanpedro',
      subdomain: 'sanpedro',
      nombre: 'MiSanPedro',
      ciudad: 'San Pedro',
      customDomain: 'misanpedro.com',
      status: 'active',
    },
    {
      _id: appNA,
      slug: 'narino',
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

describe('tenantContext — dominio propio', () => {
  it('resuelve el tenant por customDomain, sin subdominio', async () => {
    const r = await get({ host: 'misanpedro.com' })
    expect(r.status).toBe(200)
    expect(r.body.slug).toBe('sanpedro')
  })

  it('ignora el puerto en el host', async () => {
    const r = await get({ host: 'misanpedro.com:443' })
    expect(r.status).toBe(200)
    expect(r.body.slug).toBe('sanpedro')
  })

  it('el subdominio de la plataforma sigue funcionando', async () => {
    const r = await get({ host: 'minarino.micuidad.com' })
    expect(r.status).toBe(200)
    expect(r.body.slug).toBe('narino')
  })

  it('el header explícito conserva la prioridad sobre el dominio propio', async () => {
    // Un cliente que pide narino explícitamente desde misanpedro.com obtiene
    // narino: el header es el contrato del cliente y no lo pisa el host.
    const r = await get({ host: 'misanpedro.com', 'x-tenant-slug': 'narino' })
    expect(r.status).toBe(200)
    expect(r.body.slug).toBe('narino')
  })

  it('un dominio desconocido sigue cortando, no cae en un tenant cualquiera', async () => {
    const r = await get({ host: 'dominio-que-no-existe.com' })
    expect(r.status).toBe(400)
    expect(r.body.ok).toBe(false)
  })

  it('el customDomain de una ciudad no resuelve a otra', async () => {
    const r = await get({ host: 'misanpedro.com' })
    expect(r.body.slug).not.toBe('narino')
  })
})
