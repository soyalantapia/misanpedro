import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { merchantLoginSchema, merchantSignupSchema } from '@misanpedro/shared'
import { Merchant, MerchantUser, PasswordReset } from '@/models'
import { env } from '@/env'
import {
  issueRefreshToken,
  signAccessToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import { requireMerchantAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendMerchantWelcome, sendPasswordResetLink } from '@/services/email.service'

export const merchantAuthRoutes = new Hono()

// Todas las routes públicas requieren tenant. /me y /logout-all también
// (un comercio sólo vive dentro de un tenant).
merchantAuthRoutes.use('*', tenantContext)

// Login: 8 intentos por minuto por IP/UA (anti-brute force)
const loginLimiter = rateLimit({ prefix: 'merchant-login', max: 8, windowMs: 60_000 })
// Signup: 3 nuevos comercios por hora por cliente
const signupLimiter = rateLimit({ prefix: 'merchant-signup', max: 3, windowMs: 60 * 60_000 })

/** Genera un slug único POR TENANT. Si "pizza" ya existe en SP, en Ramallo no choca. */
async function generateUniqueSlug(nombre: string, appId: ReturnType<typeof getAppId>): Promise<string> {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'comercio'
  if (!(await Merchant.exists({ appId, slug: base }))) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!(await Merchant.exists({ appId, slug: candidate }))) return candidate
  }
  return `${base}-${Date.now()}`
}

merchantAuthRoutes.post('/signup', signupLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantSignupSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { comercio, admin } = parsed.data

  // Email único por tenant
  const emailTaken = await MerchantUser.exists({ appId, email: admin.email })
  if (emailTaken) {
    return c.json({ ok: false, error: 'email ya registrado' }, 409)
  }

  const slug = await generateUniqueSlug(comercio.nombre, appId)
  // Coordenadas placeholder: centro geográfico del tenant. Se actualizan
  // cuando el comerciante edita su perfil. Fallback a San Pedro si el
  // tenant no tiene geoCenter configurado (compatibilidad con registros viejos).
  const tenant = c.get('tenant')
  const geoCenter = tenant?.geoCenter ?? { lat: -33.6797, lng: -59.6669 }
  const now = new Date()
  const arrepentimientoExpiraEn = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  const merchant = await Merchant.create({
    appId,
    slug,
    nombre: comercio.nombre,
    categoria: comercio.categoria,
    categoriaOtro: comercio.categoriaOtro,
    direccion: comercio.direccion,
    location: { type: 'Point', coordinates: [geoCenter.lng, geoCenter.lat] },
    telefono: comercio.telefono,
    horarios: comercio.horarios ?? '',
    logoSeed: comercio.nombre
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 3)
      .join('')
      .toUpperCase(),
    nivel: 'standard',
    estado: 'pending_payment',
    cuit: comercio.cuit,
    razonSocial: comercio.razonSocial,
    condicionFiscal: comercio.condicionFiscal,
    direccionFiscal: comercio.direccionFiscal,
    aceptedTcAt: now,
    arrepentimientoExpiraEn,
  })

  const passwordHash = await bcrypt.hash(admin.password, 10)
  const user = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: admin.email,
    passwordHash,
    nombre: admin.nombre,
    rol: 'admin',
    lastLoginAt: new Date(),
  })

  // Email bienvenida (no bloqueante)
  sendMerchantWelcome(admin.email, admin.nombre, comercio.nombre).catch((err) =>
    console.error('[merchant-welcome-email]', err),
  )

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: merchant._id.toString(),
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'merchant_user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  return c.json(
    {
      ok: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        merchantId: merchant._id.toString(),
      },
      merchant: {
        id: merchant._id.toString(),
        slug: merchant.slug,
        nombre: merchant.nombre,
        categoria: merchant.categoria,
        estado: merchant.estado,
      },
    },
    201,
  )
})

merchantAuthRoutes.post('/login', loginLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantLoginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { email, password } = parsed.data

  const user = await MerchantUser.findOne({ appId, email })
  if (!user) return c.json({ ok: false, error: 'credenciales inválidas' }, 401)

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return c.json({ ok: false, error: 'credenciales inválidas' }, 401)

  const merchantPre = await Merchant.findOne({ appId, _id: user.merchantId })
  if (!merchantPre) return c.json({ ok: false, error: 'comercio no encontrado' }, 404)
  if (merchantPre.estado === 'suspendido') {
    return c.json({ ok: false, error: 'cuenta suspendida — contactá soporte' }, 403)
  }
  if (merchantPre.estado === 'cancelado') {
    return c.json({ ok: false, error: 'cuenta cancelada' }, 403)
  }

  user.lastLoginAt = new Date()
  await user.save()

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: user.merchantId.toString(),
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'merchant_user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  return c.json({
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      merchantId: user.merchantId.toString(),
    },
    merchant: {
      id: merchantPre._id.toString(),
      slug: merchantPre.slug,
      nombre: merchantPre.nombre,
      categoria: merchantPre.categoria,
    },
  })
})

merchantAuthRoutes.post('/refresh', async (c) => {
  const appId = getAppId(c)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ ok: false, error: 'refresh token required' }, 400)
  }
  const rotated = await rotateRefreshToken(refreshToken, {
    userAgent: c.req.header('user-agent'),
  })
  if (!rotated || rotated.subjectType !== 'merchant_user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  // Validar que el merchant_user pertenezca al tenant del request
  const user = await MerchantUser.findOne({ _id: rotated.subjectId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: user.merchantId.toString(),
    appId: String(appId),
  })
  return c.json({ ok: true, accessToken, refreshToken: rotated.token })
})

merchantAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

merchantAuthRoutes.post('/logout-all', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  await revokeAllForSubject(auth.sub)
  return c.json({ ok: true })
})

// ─── Reset de password ────────────────────────────────────────────────

const RESET_TTL_MS = 30 * 60 * 1000
const forgotPwdLimiter = rateLimit({ prefix: 'forgot-pwd', max: 5, windowMs: 60 * 60_000 })
const forgotPwdSchema = z.object({ email: z.string().email().toLowerCase() })

merchantAuthRoutes.post('/forgot-password', forgotPwdLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = forgotPwdSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const user = await MerchantUser.findOne({ appId, email: parsed.data.email })
  // Anti-enum: siempre devolvemos OK aunque el email no exista
  if (!user) return c.json({ ok: true })

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + RESET_TTL_MS)

  await PasswordReset.deleteMany({ merchantUserId: user._id })
  await PasswordReset.create({
    merchantUserId: user._id,
    tokenHash,
    expiresAt,
    requestedFromUa: c.req.header('user-agent'),
  })

  const resetLink = `${env.APP_URL_FRONT}/#/admin/reset-password?token=${token}`
  sendPasswordResetLink({ to: user.email, nombre: user.nombre, link: resetLink }).catch((err) =>
    console.error('[reset-email]', err),
  )

  return c.json({ ok: true })
})

const resetPwdSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

merchantAuthRoutes.post('/reset-password', async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = resetPwdSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const reset = await PasswordReset.findOne({ tokenHash })
  if (!reset || reset.usedAt) return c.json({ ok: false, error: 'token inválido' }, 401)
  if (reset.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'token expirado' }, 401)
  }

  // El user debe estar en el tenant que hace el reset.
  const user = await MerchantUser.findOne({ _id: reset.merchantUserId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await user.save()

  reset.usedAt = new Date()
  await reset.save()

  await revokeAllForSubject(user._id.toString())

  return c.json({ ok: true })
})

merchantAuthRoutes.get('/me', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  const user = await MerchantUser.findOne({ _id: auth.sub, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  const merchant = await Merchant.findOne({ _id: user.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)
  return c.json({
    ok: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      merchantId: user.merchantId.toString(),
    },
    merchant: {
      id: merchant._id.toString(),
      slug: merchant.slug,
      nombre: merchant.nombre,
      categoria: merchant.categoria,
      estado: merchant.estado,
    },
  })
})
