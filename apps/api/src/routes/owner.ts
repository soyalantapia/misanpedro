import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Types } from 'mongoose'
import { createHash, randomBytes } from 'node:crypto'
import {
  App,
  Owner,
  User,
  Merchant,
  Coupon,
  Activation,
  Redemption,
  Subscription,
  PasswordReset,
} from '@/models'
import { toAsciiLabel } from '@/middleware/tenant'
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import {
  buildTotpUri,
  generateTotpSecret,
  verifyTotpCode,
} from '@/services/totp.service'
import { sendOwnerNewAppNotice, sendPasswordResetLink } from '@/services/email.service'
import { requireOwnerAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { env } from '@/env'

export const ownerRoutes = new Hono()

// Anti fuerza-bruta del login del owner. La cuenta es cross-tenant y (por
// decisión) sin 2FA, así que el password es el único factor: limitamos los
// intentos por IP para que no quede expuesto a fuerza bruta sin freno.
const ownerLoginLimiter = rateLimit({ prefix: 'owner-login', max: 10, windowMs: 60_000 })

/**
 * Audit log mini del owner: registra la acción en `recentActions` (últimas 20,
 * vía $slice). No bloquea ni rompe la operación si falla. Da trazabilidad
 * cross-tenant (quién creó/editó/suspendió qué) — antes el campo existía pero
 * nunca se escribía.
 */
async function logOwnerAction(ownerId: string | undefined, action: string, ip?: string, detail?: string) {
  if (!ownerId) return
  try {
    await Owner.updateOne(
      { _id: ownerId },
      {
        $push: {
          recentActions: {
            $each: [{ action, at: new Date(), ip: ip || undefined, detail }],
            $slice: -20,
          },
        },
      },
    )
  } catch (err) {
    console.error('[owner-audit]', (err as Error)?.message)
  }
}

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
ownerRoutes.post('/auth/login', ownerLoginLimiter, async (c) => {
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
      const uri = buildTotpUri({ email: owner.email, secret, issuer: 'Mi Ciudad' })
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

// ─── O1: Password recovery del owner ──────────────────────────────────
// Reusamos el modelo PasswordReset (ahora soporta ownerId | merchantUserId)
// y el patrón de hash-en-DB + plain-en-email + single-use + TTL 30 min.
// Sin esto el owner del SaaS queda lockout-eado si pierde su password.

const OWNER_RESET_TTL_MS = 30 * 60 * 1000
const ownerForgotLimiter = rateLimit({
  prefix: 'owner-forgot',
  max: 5,
  windowMs: 60 * 60_000,
})
const ownerForgotSchema = z.object({ email: z.string().email().toLowerCase() })

ownerRoutes.post('/auth/forgot-password', ownerForgotLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = ownerForgotSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const owner = await Owner.findOne({ email: parsed.data.email, enabled: true })
  // Anti-enumeration: siempre OK aunque el email no exista
  if (!owner) return c.json({ ok: true })

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + OWNER_RESET_TTL_MS)

  await PasswordReset.deleteMany({ ownerId: owner._id })
  await PasswordReset.create({
    ownerId: owner._id,
    tokenHash,
    expiresAt,
    requestedFromUa: c.req.header('user-agent'),
  })

  // Para el Owner panel el link va al deploy del owner panel, no al PWA.
  // En prod (admin.misanpedro.app) usamos env.OWNER_APP_URL si está set,
  // sino caemos a APP_URL_FRONT con prefijo /owner como convención.
  const ownerUrl = (env as unknown as { OWNER_APP_URL?: string }).OWNER_APP_URL
    ?? env.APP_URL_FRONT.replace(/\/?$/, '') + '/owner'
  const resetLink = `${ownerUrl}/#/reset-password?token=${token}`
  sendPasswordResetLink({
    to: owner.email,
    nombre: owner.nombre ?? owner.email.split('@')[0],
    link: resetLink,
  }).catch((err) => console.error('[owner-reset-email]', err))

  return c.json({ ok: true })
})

const ownerResetSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

ownerRoutes.post('/auth/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = ownerResetSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const reset = await PasswordReset.findOne({ tokenHash })
  if (!reset || reset.usedAt) return c.json({ ok: false, error: 'token inválido' }, 401)
  if (reset.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'token expirado' }, 401)
  }
  if (!reset.ownerId) {
    // Token de otro subject (merchantUser) — rechazo
    return c.json({ ok: false, error: 'token inválido' }, 401)
  }

  const owner = await Owner.findById(reset.ownerId)
  if (!owner || !owner.enabled) return c.json({ ok: false, error: 'owner not found' }, 404)

  owner.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await owner.save()

  reset.usedAt = new Date()
  await reset.save()

  await revokeAllForSubject(owner._id.toString())

  return c.json({ ok: true })
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

/** Audit log del owner: últimas acciones (más recientes primero). */
ownerRoutes.get('/me/audit', requireOwnerAuth, async (c) => {
  const auth = c.get('auth')
  const owner = await Owner.findById(auth.sub).select('recentActions')
  if (!owner) return c.json({ ok: false, error: 'not found' }, 404)
  const actions = [...(owner.recentActions ?? [])].reverse()
  return c.json({ ok: true, actions })
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
      Subscription.find({ status: 'authorized' }).select('amountARS currency'),
    ])

  const byCurrency: Record<string, number> = {}
  for (const sub of subs) {
    const cur = (sub.currency as string | undefined) ?? 'ARS'
    byCurrency[cur] = (byCurrency[cur] ?? 0) + (sub.amountARS || 0)
  }
  const mrrARS = byCurrency['ARS'] ?? 0

  return c.json({
    ok: true,
    metrics: {
      apps: { total: apps, active: activeApps },
      merchants: { total: merchants, active: activeMerchants },
      users: { total: users },
      redemptions: { last30Days: redemptions30d },
      revenue: { mrrARS, currency: 'ARS', byCurrency },
    },
  })
})

// ════════════════════════════════════════════════════════════════════
//                          APPS CRUD
// ════════════════════════════════════════════════════════════════════

/** Listado de apps con KPIs por ciudad. */
ownerRoutes.get('/apps', requireOwnerAuth, async (c) => {
  const apps = await App.find({}).sort({ createdAt: -1 }).lean()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Stats por ciudad calculadas EN VIVO (mismas queries que /apps/:id/metrics).
  // Antes se leía App.cachedStats, pero ningún job lo actualizaba → siempre daba 0.
  // Con pocas ciudades el conteo es barato; mantenemos el shape para no tocar el front.
  const items = await Promise.all(
    apps.map(async (a) => {
      const [totalMerchants, activeMerchants, totalUsers, activeCoupons, redemptionsLast30Days] =
        await Promise.all([
          Merchant.countDocuments({ appId: a._id }),
          Merchant.countDocuments({ appId: a._id, estado: 'activo' }),
          User.countDocuments({ appId: a._id }),
          Coupon.countDocuments({ appId: a._id, estado: 'activo' }),
          Redemption.countDocuments({ appId: a._id, redeemedAt: { $gte: thirtyDaysAgo } }),
        ])
      return {
        id: a._id,
        slug: a.slug,
        nombre: a.nombre,
        ciudad: a.ciudad,
        pais: a.pais,
        moneda: a.moneda,
        locale: a.locale,
        precioMensual: a.precioMensual,
        subdomain: a.subdomain,
        customDomain: a.customDomain,
        status: a.status,
        plan: a.plan,
        cachedStats: {
          totalMerchants,
          activeMerchants,
          totalUsers,
          activeCoupons,
          redemptionsLast30Days,
          lastUpdatedAt: new Date(),
        },
        createdAt: a.createdAt,
      }
    }),
  )

  return c.json({ ok: true, apps: items })
})

/** Datos legales/fiscales del responsable de la ciudad (para Términos/Privacidad). */
const legalSchema = z
  .object({
    razonSocial: z.string().max(200).optional(),
    taxId: z.string().max(40).optional(),
    taxIdLabel: z.string().max(20).optional(),
    condicionFiscal: z.string().max(200).optional(),
    domicilio: z.string().max(300).optional(),
    jurisdiccion: z.string().max(300).optional(),
  })
  .optional()

const createAppSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/),
  nombre: z.string().min(2),
  ciudad: z.string().min(2),
  provincia: z.string().default('Buenos Aires'),
  pais: z.string().default('Argentina'),
  // Localización (ciudades multi-país). Defaults = AR. Validamos formato para que
  // un valor inválido no llegue a Intl.NumberFormat en el front (RangeError).
  moneda: z
    .string()
    .regex(/^[A-Z]{3}$/, 'moneda debe ser ISO-4217 (3 letras mayúsculas)')
    .default('ARS'),
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z]{2,4})?$/, 'locale debe ser BCP-47 (ej. es-AR)')
    .default('es-AR'),
  phonePrefix: z
    .string()
    .regex(/^\+\d{1,4}$/, 'prefijo debe ser tipo +57')
    .optional(),
  precioMensual: z.number().min(1).optional(), // monto mensual del comercio, en la moneda del tenant
  subdomain: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  // Centro del mapa de la ciudad — para que el mapa del alta de comercio caiga
  // en la ciudad correcta (no en San Pedro). Lo setea el owner al crear/editar.
  geoCenter: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  legal: legalSchema,
})

/** Crea una nueva app (ciudad). Genera el subdomain default = slug. */
ownerRoutes.post('/apps', requireOwnerAuth, async (c) => {
  const parsed = createAppSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', detail: parsed.error.flatten() }, 400)
  }
  const data = parsed.data
  const auth = c.get('auth')

  const RESERVED_SLUGS = new Set(['www','api','admin','owner','app','comercios','administracion','ciudades'])
  if (RESERVED_SLUGS.has(data.slug)) {
    return c.json({ ok: false, error: 'slug reservado' }, 409)
  }

  const exists = await App.findOne({ slug: data.slug })
  if (exists) return c.json({ ok: false, error: 'slug already exists' }, 409)

  // Convención de plataforma: cada ciudad vive en mi<slug>.micuidad.com. Si el
  // owner no especifica subdomain, lo derivamos. Normalizamos a ASCII (punycode)
  // para que IDN como 'minariño' matcheen el label del host.
  const subdomain = toAsciiLabel(data.subdomain?.trim() || `mi${data.slug}`)
  const app = await App.create({
    slug: data.slug,
    nombre: data.nombre,
    ciudad: data.ciudad,
    provincia: data.provincia,
    pais: data.pais,
    moneda: data.moneda,
    locale: data.locale,
    ...(data.phonePrefix ? { phonePrefix: data.phonePrefix } : {}),
    precioMensual: data.precioMensual,
    subdomain,
    status: 'active',
    plan: 'founder',
    brand: {
      primaryColor: data.primaryColor ?? '#ea580c',
      accentColor: data.accentColor ?? '#c2410c',
    },
    ...(data.legal ? { legal: data.legal } : {}),
    ...(data.geoCenter ? { geoCenter: data.geoCenter } : {}),
  })

  await logOwnerAction(auth.sub, 'app.create', c.req.header('x-forwarded-for'), `${app.slug} · ${app.nombre}`)

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
  pais: z.string().optional(),
  // Localización (ciudades multi-país). Opcionales en el PATCH, mismo formato.
  moneda: z
    .string()
    .regex(/^[A-Z]{3}$/, 'moneda debe ser ISO-4217 (3 letras mayúsculas)')
    .optional(),
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z]{2,4})?$/, 'locale debe ser BCP-47 (ej. es-AR)')
    .optional(),
  phonePrefix: z
    .string()
    .regex(/^\+\d{1,4}$/, 'prefijo debe ser tipo +57')
    .optional(),
  precioMensual: z.number().min(1).optional(),
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
  geoCenter: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  legal: legalSchema,
})

/** Actualiza una app. */
ownerRoutes.patch('/apps/:id', requireOwnerAuth, async (c) => {
  const parsed = updateAppSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', detail: parsed.error.flatten() }, 400)
  }
  const id = c.req.param('id')
  const auth = c.get('auth')
  let app
  try {
    app = await App.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true })
  } catch (err) {
    // Índice unique en customDomain/subdomain: si choca con otra ciudad, Mongo
    // tira E11000. Lo traducimos a 409 en vez de dejar que suba como 500.
    if ((err as { code?: number })?.code === 11000) {
      return c.json({ ok: false, error: 'customDomain o subdomain ya en uso por otra ciudad' }, 409)
    }
    throw err
  }
  if (!app) return c.json({ ok: false, error: 'not found' }, 404)
  await logOwnerAction(
    auth.sub,
    'app.update',
    c.req.header('x-forwarded-for'),
    `${app.slug} · ${Object.keys(parsed.data).join(', ')}`,
  )
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

/** Suspender / reactivar un comercio desde el owner. */
const merchantActionSchema = z.object({ estado: z.enum(['activo', 'suspendido']) })
ownerRoutes.patch('/merchants/:id', requireOwnerAuth, async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const parsed = merchantActionSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const merchant = await Merchant.findByIdAndUpdate(id, { estado: parsed.data.estado }, { new: true })
  if (!merchant) return c.json({ ok: false, error: 'not found' }, 404)
  await logOwnerAction(
    auth.sub,
    parsed.data.estado === 'suspendido' ? 'merchant.suspend' : 'merchant.reactivate',
    c.req.header('x-forwarded-for'),
    `${merchant.nombre} (${String(merchant._id)})`,
  )
  return c.json({ ok: true, merchant })
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
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const filter: Record<string, unknown> = {}
  if (appId) filter.appId = appId
  if (status) filter.status = status

  const [subs, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('appId', 'slug nombre')
      .populate('merchantId', 'nombre slug')
      .lean(),
    Subscription.countDocuments(filter),
  ])

  return c.json({ ok: true, subscriptions: subs, total, limit, offset })
})

/** Pausar / cancelar / reactivar una suscripción desde el owner. */
const subscriptionActionSchema = z.object({ status: z.enum(['authorized', 'paused', 'cancelled']) })
ownerRoutes.patch('/subscriptions/:id', requireOwnerAuth, async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const parsed = subscriptionActionSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const sub = await Subscription.findByIdAndUpdate(id, { status: parsed.data.status }, { new: true })
  if (!sub) return c.json({ ok: false, error: 'not found' }, 404)
  await logOwnerAction(
    auth.sub,
    `subscription.${parsed.data.status}`,
    c.req.header('x-forwarded-for'),
    sub.externalReference ?? String(sub._id),
  )
  return c.json({ ok: true, subscription: sub })
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
