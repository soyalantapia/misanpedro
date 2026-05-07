import mongoose from 'mongoose'
import { env } from '@/env'

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
    .then((m) => {
      console.log('[db] connected:', m.connection.host)
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
