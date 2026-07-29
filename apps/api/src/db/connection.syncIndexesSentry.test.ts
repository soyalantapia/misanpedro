import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Mockeamos Sentry ANTES de cualquier import (vi.mock se hoistea): así el
// `captureException` que usa `@/db/connection` es este mock, no un no-op real.
vi.mock('@/services/sentry.service', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  initSentry: vi.fn(async () => {}),
  flushSentry: vi.fn(async () => {}),
}))

/**
 * [cazabug] Si `User.syncIndexes()` falla al arrancar (ej. porque ya hay
 * duplicados en la base y no se puede recrear el unique {appId,email}), el API
 * arranca SIN esa garantía: el handler de carrera de /claim (`err.code===11000`)
 * nunca dispara y se pueden crear DOS cuentas con el mismo email. Antes esto
 * sólo quedaba en un `console.error` que nadie mira en los logs de Railway.
 * Este test prueba que TAMBIÉN se manda a Sentry (ruidoso, visible, no fatal).
 *
 * `MONGODB_URI` hay que fijarlo ANTES de importar `@/env`/`@/db/connection`
 * (que lo leen una sola vez al cargar el módulo) — por eso todo lo que depende
 * de esa env var se importa con `import()` dinámico DESPUÉS de setearla acá,
 * en vez de con un `import` estático arriba del archivo.
 */
let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
  // Sin esto, connectDB() saltea TODAS las mutaciones de boot (guard anti-mutación
  // de prod [cazabug S14-02]) y syncIndexes ni se llama.
  process.env.DB_BOOTSTRAP = 'true'
}, 120_000)

afterAll(async () => {
  const mongoose = (await import('mongoose')).default
  await mongoose.disconnect().catch(() => {})
  await mongod.stop()
  delete process.env.DB_BOOTSTRAP
})

describe('connectDB — User.syncIndexes() fallando no puede quedar silencioso', () => {
  it('el error se manda a Sentry (captureException), no sólo a console.error', async () => {
    const { User } = await import('@/models')
    const { captureException } = await import('@/services/sentry.service')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('E11000 duplicate key: appId_1_email_1 dup key')
    vi.spyOn(User, 'syncIndexes').mockRejectedValueOnce(boom)

    const { connectDB } = await import('@/db/connection')
    await connectDB()

    expect(captureException).toHaveBeenCalled()
    const call = vi.mocked(captureException).mock.calls.find(([err]) => err === boom)
    expect(call).toBeTruthy()
    // El contexto tiene que dejar clara la razón: qué índice y qué garantía se
    // pierde — así quien lea Sentry entiende la gravedad sin tener que investigar.
    expect(call?.[1]).toMatchObject({ index: 'User.syncIndexes' })

    // No fatal: connectDB() tiene que resolver igual (el server arranca).
    consoleErrorSpy.mockRestore()
    // Timeout explícito: connectDB() corre la secuencia de arranque COMPLETA
    // contra un mongod recién levantado, y cada syncIndexes cuesta 1,5–4s con la
    // base fría (medido: Owner 4,1s · Push 1,4s · Subscription 1,7s). Con el
    // default de 5s el test venía raspando el límite y se cayó al sumarse el
    // cuarto índice. No es lentitud del código: contra un Atlas caliente y ya
    // alineado son no-ops.
  }, 60_000)
})
