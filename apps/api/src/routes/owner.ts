import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import {
  App,
  Owner,
  User,
  Merchant,
  Coupon,
  Activation,
  Redemption,
  Subscription,
} from '@/models'
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '@/services/jwt.service'
import {
  buildTotpUri,
  generateTotpSecret,
  verifyTotpCode,
} from '@/services/totp.service'
import { sendOwnerNewAppNotice } from '@/services/email.service'
import { requireOwnerAuth } from '@/middleware/auth'
import { env } from '@/env'

export const ownerRoutes = new Hono()

// ════════════════════════════════════════════════════════════════════
//                            AUTH
// ════════════════════════════════════════════════════════════════════

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totp: z.string().regex(/^\d{6}$/).optional(),
})

/**
 * Login del owner. Flujo:
 *  1. POST /api/v1/owner/auth/login { email, password }
 *     → si owner no tiene 2FA setup: devuelve { setup2FA: true, totpUri, secret }
 *     → si owner tiene 2FA pero falta totp: { needTotp: true }
 *     → si todo OK: { access, refresh }
 *  2. POST /api/v1/owner/auth/login { email, password, totp } → access + refresh
 *  3. POST /api/v1/owner/auth/2fa/verify { totp } → activa el 2FA (sólo primera vez)
 */
ownerRoutes.post('/auth/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email, password, totp } = parsed.data

  const owner = await Owner.findOne({ email: email.toLowerCase(), enabled: true })
  if (!owner) {
    // No revelamos si existe o no. Mismo mensaje, mismo tiempo.
    await bcrypt.compare(password, '$2a$10$invalidhashinvalidhashinvalidha')
    return c.json({ ok: false, error: 'invalid credentials' }, 401)
  }

  const passOk = await bcrypt.compare(password, owner.passwordHash)
  if (!passOk) {
    return c.json({ ok: false, error: 'invalid credentials' }, 401)
  }

  // 2FA flow opcional. Si OWNER_2FA_REQUIRED=false (default), saltamos
  // todo el flujo de TOTP y emitimos tokens directo. Si está activado,
  // se exige: setup → verify → login con código.
  if (env.OWNER_2FA_REQUIRED) {
    if (!owner.totpEnabled || !owner.totpSecret) {
      const secret = generateTotpSecret()
      const uri = buildTotpUri({ email: owner.email, secret, issuer: 'Cuponcito' })
      owner.totpSecret = secret
      await owner.save()
      return c.json({
        ok: true,
        setup2FA: true,
        totpUri: uri,
        secret,
        message:
          'Escaneá el QR con Google Authenticator y verificá con POST /owner/auth/2fa/verify',
      })
    }

    if (!totp) {
      return c.json({ ok: true, needTotp: true })
    }

    const totpOk = verifyTotpCode({ secret: owner.totpSecret, code: totp })
    if (!totpOk) {
      return c.json({ ok: false, error: 'invalid 2fa code' }, 401)
    }
  }

  // Emitir tokens
  const ua = c.req.header('user-agent')
  const ip = c.req.header('x-forwarded-for') || ''

  const access = signAccessToken({
    sub: String(owner._id),
    type: 'owner',
    rol: owner.rol,
  })
  const refresh = await issueRefreshToken({
    subjectType: 'owner',
    subjectId: String(owner._id),
    userAgent: ua,
    ip,
  })

  owner.lastLoginAt = new Date()
  owner.lastLoginIp = ip
  await owner.save()

  return c.json({
    ok: true,
    access,
    refresh: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    owner: {
      id: owner._id,
      email: owner.email,
      nombre: owner.nombre,
      rol: owner.rol,
    },
  })
})

const verify2faSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totp: z.string().regex(/^\d{6}$/),
})

/** Verifica el código TOTP la primera vez (activa el 2FA del owner). */
ownerRoutes.post('/auth/2fa/verify', async (c) => {
  const parsed = verify2faSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email, password, totp } = parsed.data
  const owner = await Owner.findOne({ email: email.toLowerCase(), enabled: true })
  if (!owner) return c.json({ ok: false, error: 'not found' }, 404)
  const passOk = await bcrypt.compare(password, owner.passwordHash)
  if (!passOk) return c.json({ ok: false, error: 'invalid credentials' }, 401)
  if (!owner.totpSecret) {
    return c.json({ ok: false, error: 'no totp secret to verify, call /login first' }, 400)
  }
  const totpOk = verifyTotpCode({ secret: owner.totpSecret, code: totp })
  if (!totpOk) return c.json({ ok: false, error: 'invalid 2fa code' }, 401)
  owner.totpEnabled = true
  await owner.save()
  return c.json({ ok: true, message: '2FA activado correctamente' })
})

/** Logout — revoca el refresh token. */
ownerRoutes.post('/auth/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (body.refresh) await revokeRefreshToken(body.refresh)
  return c.json({ ok: true })
})

/** Refresh — rotación del refresh token. */
ownerRoutes.post('/auth/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.refresh) return c.json({ ok: false, error: 'missing refresh' }, 400)
  const ua = c.req.header('user-agent')
  const ip = c.req.header('x-forwarded-for') || ''
  const rotated = await rotateRefreshToken(body.refresh, { userAgent: ua, ip })
  if (!rotated || rotated.subjectType !== 'owner') {
    return c.json({ ok: false, error: 'invalid refresh' }, 401)
  }
  const owner = await Owner.findById(rotated.subjectId)
  if (!owner || !owner.enabled) {
    return c.json({ ok: false, error: 'owner disabled' }, 403)
  }
  const access = signAccessToken({
    sub: rotated.subjectId,
    type: 'owner',
    rol: owner.rol,
  })
  return c.json({
    ok: true,
    access,
    refresh: rotated.token,
    refreshExpiresAt: rotated.expiresAt,
  })
})

/** Info del owner logueado. */
ownerRoutes.get('/me', requireOwnerAuth, async (c) => {
  const auth = c.get('auth')
  const owner = await Owner.findById(auth.sub)
  if (!owner) return c.json({ ok: false, error: 'not found' }, 404)
  return c.json({
    ok: true,
    owner: {
      id: owner._id,
      email: owner.email,
      nombre: owner.nombre,
      rol: owner.rol,
      totpEnabled: owner.totpEnabled,
      lastLoginAt: owner.lastLoginAt,
    },
  })
})

// ════════════════════════════════════════════════════════════════════
//                       DASHBOARD GLOBAL
// ════════════════════════════════════════════════════════════════════

/**
 * KPIs globales del SaaS. Cross-tenant.
 *  - Total apps + apps activas
 *  - Total comercios (activos)
 *  - Total vecinos
 *  - Total canjes últimos 30 días
 *  - MRR estimado (sum de subscriptions authorized × amountARS)
 */
ownerRoutes.get('/metrics', requireOwnerAuth, async (c) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [apps, activeApps, merchants, activeMerchants, users, redemptions30d, subs] =
    await Promise.all([
      App.countDocuments({}),
      App.countDocuments({ status: 'active' }),
      Merchant.countDocuments({}),
      Merchant.countDocuments({ estado: 'activo' }),
      User.countDocuments({}),
      Redemption.countDocuments({ redeemedAt: { $gte: thirtyDaysAgo } }),
      Subscription.find({ status: 'authorized' }).select('amountARS'),
    ])

  const mrr = subs.reduce((sum, s) => sum + (s.amountARS || 0), 0)

  return c.json({
    ok: true,
    metrics: {
      apps: { total: apps, active: activeApps },
      merchants: { total: merchants, active: activeMerchants },
      users: { total: users },
      redemptions: { last30Days: redemptions30d },
      revenue: { mrrARS: mrr, currency: 'ARS' },
    },
  })
})

// ════════════════════════════════════════════════════════════════════
//                          APPS CRUD
// ════════════════════════════════════════════════════════════════════

/** Listado de apps con KPIs por ciudad. */
ownerRoutes.get('/apps', requireOwnerAuth, async (c) => {
  const apps = await App.find({}).sort({ createdAt: -1 }).lean()

  // Para cada app, sumar KPIs cacheados (no hace queries lentas en tiempo real).
  const items = apps.map((a) => ({
    id: a._id,
    slug: a.slug,
    nombre: a.nombre,
    ciudad: a.ciudad,
    subdomain: a.subdomain,
    customDomain: a.customDomain,
    status: a.status,
    plan: a.plan,
    cachedStats: a.cachedStats,
    createdAt: a.createdAt,
  }))

  return c.json({ ok: true, apps: items })
})

const createAppSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/),
  nombre: z.string().min(2),
  ciudad: z.string().min(2),
  provincia: z.string().default('Buenos Aires'),
  subdomain: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
})

/** Crea una nueva app (ciudad). Genera el subdomain default = slug. */
ownerRoutes.post('/apps', requireOwnerAuth, async (c) => {
  const parsed = createAppSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', detail: parsed.error.flatten() }, 400)
  }
  const data = parsed.data
  const auth = c.get('auth')

  const exists = await App.findOne({ slug: data.slug })
  if (exists) return c.json({ ok: false, error: 'slug already exists' }, 409)

  const subdomain = data.subdomain ?? data.slug
  const app = await App.create({
    slug: data.slug,
    nombre: data.nombre,
    ciudad: data.ciudad,
    provincia: data.provincia,
    subdomain,
    status: 'active',
    plan: 'founder',
    brand: {
      primaryColor: data.primaryColor ?? '#695ede',
      accentColor: data.accentColor ?? '#4239a3',
    },
  })

  // Notificación al owner (no bloqueante). Si Resend no está configurado,
  // el service loguea a consola sin fallar.
  void (async () => {
    try {
      const ownerDoc = await Owner.findById(auth.sub)
      await sendOwnerNewAppNotice({
        appNombre: app.nombre,
        appSlug: app.slug,
        ciudad: app.ciudad,
        subdomain: app.subdomain,
        ownerEmail: ownerDoc?.email ?? '',
        ownerNombre: ownerDoc?.nombre ?? 'Owner',
      })
    } catch (err) {
      console.warn('[owner.createApp] email failed:', (err as Error).message)
    }
  })()

  return c.json({ ok: true, app }, 201)
})

/** Detalle de una app. */
ownerRoutes.get('/apps/:id', requireOwnerAuth, async (c) => {
  const id = c.req.param('id')
  const app = await App.findById(id)
  if (!app) return c.json({ ok: false, error: 'not found' }, 404)
  return c.json({ ok: true, app })
})

const updateAppSchema = z.object({
  nombre: z.string().min(2).optional(),
  ciudad: z.string().min(2).optional(),
  provincia: z.string().optional(),
  customDomain: z.string().optional(),
  status: z.enum(['pending', 'active', 'suspended', 'archived']).optional(),
  plan: z.enum(['founder', 'standard', 'enterprise']).optional(),
  brand: z
    .object({
      logoUrl: z.string().url().optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      heroEyebrow: z.string().optional(),
      heroHeadline: z.string().optional(),
    })
    .optional(),
})

/** Actualiza una app. */
ownerRoutes.patch('/apps/:id', requireOwnerAuth, async (c) => {
  const parsed = updateAppSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', detail: parsed.error.flatten() }, 400)
  }
  const id = c.req.param('id')
  const app = await App.findByIdAndUpdate(id, parsed.data, { new: true })
  if (!app) return c.json({ ok: false, error: 'not found' }, 404)
  return c.json({ ok: true, app })
})

/** KPIs de una app específica (más detallados que el listado). */
ownerRoutes.get('/apps/:id/metrics', requireOwnerAuth, async (c) => {
  const id = c.req.param('id')
  const app = await App.findById(id)
  if (!app) return c.json({ ok: false, error: 'not found' }, 404)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [merchants, activeMerchants, users, coupons, activeCoupons, red30d, red7d] =
    await Promise.all([
      Merchant.countDocuments({ appId: app._id }),
      Merchant.countDocuments({ appId: app._id, estado: 'activo' }),
      User.countDocuments({ appId: app._id }),
      Coupon.countDocuments({ appId: app._id }),
      Coupon.countDocuments({ appId: app._id, estado: 'activo' }),
      Redemption.countDocuments({ appId: app._id, redeemedAt: { $gte: thirtyDaysAgo } }),
      Redemption.countDocuments({ appId: app._id, redeemedAt: { $gte: sevenDaysAgo } }),
    ])

  return c.json({
    ok: true,
    metrics: {
      merchants: { total: merchants, active: activeMerchants },
      users: { total: users },
      coupons: { total: coupons, active: activeCoupons },
      redemptions: { last30Days: red30d, last7Days: red7d },
    },
  })
})

// ════════════════════════════════════════════════════════════════════
//                      USERS & MERCHANTS CROSS-APP
// ════════════════════════════════════════════════════════════════════

/**
 * Listado de comercios cross-app con filtros opcionales.
 * Query params: ?appId=, ?estado=, ?limit=50, ?offset=0
 */
ownerRoutes.get('/merchants', requireOwnerAuth, async (c) => {
  const url = new URL(c.req.url)
  const appId = url.searchParams.get('appId')
  const estado = url.searchParams.get('estado')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const filter: Record<string, unknown> = {}
  if (appId) filter.appId = appId
  if (estado) filter.estado = estado

  const [items, total] = await Promise.all([
    Merchant.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('appId', 'slug nombre')
      .lean(),
    Merchant.countDocuments(filter),
  ])

  return c.json({ ok: true, merchants: items, total, limit, offset })
})

/**
 * Listado de vecinos cross-app con filtros.
 * Query params: ?appId=, ?q=email-o-nombre, ?limit=50, ?offset=0
 */
ownerRoutes.get('/users', requireOwnerAuth, async (c) => {
  const url = new URL(c.req.url)
  const appId = url.searchParams.get('appId')
  const q = url.searchParams.get('q')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const filter: Record<string, unknown> = {}
  if (appId) filter.appId = appId
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ email: regex }, { nombre: regex }, { dni: q }]
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('appId', 'slug nombre')
      .lean(),
    User.countDocuments(filter),
  ])

  return c.json({ ok: true, users: items, total, limit, offset })
})

// ════════════════════════════════════════════════════════════════════
//                       PAGOS / BILLING
// ════════════════════════════════════════════════════════════════════

/** Listado de suscripciones con filtros. */
ownerRoutes.get('/subscriptions', requireOwnerAuth, async (c) => {
  const url = new URL(c.req.url)
  const appId = url.searchParams.get('appId')
  const status = url.searchParams.get('status')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  const filter: Record<string, unknown> = {}
  if (appId) filter.appId = appId
  if (status) filter.status = status

  const subs = await Subscription.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('appId', 'slug nombre')
    .populate('merchantId', 'nombre slug')
    .lean()

  return c.json({ ok: true, subscriptions: subs })
})

/**
 * Endpoint debug: cuántas activaciones en curso hay (útil para detectar
 * comercios con problemas de validación, scripting attacks, etc.).
 */
ownerRoutes.get('/activations/active', requireOwnerAuth, async (c) => {
  const url = new URL(c.req.url)
  const appId = url.searchParams.get('appId')
  const filter: Record<string, unknown> = { status: 'activo' }
  if (appId) filter.appId = appId

  const count = await Activation.countDocuments(filter)
  return c.json({ ok: true, active: count })
})
