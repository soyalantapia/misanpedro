import { serve, type ServerType } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { readFileSync } from 'node:fs'
import path from 'node:path'
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
import { pushRoutes } from '@/routes/push'
import { seedIfEmpty } from '@/services/seed.service'
import { startExpiryLoop, stopExpiryLoop } from '@/services/expiry.service'
import { startSnapshotLoop, stopSnapshotLoop } from '@/services/ownerSnapshot.service'
import { initWebPush } from '@/services/push.service'
import { initSentry, captureException, flushSentry } from '@/services/sentry.service'
import { httpsRedirect, requestId, securityHeaders } from '@/middleware/security'
import { findTenantByKey, toAsciiLabel } from '@/middleware/tenant'

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

// Banner del API. En prod la raíz "/" la sirve el frontend estático (ver abajo),
// así que el banner queda en /api para no taparlo.
app.get('/api', (c) => c.json({ name: 'Mi[Ciudad] API', version: '0.1.0' }))
if (!isProd) app.get('/', (c) => c.json({ name: 'Mi[Ciudad] API', version: '0.1.0' }))

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
app.route('/api/v1/push', pushRoutes)

// ──────────────────────────────────────────────────────────────────
// Frontends estáticos (SOLO en producción). El mismo servicio de Railway
// sirve la API y los dos fronts, elegidos por Host:
//   administracion.<dominio>  → apps/owner/dist  (panel super-admin, BrowserRouter)
//   cualquier otro host       → apps/web/dist    (PWA vecino + comercio, HashRouter)
// La API vive bajo /api/* y tiene prioridad. El resto sirve el archivo estático;
// si no existe, cae a index.html (SPA fallback — necesario para el BrowserRouter
// del owner). En dev no se activa: ahí el front lo sirve Vite.
// Los builds salen con base "/" (ver nixpacks.toml), por eso se sirven en la raíz.
// ──────────────────────────────────────────────────────────────────
if (isProd) {
  const WEB_ROOT = './apps/web/dist'
  const OWNER_ROOT = './apps/owner/dist'
  const rootFor = (host?: string) =>
    (host ?? '').toLowerCase().startsWith('administracion.') ? OWNER_ROOT : WEB_ROOT

  // ── Landings de marketing (path-based, host-aware) ──────────────────────
  // <ciudad>.micuidad.com/comercios → landing del comercio (capta comercios)
  // <ciudad>.micuidad.com/vecino    → landing del vecino
  // Cada landing detecta el subdomain del host y resuelve su tenant (nombre,
  // ciudad, precio, COLOR). Se buildean con base /comercios/ y /vecino/
  // (ver nixpacks.toml). Van ANTES del serving del web (raíz del host).
  // Inyecta el nombre/ciudad del tenant (resuelto por el subdomain del host) en
  // el <title>/og:* del index.html ESTÁTICO. Sin esto, el preview de redes y el
  // SEO de cada ciudad mostrarían "Mi San Pedro" (el JS arregla el title en vivo,
  // pero no el OG ni los crawlers). Fail-open: si algo falla, sirve el html crudo.
  const RESERVED_SUB = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios', 'administracion', 'ciudades', 'vecino'])
  const LEGACY = 'https://misanpedro.com'
  // El nombre/ciudad del tenant los controla el owner y se inyectan en el HTML
  // servido (<title>, atributos de <meta>, y strings dentro del <script
  // application/ld+json>). Escapamos &<>"' antes de inyectar: hace el valor
  // seguro en los tres contextos a la vez — en particular `<` → `&lt;` impide
  // romper con `</script>` el bloque JSON-LD (XSS almacenado). Mismo escape para
  // el host, que también termina en atributos OG.
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  // Texto accesible (#fff o tinta) sobre la marca, por luminancia WCAG. Lo
  // inyectamos junto al color para que el primer paint (pre-JS) ya tenga el texto
  // de los CTA en el color legible si la marca de la ciudad es clara.
  const onBrandText = (hex: string): string => {
    const m = hex.replace('#', '')
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#ffffff'
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const L =
      0.2126 * lin(parseInt(full.slice(0, 2), 16) / 255) +
      0.7152 * lin(parseInt(full.slice(2, 4), 16) / 255) +
      0.0722 * lin(parseInt(full.slice(4, 6), 16) / 255)
    return L > 0.4 ? '#241a14' : '#ffffff'
  }
  const injectLandingMeta = async (html: string, host?: string, prefix = ''): Promise<string> => {
    try {
      const h = (host ?? '').toLowerCase().split(':')[0]
      const parts = h.split('.')
      if (parts.length < 3) return html
      const sub = toAsciiLabel(parts[0])
      if (RESERVED_SUB.has(sub)) return html
      const tenant = await findTenantByKey(sub)
      if (!tenant) return html
      const t = tenant as {
        nombre?: string; ciudad?: string; provincia?: string; pais?: string
        moneda?: string; locale?: string; precioMensual?: number
        customDomain?: string; brand?: { primaryColor?: string }
      }
      // Anti canonical/OG poisoning: solo reescribimos URLs por host si el Host es
      // de la plataforma (*.micuidad.com) o el dominio propio del tenant. Un Host
      // header hostil (reflejado) no debe terminar en canonical/og:url/og:image.
      const allowedHost =
        h.endsWith('.micuidad.com') ||
        (typeof t.customDomain === 'string' && h === t.customDomain.toLowerCase())
      if (!allowedHost) return html
      const safeHost = escapeHtml(h)
      const esc = (v: unknown) => escapeHtml(String(v))
      let out = html
      if (t.nombre) out = out.replaceAll('Mi San Pedro', esc(t.nombre))
      if (t.ciudad) out = out.replaceAll('San Pedro', esc(t.ciudad))
      // Geo del JSON-LD (provincia/país) — si no, en Nariño quedaba el sinsentido
      // "Nariño, Buenos Aires, Argentina". Solo aparecen en el bloque JSON-LD.
      if (t.provincia) out = out.replaceAll('Buenos Aires', esc(t.provincia))
      if (t.pais) out = out.replaceAll('Argentina', esc(t.pais))
      // Idioma/locale: <html lang>, availableLanguage (es-AR) y og:locale (es_AR).
      if (t.locale) {
        out = out
          .replaceAll('es-AR', esc(t.locale))
          .replaceAll('es_AR', esc(String(t.locale).replace('-', '_')))
      }
      // Precio/moneda del JSON-LD Offer — antes anunciaba 50000 ARS a TODA ciudad
      // (Google lo ingiere para rich results). Solo están en el JSON-LD del comercio.
      if (t.precioMensual) out = out.replaceAll('"50000"', `"${esc(t.precioMensual)}"`)
      if (t.moneda) out = out.replaceAll('"ARS"', `"${esc(t.moneda)}"`)
      // Color de marca: theme-color + un <style> que setea --color-brand en el HTML
      // servido, para que el PRIMER paint ya use el color de la ciudad (sin el FOUC
      // naranja-San-Pedro antes de que cargue el JS). Solo si es un HEX válido — el
      // valor va a un atributo y a un bloque <style>, así que un color hostil podría
      // romper afuera; el guard lo evita.
      const brand = t.brand?.primaryColor
      if (typeof brand === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(brand)) {
        out = out.replaceAll('#ea580c', brand)
        out = out.replace(
          '</head>',
          `<style>:root{--color-brand:${brand};--color-on-brand:${onBrandText(brand)}}</style></head>`,
        )
      }
      // URLs absolutas del dominio legacy → host de la ciudad, respetando el path
      // del landing. El comercio ya trae /comercios/ en su index; el vecino trae
      // el dominio pelado (og:url, og-image) y hay que prefijarle /vecino/.
      // Orden: específico→pelado para no doble-prefijar.
      out = out
        .replaceAll(`${LEGACY}${prefix}/`, `https://${safeHost}${prefix}/`)
        .replaceAll(`${LEGACY}/`, `https://${safeHost}${prefix}/`)
        .replaceAll(LEGACY, `https://${safeHost}`)
      return out
    } catch {
      return html
    }
  }

  const mountLanding = (prefix: string, root: string) => {
    const serveIndex = async (c: import('hono').Context) => {
      try {
        const raw = readFileSync(path.join(root, 'index.html'), 'utf8')
        return c.html(await injectLandingMeta(raw, c.req.header('host'), prefix))
      } catch {
        return c.text('landing no disponible', 500)
      }
    }
    // Sin barra → con barra. El index (con barra) se sirve inyectado, ANTES que
    // serveStatic, para no servir el index.html crudo (sin meta del tenant).
    app.get(prefix, (c) => c.redirect(`${prefix}/`))
    app.get(`${prefix}/`, serveIndex)
    // Assets/archivos reales: /comercios/assets/x → root/assets/x (strip prefijo).
    // Los assets de Vite llevan hash en el nombre = inmutables → cache 1 año.
    app.use(
      `${prefix}/*`,
      serveStatic({
        root,
        rewriteRequestPath: (p) => p.slice(prefix.length) || '/',
        onFound: (_p, ctx) => {
          if (ctx.req.path.includes('/assets/')) {
            ctx.header('Cache-Control', 'public, max-age=31536000, immutable')
          }
        },
      }),
    )
    // SPA fallback → index inyectado. PERO un request de ARCHIVO que no existió
    // (ej. chunk hasheado viejo tras un redeploy, o cualquier cosa bajo /assets/)
    // NO debe caer al index (text/html): con nosniff el browser rechaza el .js.
    // Para esos paths devolvemos 404 limpio; el resto sí es ruta → index.
    app.get(`${prefix}/*`, (c) => {
      const rel = c.req.path.slice(prefix.length)
      if (rel.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(rel)) return c.notFound()
      return serveIndex(c)
    })
  }
  mountLanding('/comercios', './apps/landing/dist')
  mountLanding('/vecino', './apps/landing-vecino/dist')

  // robots.txt y sitemap.xml a NIVEL HOST-ROOT: los crawlers los piden en la raíz
  // del host (https://<ciudad>.micuidad.com/robots.txt), NO bajo /comercios. Antes
  // caían al SPA fallback y devolvían el index.html (HTML donde va texto plano), y
  // los sitemaps horneados apuntaban a URLs muertas de GH Pages/misanpedro.com. Acá
  // se generan por-host con las URLs reales de la ciudad. administracion = no indexar.
  // El host se sanitiza al charset de hostname (sin inyección en el txt/XML).
  const safeHostOf = (c: import('hono').Context) =>
    (c.req.header('host') ?? '').toLowerCase().split(':')[0].replace(/[^a-z0-9.-]/g, '')
  app.get('/robots.txt', (c) => {
    const host = safeHostOf(c)
    if (host.startsWith('administracion.')) return c.text('User-agent: *\nDisallow: /\n')
    return c.text(`User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`)
  })
  app.get('/sitemap.xml', (c) => {
    const host = safeHostOf(c)
    if (!host || host.startsWith('administracion.')) return c.notFound()
    const urls = [`https://${host}/`, `https://${host}/comercios/`, `https://${host}/vecino/`]
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join('\n')}\n</urlset>\n`
    return c.body(body, 200, { 'content-type': 'application/xml; charset=utf-8' })
  })

  // 1) Archivos reales (assets/manifest/sw/íconos). Si existe, lo sirve. Los
  //    assets hasheados de Vite son inmutables → cache 1 año (igual que landings).
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api')) return next()
    return serveStatic({
      root: rootFor(c.req.header('host')),
      onFound: (_p, ctx) => {
        if (ctx.req.path.includes('/assets/')) {
          ctx.header('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    })(c, next)
  })
  // 2) SPA fallback: ruta no-API que no matcheó archivo → index.html del front.
  //    Un request de ARCHIVO inexistente (chunk hasheado viejo tras un redeploy, o
  //    algo bajo /assets/) → 404 limpio, NO el index: con nosniff el browser
  //    rechaza un .js servido como text/html. El web usa HashRouter, así que las
  //    rutas reales no tienen extensión → el guard no las afecta.
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) return c.notFound()
    if (c.req.path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(c.req.path)) return c.notFound()
    try {
      const html = readFileSync(path.join(rootFor(c.req.header('host')), 'index.html'), 'utf8')
      return c.html(html)
    } catch {
      return c.text('frontend no disponible', 500)
    }
  })
}

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
    initWebPush()
    startExpiryLoop()
    startSnapshotLoop()
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
  stopSnapshotLoop()

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
