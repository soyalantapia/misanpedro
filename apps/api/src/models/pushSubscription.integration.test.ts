import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { PushSubscription } from '@/models'

// Regresión: PushSubscription es único por (appId, endpoint), NO por endpoint
// global. Verifica el fix multi-tenant: un mismo browser (endpoint) puede
// suscribirse a varias ciudades, pero no dos veces a la misma.
// Found by /qa on 2026-06-23.

let mongod: MongoMemoryServer
const keys = { p256dh: 'p256dh-key', auth: 'auth-key' }

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  // Construye los índices del modelo (incl. el unique compuesto {appId,endpoint}).
  await PushSubscription.init()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('PushSubscription — unicidad por (appId, endpoint)', () => {
  it('el mismo endpoint puede existir en dos ciudades distintas', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/shared-browser'
    const appA = new Types.ObjectId()
    const appB = new Types.ObjectId()
    await PushSubscription.create({ appId: appA, endpoint, keys })
    await expect(
      PushSubscription.create({ appId: appB, endpoint, keys }),
    ).resolves.toBeTruthy()
    expect(await PushSubscription.countDocuments({ endpoint })).toBe(2)
  })

  it('NO permite duplicar (appId, endpoint) — unicidad por ciudad', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/dup'
    const appId = new Types.ObjectId()
    await PushSubscription.create({ appId, endpoint, keys })
    await expect(
      PushSubscription.create({ appId, endpoint, keys }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})
