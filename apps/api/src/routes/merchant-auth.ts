import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { createHash, randomInt } from 'node:crypto'
import {
  merchantSignupSchema,
  merchantOtpRequestSchema,
  merchantOtpVerifySchema,
} from '@misanpedro/shared'
import { Merchant, MerchantUser, Otp, Referral } from '@/models'
import { generateReferralCode } from '@/routes/referrals'
import {
  issueRefreshToken,
  signAccessToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import { requireMerchantAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendMerchantWelcome, sendMerchantOtpCode } from '@/services/email.service'

export const merchantAuthRoutes = new Hono()

// Todas las routes públicas requieren tenant. /me y /logout-all también
// (un comercio sólo vive dentro de un tenant).
merchantAuthRoutes.use('*', tenantContext)

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
  // Coordenadas del comercio: las marca en el mapa al registrarse (lat/lng).
  // Si no vinieron (cliente viejo o geocoding fallido), caemos al centro
  // geográfico del tenant — y a San Pedro si el tenant no tiene geoCenter.
  const tenant = c.get('tenant')
  const geoCenter = tenant?.geoCenter ?? { lat: -33.6797, lng: -59.6669 }
  const lat = comercio.lat ?? geoCenter.lat
  const lng = comercio.lng ?? geoCenter.lng
  const now = new Date()
  const arrepentimientoExpiraEn = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  // 3 meses gratis: el comercio nace `activo` (visible para vecinos al instante),
  // sin pago ni MercadoPago. freeTrialUntil es informativo (no corta nada por ahora).
  const freeTrialUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const referralCode = await generateReferralCode(appId)
  // Datos fiscales (cuit / razonSocial / condicionFiscal / direccionFiscal): NO se
  // piden en el alta (onboarding sin fricción). El modelo los tiene opcionales y
  // quedan vacíos; se completarán recién cuando se active el cobro. No los
  // esperamos ni requerimos acá.
  const merchant = await Merchant.create({
    appId,
    slug,
    referralCode,
    nombre: comercio.nombre,
    categoria: comercio.categoria,
    categoriaOtro: comercio.categoriaOtro,
    direccion: comercio.direccion,
    location: { type: 'Point', coordinates: [lng, lat] },
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
    estado: 'activo',
    freeTrialUntil,
    cuit: comercio.cuit,
    razonSocial: comercio.razonSocial,
    condicionFiscal: comercio.condicionFiscal,
    direccionFiscal: comercio.direccionFiscal,
    aceptedTcAt: now,
    arrepentimientoExpiraEn,
  })

  // OTP-only: el alta ya no exige contraseña. Si un cliente viejo todavía la
  // manda, la hasheamos; si no, el comercio queda passwordless (entra por OTP).
  const passwordHash = admin.password ? await bcrypt.hash(admin.password, 10) : undefined
  const user = await MerchantUser.create({
    appId,
    merchantId: merchant._id,
    email: admin.email,
    ...(passwordHash ? { passwordHash } : {}),
    nombre: admin.nombre,
    rol: 'admin',
    lastLoginAt: new Date(),
  })

  // ─── Referido: si vino con ?ref, resolvemos + dedupe + Referral(pending) ──
  const refCode = parsed.data.ref?.trim()
  if (refCode) {
    try {
      const referrer = await Merchant.findOne({ appId, referralCode: refCode })
      if (referrer && referrer._id.toString() !== merchant._id.toString()) {
        const referrerUser = await MerchantUser.findOne({ appId, merchantId: referrer._id })
        const sameEmail = !!referrerUser?.email && referrerUser.email === admin.email
        const sameCuit = !!referrer.cuit && !!comercio.cuit && referrer.cuit === comercio.cuit
        const samePhone = !!referrer.telefono && referrer.telefono === comercio.telefono
        const isSelf = sameEmail || sameCuit || samePhone
        merchant.referredByCode = refCode
        if (!isSelf)
          merchant.referredByMerchantId = referrer._id as typeof merchant.referredByMerchantId
        await merchant.save()
        await Referral.create({
          appId,
          referrerMerchantId: referrer._id,
          referredMerchantId: merchant._id,
          referredByCode: refCode,
          status: isSelf ? 'rejected' : 'pending',
          rejectedReason: isSelf ? 'self' : null,
        })
      }
    } catch (err) {
      console.error('[referral-signup]', err)
    }
  }

  // Email bienvenida (no bloqueante)
  const tenantNombre = tenant?.nombre ?? 'Mi Ciudad'
  sendMerchantWelcome(admin.email, admin.nombre, comercio.nombre, tenantNombre).catch((err) =>
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

// ─── Login OTP (passwordless) ─────────────────────────────────────────
// El comercio entra con un código de 6 dígitos al email, sin contraseña.
// Mismo patrón que el vecino (user-auth.ts) + checks de estado del comercio.
const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const otpRequestLimiter = rateLimit({ prefix: 'merchant-otp-request', max: 5, windowMs: 60 * 60_000 })
const otpVerifyLimiter = rateLimit({ prefix: 'merchant-otp-verify', max: 10, windowMs: 60_000 })

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}
function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString()
}

merchantAuthRoutes.post('/request-otp', otpRequestLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantOtpRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email } = parsed.data

  const user = await MerchantUser.findOne({ appId, email })
  // Anti-enumeración: respondemos OK aunque el email no exista (no filtramos
  // qué comercios están registrados).
  if (!user) return c.json({ ok: true })

  await Otp.deleteMany({ appId, email, purpose: 'merchant' })
  const code = generateOtp()
  await Otp.create({
    appId,
    email,
    purpose: 'merchant',
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })

  console.log(`[otp/merchant] ${email} (app ${appId}) → ${code}`)
  const tenantNombreOtp = c.get('tenant')?.nombre ?? 'Mi Ciudad'
  sendMerchantOtpCode(email, code, tenantNombreOtp).catch((err) => console.error('[merchant-otp-email]', err))

  const debugCode = process.env.NODE_ENV === 'development' ? { _debugCode: code } : {}
  return c.json({ ok: true, ...debugCode })
})

merchantAuthRoutes.post('/verify-otp', otpVerifyLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantOtpVerifySchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ appId, email, purpose: 'merchant' })
  if (!otp || otp.consumedAt) return c.json({ ok: false, error: 'código inválido' }, 401)
  if (otp.expiresAt.getTime() < Date.now()) return c.json({ ok: false, error: 'código expirado' }, 401)
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return c.json({ ok: false, error: 'demasiados intentos' }, 429)
  if (sha256(code) !== otp.codeHash) {
    otp.attempts += 1
    await otp.save()
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }

  // Código correcto → consumir ya (anti-replay), después validar la cuenta.
  otp.consumedAt = new Date()
  await otp.save()

  const user = await MerchantUser.findOne({ appId, email })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)
  const merchant = await Merchant.findOne({ appId, _id: user.merchantId })
  if (!merchant) return c.json({ ok: false, error: 'comercio no encontrado' }, 404)
  if (merchant.estado === 'suspendido') {
    return c.json({ ok: false, error: 'cuenta suspendida — contactá soporte', estado: 'suspendido' }, 403)
  }
  if (merchant.estado === 'cancelado') {
    return c.json({ ok: false, error: 'cuenta cancelada', estado: 'cancelado' }, 403)
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
      id: merchant._id.toString(),
      slug: merchant.slug,
      nombre: merchant.nombre,
      categoria: merchant.categoria,
      estado: merchant.estado,
    },
  })
})

merchantAuthRoutes.post('/refresh', async (c) => {
  const appId = getAppId(c)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ ok: false, error: 'refresh token required' }, 400)
  }
  // NO rotamos el refresh del comercio: la sesión es persistente y la rotación
  // crearía riesgo de logout si una respuesta se pierde por red (la detección
  // de reuso revocaría toda la familia). Validamos y devolvemos un access
  // nuevo manteniendo el MISMO refresh.
  const consumed = await consumeRefreshToken(refreshToken)
  if (!consumed || consumed.subjectType !== 'merchant_user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await MerchantUser.findOne({ _id: consumed.subjectId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'merchant_user',
    merchantId: user.merchantId.toString(),
    appId: String(appId),
  })
  return c.json({ ok: true, accessToken, refreshToken })
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
