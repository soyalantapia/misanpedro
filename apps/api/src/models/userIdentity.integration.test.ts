import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '@/models'

// [cazabug S1-01] La identidad del vecino pasa del TELÉFONO al EMAIL. El email
// es único por ciudad (dos vecinos no pueden compartirlo) y el teléfono deja de
// ser único (una familia puede compartir un celular).

let mongod: MongoMemoryServer
const appId = new Types.ObjectId()
const otroAppId = new Types.ObjectId()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.syncIndexes()
}, 120_000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await User.deleteMany({})
})

describe('User — identidad por email', () => {
  it('el email es obligatorio', async () => {
    await expect(
      User.create({ appId, nombre: 'Sin Mail', telefono: '3329421234' }),
    ).rejects.toThrow()
  })

  it('dos vecinos de la MISMA ciudad no pueden compartir email', async () => {
    await User.create({ appId, nombre: 'Ana', email: 'ana@mail.com', telefono: '3329421234' })
    await expect(
      User.create({ appId, nombre: 'Otra Ana', email: 'ana@mail.com', telefono: '3329999999' }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('el MISMO email puede existir en otra ciudad', async () => {
    await User.create({ appId, nombre: 'Ana', email: 'ana@mail.com', telefono: '3329421234' })
    const otra = await User.create({
      appId: otroAppId,
      nombre: 'Ana',
      email: 'ana@mail.com',
      telefono: '3329421234',
    })
    expect(otra._id).toBeDefined()
  })

  it('dos vecinos SÍ pueden compartir el teléfono (ya no es la identidad)', async () => {
    await User.create({ appId, nombre: 'Mamá', email: 'mama@mail.com', telefono: '3329421234' })
    const hijo = await User.create({
      appId,
      nombre: 'Hijo',
      email: 'hijo@mail.com',
      telefono: '3329421234',
    })
    expect(hijo._id).toBeDefined()
  })

  it('el email se guarda en minúsculas', async () => {
    const u = await User.create({
      appId,
      nombre: 'Ana',
      email: '  ANA@Mail.COM  ',
      telefono: '3329421234',
    })
    expect(u.email).toBe('ana@mail.com')
  })
})
