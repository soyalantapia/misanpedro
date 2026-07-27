import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { whatsappRoutes, awaitCampaign } from '@/routes/whatsapp'
import { App, Merchant, MerchantUser, WaSend } from '@/models'
import { signAccessToken } from '@/services/jwt.service'

// [cazabug S9-07 · P1] Los teléfonos de los vecinos se guardan en forma canónica
// LOCAL (sin país). toChatId sólo hacía replace(/\D/g,'') → mandaba
// "3329421234@c.us", un ID inválido, y TODOS los envíos fallaban. Ahora la ruta
// repone el prefijo del tenant y reporta los no normalizables como OMITIDOS.
//
// [cazabug S9-01 · P1] El POST esperaba TODA la campaña (hasta ~29 min) → timeout
// y error falso en la UI mientras el server seguía enviando. Ahora responde 202 y
// el progreso/cierre viaja por SSE.

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
let merchant: any
let merchantUser: any

const api = new Hono()
api.route('/wa', whatsappRoutes)

function auth() {
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

async function campaign(recipients: { to: string; nombre?: string }[], text = 'Hola {{nombre}}') {
  const res = await api.request('/wa/campaign', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': 'ciudada',
      authorization: auth(),
    },
    body: JSON.stringify({ recipients, text }),
  })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

/** Lanza la campaña y espera a que el envío en background termine. */
async function campaignAndDrain(recipients: { to: string; nombre?: string }[]) {
  const r = await campaign(recipients)
  await awaitCampaign(merchant._id.toString())
  return r
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await App.create({
    _id: appId,
    slug: 'ciudada',
    subdomain: 'ciudada',
    nombre: 'Mi CiudadA',
    ciudad: 'A',
    status: 'active',
    phonePrefix: '+54',
  })
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await Promise.all([Merchant.deleteMany({}), MerchantUser.deleteMany({}), WaSend.deleteMany({})])
  merchant = await Merchant.create({
    appId,
    slug: 'local-wa',
    nombre: 'Comercio WA',
    categoria: 'gastronomia',
    direccion: 'Calle 1',
    location: { type: 'Point', coordinates: [-59.6, -33.6] },
    telefono: '+5491100000000',
    referralCode: 'REFWA001',
    estado: 'activo',
  })
  merchantUser = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: 'duenio@comercio.com',
    nombre: 'Dueño',
    rol: 'admin',
  })
})

describe('POST /wa/campaign — normalización E.164 de los destinatarios', () => {
  it('el teléfono canónico local se envía como internacional (antes fallaba todo)', async () => {
    const r = await campaignAndDrain([{ to: '3329421234', nombre: 'Ana' }])
    expect(r.status).toBe(202)
    // Lo que quedó registrado es el E.164, no el local.
    const sends = await WaSend.find({ campaignId: r.body.campaign.id }).lean()
    expect(sends.map((s) => s.to)).toEqual(['5493329421234'])
  })

  it('formatos distintos del mismo número convergen al mismo destino', async () => {
    const r = await campaignAndDrain([
      { to: '3329421234' },
      { to: '+54 9 3329 42-1234' },
      { to: '03329421234' },
    ])
    const sends = await WaSend.find({ campaignId: r.body.campaign.id }).lean()
    expect(new Set(sends.map((s) => s.to))).toEqual(new Set(['5493329421234']))
    expect(sends).toHaveLength(3)
  })

  it('los números no normalizables se informan como OMITIDOS, no como enviados', async () => {
    const r = await campaignAndDrain([{ to: '3329421234' }, { to: '12345678' }])
    expect(r.status).toBe(202)
    expect(r.body.campaign.total).toBe(1)
    expect(r.body.campaign.skippedCount).toBe(1)
    const sends = await WaSend.find({ campaignId: r.body.campaign.id }).lean()
    expect(sends.map((s) => s.to)).toEqual(['5493329421234'])
  })

  it('si NINGÚN número es válido → 400 y no se consume la campaña', async () => {
    const r = await campaign([{ to: '12345678' }])
    expect(r.status).toBe(400)
    expect(r.body.skippedCount).toBe(1)
    expect(await WaSend.countDocuments({})).toBe(0)
  })
})

describe('POST /wa/campaign — envío asíncrono (202)', () => {
  const muchos = Array.from({ length: 20 }, (_, i) => ({
    to: `33294212${String(i).padStart(2, '0')}`,
  }))

  it('responde SIN esperar a que termine el envío', async () => {
    const r = await campaign(muchos)
    expect(r.status).toBe(202)
    expect(r.body.campaign.total).toBe(20)
    // Todavía no puede haber terminado: el stub duerme 50ms por destinatario.
    const enVuelo = await WaSend.countDocuments({})
    expect(enVuelo).toBeLessThan(20)

    // Y al drenar, se completan todos.
    await awaitCampaign(merchant._id.toString())
    expect(await WaSend.countDocuments({})).toBe(20)
  })

  it('no arranca una segunda campaña mientras hay una en curso (anti doble envío)', async () => {
    const primera = await campaign(muchos)
    expect(primera.status).toBe(202)
    const segunda = await campaign(muchos)
    expect(segunda.status).toBe(409)
    expect(segunda.body.error).toMatch(/en curso/i)

    await awaitCampaign(merchant._id.toString())
    // Solo se envió el primer lote, no el doble.
    expect(await WaSend.countDocuments({})).toBe(20)
  })
})
