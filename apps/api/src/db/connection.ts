import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { env } from '@/env'
import { User, Owner } from '@/models'

let connectingPromise: Promise<typeof mongoose> | null = null

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose
  if (connectingPromise) return connectingPromise

  console.log('[db] connecting to MongoDB…')
  connectingPromise = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      // Database name se infiere del URI o usa 'misanpedro' por default
      dbName: 'misanpedro',
    })
    .then(async (m) => {
      console.log('[db] connected:', m.connection.host)
      // Reconciliación de índices de User (idempotente, NO fatal): el onboarding
      // sin fricción cambió la identidad a `telefono`. Dropea los unique viejos
      // (dni/email) que rompen el alta por dup-key en null, y crea el parcial
      // {appId,telefono}. Cuando ya está alineado es no-op. Corre dentro de
      // Railway, donde el Mongo interno sí resuelve (no se puede desde local).
      try {
        const dropped = await User.syncIndexes()
        if (dropped.length) console.log('[db] User indexes reconciliados, dropeados:', dropped)
      } catch (err) {
        console.error('[db] User.syncIndexes (no fatal):', (err as Error)?.message)
      }
      // Garantizamos el índice unique de Owner.email ANTES del bootstrap, para que
      // la creación del owner no pueda dejar duplicados si el índice aún no existía
      // (BD nueva). Idempotente, no fatal — mismo patrón que User.syncIndexes().
      try {
        await Owner.syncIndexes()
      } catch (err) {
        console.error('[db] Owner.syncIndexes (no fatal):', (err as Error)?.message)
      }
      // Bootstrap one-time del Owner (super-admin). Corre DENTRO de Railway, donde
      // el Mongo interno sí resuelve (no se puede crear desde local). Idempotente.
      try {
        await bootstrapOwner()
      } catch (err) {
        console.error('[db] bootstrapOwner (no fatal):', (err as Error)?.message)
      }
      return m
    })
    .catch((err) => {
      connectingPromise = null
      throw err
    })

  return connectingPromise
}

/**
 * Crea el Owner (super-admin) si se setearon OWNER_BOOTSTRAP_EMAIL +
 * OWNER_BOOTSTRAP_PASSWORD y todavía no existe. Idempotente: si ya existe, no hace
 * nada. Pensado para correr una vez en prod y luego borrar OWNER_BOOTSTRAP_PASSWORD.
 * El primer login del Owner pide configurar el 2FA (si OWNER_2FA_REQUIRED=true).
 */
async function bootstrapOwner(): Promise<void> {
  const email = env.OWNER_BOOTSTRAP_EMAIL?.toLowerCase().trim()
  const password = env.OWNER_BOOTSTRAP_PASSWORD?.trim()
  if (!email || !password) return
  if (password.length < 8) {
    console.warn('[bootstrap-owner] OWNER_BOOTSTRAP_PASSWORD muy corta (<8 chars) — skip')
    return
  }
  const existing = await Owner.findOne({ email })
  if (existing) {
    console.log(`[bootstrap-owner] ya existe ${email} — skip (podés borrar OWNER_BOOTSTRAP_PASSWORD del env)`)
    return
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const owner = await Owner.create({
    email,
    passwordHash,
    nombre: env.OWNER_BOOTSTRAP_NOMBRE,
    rol: 'super',
    enabled: true,
  })
  console.log(
    `[bootstrap-owner] ✅ Owner creado: ${owner.email} (rol super). ` +
      `AHORA borrá OWNER_BOOTSTRAP_PASSWORD del env por seguridad.`,
  )
}

mongoose.connection.on('disconnected', () => {
  console.warn('[db] disconnected')
  connectingPromise = null
})

mongoose.connection.on('error', (err) => {
  console.error('[db] error:', err.message)
})
