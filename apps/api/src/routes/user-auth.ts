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

export const userAuthRoutes = new Hono()

// Rate limits para anti-abuse
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
  const body = await c.req.json().catch(() => ({}))
  const parsed = userRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const data = parsed.data

  // Validar mayoría de 16
  const dob = new Date(data.fechaNacimiento)
  const minAge = new Date()
  minAge.setFullYear(minAge.getFullYear() - 16)
  if (dob > minAge) {
    return c.json({ ok: false, error: 'tenés que ser mayor de 16' }, 400)
  }

  // Conflictos
  const conflict = await User.findOne({
    $or: [{ dni: data.dni }, { email: data.email }, { whatsapp: data.whatsapp }],
  })
  if (conflict) {
    let field: 'dni' | 'email' | 'whatsapp' = 'email'
    if (conflict.dni === data.dni) field = 'dni'
    else if (conflict.whatsapp === data.whatsapp) field = 'whatsapp'
    return c.json({ ok: false, error: `${field} ya registrado` }, 409)
  }

  const user = await User.create({
    dni: data.dni,
    nombre: data.nombre,
    email: data.email,
    whatsapp: data.whatsapp,
    fechaNacimiento: data.fechaNacimiento,
    acceptedTcAt: new Date(),
  })

  // Auto-login después del registro
  const accessToken = signAccessToken({ sub: user._id.toString(), type: 'user' })
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
  const body = await c.req.json().catch(() => ({}))
  const parsed = otpRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email } = parsed.data
  if (!email) return c.json({ ok: false, error: 'email requerido' }, 400)

  const user = await User.findOne({ email })
  if (!user) {
    // Por seguridad devolvemos OK sin revelar si existe
    return c.json({ ok: true })
  }

  // Limpiar OTPs previos del email
  await Otp.deleteMany({ email })

  const code = generateOtp()
  await Otp.create({
    email,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })

  // TODO Fase 1.5: enviar por Resend / WhatsApp.
  // Por ahora lo devolvemos en el response solo en development.
  console.log(`[otp] ${email} → ${code}`)
  const debugCode =
    process.env.NODE_ENV !== 'production' ? { _debugCode: code } : {}

  return c.json({ ok: true, ...debugCode })
})

userAuthRoutes.post('/verify-otp', otpVerifyLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = otpVerifySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ email })
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

  const user = await User.findOne({ email })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  user.lastLoginAt = new Date()
  await user.save()

  const accessToken = signAccessToken({ sub: user._id.toString(), type: 'user' })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
  })

  return c.json({ ok: true, accessToken, refreshToken, user: serializeUser(user) })
})

userAuthRoutes.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken) return c.json({ ok: false, error: 'refresh token required' }, 400)
  const rotated = await rotateRefreshToken(refreshToken, {
    userAgent: c.req.header('user-agent'),
  })
  if (!rotated || rotated.subjectType !== 'user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await User.findById(rotated.subjectId)
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)
  const accessToken = signAccessToken({ sub: user._id.toString(), type: 'user' })
  return c.json({ ok: true, accessToken, refreshToken: rotated.token })
})

userAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

userAuthRoutes.get('/me', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  const user = await User.findById(auth.sub)
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  return c.json({ ok: true, user: serializeUser(user) })
})

void bcrypt // referenciado para evitar tree-shake en build

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
