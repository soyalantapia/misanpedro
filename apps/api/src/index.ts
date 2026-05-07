import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import mongoose from 'mongoose'
import { env } from '@/env'
import { connectDB } from '@/db/connection'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { userAuthRoutes } from '@/routes/user-auth'
import { merchantsRoutes } from '@/routes/merchants'
import { couponsRoutes } from '@/routes/coupons'
import { activationsRoutes } from '@/routes/activations'
import { redemptionsRoutes } from '@/routes/redemptions'
import { billingRoutes } from '@/routes/billing'
import { whatsappRoutes } from '@/routes/whatsapp'
import { seedIfEmpty } from '@/services/seed.service'

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

app.route('/api/v1/merchant/auth', merchantAuthRoutes)
app.route('/api/v1/auth', userAuthRoutes)
app.route('/api/v1/merchants', merchantsRoutes)
app.route('/api/v1/coupons', couponsRoutes)
app.route('/api/v1/activations', activationsRoutes)
app.route('/api/v1/redemptions', redemptionsRoutes)
app.route('/api/v1/billing', billingRoutes)
app.route('/api/v1/wa', whatsappRoutes)

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
    await seedIfEmpty()
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
