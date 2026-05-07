import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import mongoose from 'mongoose'
import { env } from '@/env'
import { connectDB } from '@/db/connection'

const app = new Hono()

app.use(logger())
app.use(
  '*',
  cors({
    origin: [env.APP_URL_FRONT, 'http://localhost:5180', 'http://127.0.0.1:5180'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

app.get('/', (c) => c.json({ name: 'Mi San Pedro API', version: '0.1.0' }))

app.get('/api/v1/health', (c) => {
  const dbReady = mongoose.connection.readyState === 1
  return c.json({
    ok: true,
    env: env.NODE_ENV,
    db: dbReady ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

app.notFound((c) => c.json({ ok: false, error: 'not found' }, 404))

app.onError((err, c) => {
  console.error('[error]', err)
  return c.json(
    {
      ok: false,
      error: env.NODE_ENV === 'production' ? 'internal error' : err.message,
    },
    500,
  )
})

async function bootstrap() {
  try {
    await connectDB()
  } catch (err) {
    console.error('[bootstrap] failed to connect DB; starting anyway:', err)
  }

  const port = env.PORT
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[api] listening on http://localhost:${info.port}`)
    console.log(`[api] health: http://localhost:${info.port}/api/v1/health`)
  })
}

bootstrap()

export type AppType = typeof app
