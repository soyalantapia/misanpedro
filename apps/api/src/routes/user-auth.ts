import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { createHash, randomInt } from 'node:crypto'
import {
  otpRequestSchema,
  otpVerifySchema,
  userRegisterSchema,
} from '@misanpedro/shared'
import { Otp, User } from '@/models'
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '@/services/jwt.service'
import { requireUserAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendOtpCode, sendUserWelcome } from '@/services/email.service'

export const userAuthRoutes = new Hono()

// Toda la auth del vecino requiere tenant.
userAuthRoutes.use('*', tenantContext)

const registerLimiter = rateLimit({ prefix: 'user-register', max: 5, windowMs: 60 * 60_000 })
const otpRequestLimiter = rateLimit({ prefix: 'otp-request', max: 5, windowMs: 60 * 60_000 })
const otpVerifyLimiter = rateLimit({ prefix: 'otp-verify', max: 10, windowMs: 60_000 })

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString()
}

userAuthRoutes.post('/register', registerLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = userRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const data = parsed.data

  const dob = new Date(data.fechaNacimiento)
  const minAge = new Date()
  minAge.setFullYear(minAge.getFullYear() - 16)
  if (dob > minAge) {
    return c.json({ ok: false, error: 'tenés que ser mayor de 16' }, 400)
  }

  // Conflicto SOLO dentro del tenant.
  const conflict = await User.findOne({
    appId,
    $or: [{ dni: data.dni }, { email: data.email }, { whatsapp: data.whatsapp }],
  })
  if (conflict) {
    let field: 'dni' | 'email' | 'whatsapp' = 'email'
    if (conflict.dni === data.dni) field = 'dni'
    else if (conflict.whatsapp === data.whatsapp) field = 'whatsapp'
    return c.json({ ok: false, error: `${field} ya registrado` }, 409)
  }

  const user = await User.create({
    appId,
    dni: data.dni,
    nombre: data.nombre,
    email: data.email,
    whatsapp: data.whatsapp,
    fechaNacimiento: data.fechaNacimiento,
    acceptedTcAt: new Date(),
  })

  sendUserWelcome(data.email, data.nombre).catch((err) =>
    console.error('[user-welcome-email]', err),
  )

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  return c.json({
    ok: true,
    accessToken,
    refreshToken,
    user: serializeUser(user),
  })
})

userAuthRoutes.post('/request-otp', otpRequestLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = otpRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email } = parsed.data
  if (!email) return c.json({ ok: false, error: 'email requerido' }, 400)

  const user = await User.findOne({ appId, email })
  if (!user) {
    return c.json({ ok: true })
  }

  // Limpiar OTPs previos del email POR TENANT.
  await Otp.deleteMany({ appId, email })

  const code = generateOtp()
  await Otp.create({
    appId,
    email,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })

  console.log(`[otp] ${email} (app ${appId}) → ${code}`)
  sendOtpCode(email, code).catch((err) => console.error('[otp-email]', err))

  const debugCode =
    process.env.NODE_ENV === 'development' ? { _debugCode: code } : {}

  return c.json({ ok: true, ...debugCode })
})

userAuthRoutes.post('/verify-otp', otpVerifyLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = otpVerifySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ appId, email })
  if (!otp || otp.consumedAt) {
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }
  if (otp.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'código expirado' }, 401)
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return c.json({ ok: false, error: 'demasiados intentos' }, 429)
  }
  if (sha256(code) !== otp.codeHash) {
    otp.attempts += 1
    await otp.save()
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }

  otp.consumedAt = new Date()
  await otp.save()

  const user = await User.findOne({ appId, email })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  user.lastLoginAt = new Date()
  await user.save()

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  return c.json({ ok: true, accessToken, refreshToken, user: serializeUser(user) })
})

userAuthRoutes.post('/refresh', async (c) => {
  const appId = getAppId(c)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken) return c.json({ ok: false, error: 'refresh token required' }, 400)
  const rotated = await rotateRefreshToken(refreshToken, {
    userAgent: c.req.header('user-agent'),
  })
  if (!rotated || rotated.subjectType !== 'user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await User.findOne({ _id: rotated.subjectId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  return c.json({ ok: true, accessToken, refreshToken: rotated.token })
})

userAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

userAuthRoutes.get('/me', requireUserAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  const user = await User.findOne({ _id: auth.sub, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  return c.json({ ok: true, user: serializeUser(user) })
})

// ─── Habeas Data (Ley 25.326, Argentina) ──────────────────────────────

userAuthRoutes.get('/me/data-export', requireUserAuth, async (c) => {
  const { Activation, Redemption } = await import('@/models')
  const appId = getAppId(c)
  const auth = c.get('auth')
  const user = await User.findOne({ _id: auth.sub, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  const activations = await Activation.find({ appId, userId: auth.sub })
  const redemptions = await Redemption.find({ appId, userId: auth.sub })

  return c.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    user: {
      id: user._id.toString(),
      dni: user.dni,
      nombre: user.nombre,
      email: user.email,
      whatsapp: user.whatsapp,
      fechaNacimiento: user.fechaNacimiento,
      acceptedTcAt: user.acceptedTcAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: (user as any).createdAt,
    },
    activations: activations.map((a) => ({
      id: a._id.toString(),
      couponId: a.couponId.toString(),
      codigoNumerico: a.codigoNumerico,
      activatedAt: a.activatedAt,
      expiresAt: a.expiresAt,
      status: a.status,
      redeemedAt: a.redeemedAt,
      ahorroEstimado: a.ahorroEstimado,
      montoTicket: a.montoTicket,
    })),
    redemptions: redemptions.map((r) => ({
      id: r._id.toString(),
      couponId: r.couponId.toString(),
      merchantId: r.merchantId.toString(),
      montoTicket: r.montoTicket,
      ahorroEstimado: r.ahorroEstimado,
      redeemedAt: r.redeemedAt,
    })),
  })
})

userAuthRoutes.delete('/me', requireUserAuth, async (c) => {
  const { Activation, RefreshToken, Redemption } = await import('@/models')
  const appId = getAppId(c)
  const auth = c.get('auth')
  const user = await User.findOne({ _id: auth.sub, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  // Anonimizar redemptions del MISMO tenant (otros tenants no se tocan).
  await Redemption.updateMany({ appId, userId: auth.sub }, { $unset: { userId: 1 } })
  await Activation.deleteMany({ appId, userId: auth.sub })

  await RefreshToken.updateMany(
    { subjectId: auth.sub, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  )

  await user.deleteOne()

  return c.json({ ok: true, mensaje: 'Tu cuenta y datos personales fueron eliminados.' })
})

void bcrypt // referenciado para evitar tree-shake

function serializeUser(user: any) {
  return {
    id: user._id.toString(),
    nombre: user.nombre,
    dni: user.dni,
    email: user.email,
    whatsapp: user.whatsapp,
    fechaNacimiento: user.fechaNacimiento,
  }
}
