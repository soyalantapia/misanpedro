import { Hono } from 'hono'
import { z } from 'zod'
import { Types } from 'mongoose'
import { createHash, randomInt } from 'node:crypto'
import {
  App,
  Owner,
  Otp,
  User,
  Merchant,
  Coupon,
  Activation,
  Redemption,
  Subscription,
  MrrSnapshot,
} from '@/models'
import { OWNER_ROLES } from '@/models/Owner'
import { computeOwnerStats } from '@/services/ownerStats.service'
import { toAsciiLabel } from '@/middleware/tenant'
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import {
  sendOwnerNewAppNotice,
  sendOwnerOtpCode,
  sendOwnerTeamInvite,
} from '@/services/email.service'
import { requireOwnerAuth, requireOwnerRole } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'

export const ownerRoutes = new Hono()

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

// ─── Login OTP (passwordless) ─────────────────────────────────────────
// El owner entra con un código de 6 dígitos al email, sin contraseña — mismo
// patrón que el comercio (merchant-auth.ts) pero CROSS-TENANT (sin appId).
const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const otpRequestLimiter = rateLimit({ prefix: 'owner-otp-request', max: 5, windowMs: 60 * 60_000 })
const otpVerifyLimiter = rateLimit({ prefix: 'owner-otp-verify', max: 10, windowMs: 60_000 })
const otpRequestSchema = z.object({ email: z.string().email().toLowerCase() })
const otpVerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/),
})

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const generateOtp = () => randomInt(100_000, 1_000_000).toString()

ownerRoutes.post('/auth/request-otp', otpRequestLimiter, async (c) => {
  const parsed = otpRequestSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email } = parsed.data

  const owner = await Owner.findOne({ email, enabled: true })
  // Anti-enumeración: respondemos OK aunque el email no exista / esté deshabilitado.
  if (!owner) return c.json({ ok: true })

  await Otp.deleteMany({ email, purpose: 'owner' })
  const code = generateOtp()
  await Otp.create({
    email,
    purpose: 'owner',
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })
  console.log(`[otp/owner] ${email} → ${code}`)

  // En prod esperamos el envío: si el email no sale, 503 (no un "ok" falso que
  // dejaría al admin afuera). En dev devolvemos el código para testear el flujo.
  if (process.env.NODE_ENV === 'production') {
    const sent = await sendOwnerOtpCode(email, code).catch((err) => {
      console.error('[owner-otp-email]', err)
      return { ok: false as const }
    })
    if (!sent.ok) {
      return c.json(
        { ok: false, error: 'No pudimos enviar el código. Probá de nuevo en unos minutos.' },
        503,
      )
    }
    return c.json({ ok: true })
  }
  sendOwnerOtpCode(email, code).catch((err) => console.error('[owner-otp-email]', err))
  return c.json({ ok: true, _debugCode: code })
})

ownerRoutes.post('/auth/verify-otp', otpVerifyLimiter, async (c) => {
  const parsed = otpVerifySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ email, purpose: 'owner' })
  if (!otp || otp.consumedAt) return c.json({ ok: false, error: 'código inválido' }, 401)
  if (otp.expiresAt.getTime() < Date.now()) return c.json({ ok: false, error: 'código expirado' }, 401)
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return c.json({ ok: false, error: 'demasiados intentos' }, 429)
  if (sha256(code) !== otp.codeHash) {
    otp.attempts += 1
    await otp.save()
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }
  // Anti-replay: consumimos el código antes de emitir tokens.
  otp.consumedAt = new Date()
  await otp.save()

  const owner = await Owner.findOne({ email, enabled: true })
  if (!owner) return c.json({ ok: false, error: 'no encontrado' }, 404)

  const ua = c.req.header('user-agent')
  const ip = c.req.header('x-forwarded-for') || ''
  const access = signAccessToken({ sub: String(owner._id), type: 'owner', rol: owner.rol })
  const refresh = await issueRefreshToken({
    subjectType: 'owner',
    subjectId: String(owner._id),
    userAgent: ua,
    ip,
  })
  owner.lastLoginAt = new Date()
  owner.lastLoginIp = ip
  await owner.save()
  await logOwnerAction(String(owner._id), 'auth.login', ip, owner.email)

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
//              EQUIPO (multi-admin con roles — solo super)
// ════════════════════════════════════════════════════════════════════

const inviteAdminSchema = z.object({
  email: z.string().email().toLowerCase(),
  nombre: z.string().min(2).max(80),
  rol: z.enum(OWNER_ROLES),
})
const updateAdminSchema = z.object({
  rol: z.enum(OWNER_ROLES).optional(),
  enabled: z.boolean().optional(),
})

/** Lista de administradores del panel. */
ownerRoutes.get('/admins', requireOwnerAuth, requireOwnerRole('super'), async (c) => {
  const admins = await Owner.find(
    {},
    'email nombre rol enabled lastLoginAt invitedAt createdAt',
  )
    .sort({ createdAt: 1 })
    .lean()
  return c.json({
    ok: true,
    admins: admins.map((a) => ({
      id: String(a._id),
      email: a.email,
      nombre: a.nombre,
      rol: a.rol,
      enabled: a.enabled,
      lastLoginAt: a.lastLoginAt,
      invitedAt: a.invitedAt,
      createdAt: a.createdAt,
    })),
  })
})

/** Invitar un nuevo administrador (entra por OTP con su email, sin contraseña). */
ownerRoutes.post('/admins', requireOwnerAuth, requireOwnerRole('super'), async (c) => {
  const auth = c.get('auth')
  const parsed = inviteAdminSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email, nombre, rol } = parsed.data

  const existing = await Owner.findOne({ email })
  if (existing) return c.json({ ok: false, error: 'Ya existe un administrador con ese email' }, 409)

  const admin = await Owner.create({
    email,
    nombre,
    rol,
    enabled: true,
    invitedByOwnerId: auth.sub,
    invitedAt: new Date(),
  })
  const ip = c.req.header('x-forwarded-for') || ''
  await logOwnerAction(String(auth.sub), 'admin.invite', ip, `${email} · ${rol}`)
  const ownerUrl = process.env.OWNER_APP_URL || undefined
  sendOwnerTeamInvite({ to: email, nombre, rol, loginUrl: ownerUrl }).catch((err) =>
    console.error('[owner-invite-email]', err),
  )
  return c.json({
    ok: true,
    admin: { id: String(admin._id), email, nombre, rol, enabled: true },
  })
})

/** Cambiar rol / habilitar-deshabilitar un administrador. Guard "último super". */
ownerRoutes.patch('/admins/:id', requireOwnerAuth, requireOwnerRole('super'), async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'no encontrado' }, 404)
  const parsed = updateAdminSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const target = await Owner.findById(id)
  if (!target) return c.json({ ok: false, error: 'no encontrado' }, 404)
  const { rol, enabled } = parsed.data

  // Guard "último super": no degradar/deshabilitar al único super enabled.
  const degradaUltimoSuper =
    target.rol === 'super' && ((rol !== undefined && rol !== 'super') || enabled === false)
  if (degradaUltimoSuper) {
    const supersActivos = await Owner.countDocuments({ rol: 'super', enabled: true })
    if (supersActivos <= 1) {
      return c.json({ ok: false, error: 'No podés degradar/deshabilitar al último super-admin' }, 409)
    }
  }

  const rolCambia = rol !== undefined && rol !== target.rol
  if (rol !== undefined) target.rol = rol
  if (enabled !== undefined) target.enabled = enabled
  await target.save()
  // Si se deshabilita o cambia el rol, cortamos sus sesiones (el access muere en ≤1h).
  if (enabled === false || rolCambia) {
    await revokeAllForSubject(String(target._id)).catch(() => {})
  }
  const ip = c.req.header('x-forwarded-for') || ''
  await logOwnerAction(
    String(auth.sub),
    enabled === false ? 'admin.disable' : 'admin.role-change',
    ip,
    `${target.email} · ${target.rol}${enabled === false ? ' (deshabilitado)' : ''}`,
  )
  return c.json({
    ok: true,
    admin: {
      id: String(target._id),
      email: target.email,
      nombre: target.nombre,
      rol: target.rol,
      enabled: target.enabled,
    },
  })
})

/** Eliminar = soft-disable (preserva el audit). Mismo guard "último super". */
ownerRoutes.delete('/admins/:id', requireOwnerAuth, requireOwnerRole('super'), async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'no encontrado' }, 404)
  if (String(auth.sub) === id) return c.json({ ok: false, error: 'No podés eliminarte a vos mismo' }, 409)
  const target = await Owner.findById(id)
  if (!target) return c.json({ ok: false, error: 'no encontrado' }, 404)
  if (target.rol === 'super') {
    const supersActivos = await Owner.countDocuments({ rol: 'super', enabled: true })
    if (supersActivos <= 1) return c.json({ ok: false, error: 'No podés eliminar al último super-admin' }, 409)
  }
  target.enabled = false
  await target.save()
  await revokeAllForSubject(String(target._id)).catch(() => {})
  const ip = c.req.header('x-forwarded-for') || ''
  await logOwnerAction(String(auth.sub), 'admin.disable', ip, `${target.email} (eliminado)`)
  return c.json({ ok: true })
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
//          ESTADÍSTICAS DE NEGOCIO (en vivo, cross-tenant)
// ════════════════════════════════════════════════════════════════════

/** Stats completas del negocio. soporte lo recibe SIN el bloque MRR (no ve pagos). */
ownerRoutes.get('/stats', requireOwnerAuth, async (c) => {
  const auth = c.get('auth') as { rol?: string }
  const stats = await computeOwnerStats()
  if (auth.rol === 'soporte') {
    return c.json({ ...stats, mrr: { byCurrency: {}, byCity: [], oculto: true } })
  }
  return c.json(stats)
})

/** Tendencia de MRR a partir de los snapshots diarios (gráfico temporal). */
ownerRoutes.get(
  '/stats/mrr-trend',
  requireOwnerAuth,
  requireOwnerRole('super', 'admin', 'finanzas', 'viewer'),
  async (c) => {
    const days = Math.min(Math.max(Number(c.req.query('days')) || 90, 1), 365)
    const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const snaps = await MrrSnapshot.find(
      { date: { $gte: desde } },
      'date mrrByCurrency comerciosActivos suscripcionesActivas',
    )
      .sort({ date: 1 })
      .lean()
    return c.json({
      ok: true,
      trend: snaps.map((s) => ({
        date: s.date,
        mrrByCurrency: s.mrrByCurrency ?? {},
        comerciosActivos: s.comerciosActivos ?? 0,
        suscripcionesActivas: s.suscripcionesActivas ?? 0,
      })),
    })
  },
)

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
  // Defensa en profundidad: nombre/ciudad se inyectan en el HTML de la landing
  // (escapados, ver injectLandingMeta). Capeamos largo para evitar payloads.
  nombre: z.string().min(2).max(80),
  ciudad: z.string().min(2).max(80),
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
ownerRoutes.post('/apps', requireOwnerAuth, requireOwnerRole('super', 'admin'), async (c) => {
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
  // Validación de formato: el subdomain se interpola en hosts y URLs (appBase,
  // OG). Tras el punycode debe ser un label de host válido (a-z 0-9 y guiones).
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    return c.json({ ok: false, error: 'subdomain inválido (solo letras, números y guiones)' }, 400)
  }
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
  nombre: z.string().min(2).max(80).optional(),
  ciudad: z.string().min(2).max(80).optional(),
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
ownerRoutes.patch('/apps/:id', requireOwnerAuth, requireOwnerRole('super', 'admin'), async (c) => {
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
ownerRoutes.patch('/merchants/:id', requireOwnerAuth, requireOwnerRole('super', 'admin', 'soporte'), async (c) => {
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
ownerRoutes.get('/subscriptions', requireOwnerAuth, requireOwnerRole('super', 'admin', 'finanzas', 'viewer'), async (c) => {
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
ownerRoutes.patch('/subscriptions/:id', requireOwnerAuth, requireOwnerRole('super', 'admin', 'finanzas'), async (c) => {
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
