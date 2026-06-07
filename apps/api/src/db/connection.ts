import mongoose from 'mongoose'
import { env } from '@/env'
import { User } from '@/models'

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
      return m
    })
    .catch((err) => {
      connectingPromise = null
      throw err
    })

  return connectingPromise
}

mongoose.connection.on('disconnected', () => {
  console.warn('[db] disconnected')
  connectingPromise = null
})

mongoose.connection.on('error', (err) => {
  console.error('[db] error:', err.message)
})
