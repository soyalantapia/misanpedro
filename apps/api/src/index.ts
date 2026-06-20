import { serve, type ServerType } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import mongoose from 'mongoose'
import { env, isProd } from '@/env'
import { connectDB } from '@/db/connection'
import { merchantAuthRoutes } from '@/routes/merchant-auth'
import { userAuthRoutes } from '@/routes/user-auth'
import { merchantsRoutes } from '@/routes/merchants'
import { couponsRoutes } from '@/routes/coupons'
import { activationsRoutes } from '@/routes/activations'
import { redemptionsRoutes } from '@/routes/redemptions'
import { billingRoutes } from '@/routes/billing'
import { whatsappRoutes } from '@/routes/whatsapp'
import { templatesRoutes } from '@/routes/templates'
import { notificationsRoutes } from '@/routes/notifications'
import { adminRoutes } from '@/routes/admin'
import { ownerRoutes } from '@/routes/owner'
import { tenantRoutes } from '@/routes/tenant'
import { referralsRoutes } from '@/routes/referrals'
import { seedIfEmpty } from '@/services/seed.service'
import { startExpiryLoop, stopExpiryLoop } from '@/services/expiry.service'
import { initSentry, captureException, flushSentry } from '@/services/sentry.service'
import { httpsRedirect, requestId, securityHeaders } from '@/middleware/security'

const app = new Hono()

// 1) Request ID y security headers van primero
app.use(requestId)
app.use(securityHeaders)
app.use(httpsRedirect)
app.use(logger())

// 2) CORS
// Para GH Pages el origin es siempre la raíz (https://soyalantapia.github.io),
// el path /misanpedro no aparece en el header Origin. Por eso normalizamos
// APP_URL_FRONT a su origin antes de matchear.
function toOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}
const corsOriginList = [
  toOrigin(env.APP_URL_FRONT),
  ...(env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((s) => toOrigin(s.trim())).filter(Boolean)
    : []),
  ...(isProd ? [] : ['http://localhost:5180', 'http://127.0.0.1:5180', 'http://localhost:5173']),
]
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Permitir requests sin origin (curl, server-to-server)
      if (!origin) return origin
      // Match exacto contra la allowlist (ambos lados ya están en formato origin)
      if (corsOriginList.includes(origin)) return origin
      // Comodín de plataforma: cualquier subdominio de micuidad.com (cada ciudad
      // vive en <slug>.micuidad.com + administracion.micuidad.com). No se pueden
      // enumerar, así que permitimos por sufijo del hostname.
      try {
        const h = new URL(origin).hostname
        if (h === 'micuidad.com' || h.endsWith('.micuidad.com')) return origin
      } catch {
        /* origin malformado → rechazar */
      }
      return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // X-Tenant-Slug es necesario porque la PWA multi-tenant envía el slug
    // del comercio en cada request. Sin esto el preflight falla.
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Slug'],
    exposeHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 86400,
  }),
)

app.get('/', (c) => c.json({ name: 'Mi San Pedro API', version: '0.1.0' }))

app.get('/api/v1/health', (c) => {
  const dbReady = mongoose.connection.readyState === 1
  const mem = process.memoryUsage()
  return c.json({
    ok: true,
    env: env.NODE_ENV,
    db: dbReady ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId'),
  })
})

// Liveness/readiness separados (Kubernetes friendly)
app.get('/api/v1/health/live', (c) => c.json({ ok: true }))
app.get('/api/v1/health/ready', (c) => {
  const dbReady = mongoose.connection.readyState === 1
  return c.json({ ok: dbReady }, dbReady ? 200 : 503)
})

app.route('/api/v1/merchant/auth', merchantAuthRoutes)
app.route('/api/v1/auth', userAuthRoutes)
app.route('/api/v1/merchants', merchantsRoutes)
app.route('/api/v1/coupons', couponsRoutes)
app.route('/api/v1/activations', activationsRoutes)
app.route('/api/v1/redemptions', redemptionsRoutes)
app.route('/api/v1/billing', billingRoutes)
app.route('/api/v1/wa', whatsappRoutes)
app.route('/api/v1/templates', templatesRoutes)
app.route('/api/v1/notifications', notificationsRoutes)
app.route('/api/v1/admin', adminRoutes)
app.route('/api/v1/owner', ownerRoutes)
app.route('/api/v1/tenant', tenantRoutes)
app.route('/api/v1/referrals', referralsRoutes)

app.notFound((c) => c.json({ ok: false, error: 'not found' }, 404))

app.onError((err, c) => {
  const requestId = c.get('requestId')
  console.error('[error]', { requestId, err: err.message, stack: err.stack })
  captureException(err, { requestId, path: c.req.path })
  return c.json(
    {
      ok: false,
      error: isProd ? 'internal error' : err.message,
      requestId,
    },
    500,
  )
})

let server: ServerType | null = null

async function bootstrap() {
  await initSentry()
  try {
    await connectDB()
    await seedIfEmpty()
    startExpiryLoop()
  } catch (err) {
    console.error('[bootstrap] failed to connect DB; starting anyway:', err)
    captureException(err, { phase: 'bootstrap' })
  }

  const port = env.PORT
  server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[api] listening on http://localhost:${info.port}`)
    console.log(`[api] health: http://localhost:${info.port}/api/v1/health`)
    console.log(`[api] env: ${env.NODE_ENV} · trustProxy: ${env.TRUST_PROXY}`)
  })
}

// ─── Graceful shutdown ───────────────────────────────────────────────
let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] received ${signal}, draining…`)

  // 1) dejar de aceptar requests nuevas
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve())
      // forzar cierre después de 10s
      setTimeout(() => resolve(), 10_000).unref?.()
    })
  }

  // 2) detener jobs background
  stopExpiryLoop()

  // 3) cerrar DB
  try {
    await mongoose.disconnect()
    console.log('[shutdown] mongo disconnected')
  } catch (err) {
    console.error('[shutdown] mongo disconnect error:', err)
  }

  // 4) flush sentry
  await flushSentry()

  console.log('[shutdown] bye')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  captureException(err, { kind: 'uncaughtException' })
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
  captureException(reason, { kind: 'unhandledRejection' })
})

bootstrap()

export type AppType = typeof app
