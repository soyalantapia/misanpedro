import { Hono } from 'hono'
import { createHash, randomInt } from 'node:crypto'
import {
  userClaimSchema,
  userOtpRequestSchema,
  userOtpVerifySchema,
  normalizeTelefono,
} from '@misanpedro/shared'
import { User, Otp } from '@/models'
import {
  signAccessToken,
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} from '@/services/jwt.service'
import { requireUserAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendOtpCode } from '@/services/email.service'
import { otpDisclosureAllowed } from '@/lib/envSafety'

export const userAuthRoutes = new Hono()

// Toda la auth del vecino requiere tenant.
userAuthRoutes.use('*', tenantContext)

// Rate-limit del alta: no manda mensajes, sólo evitamos abuso grosero.
const claimLimiter = rateLimit({ prefix: 'user-claim', max: 30, windowMs: 60 * 60_000 })
// Pedir código: 5 por hora (cada uno manda un mail).
const otpRequestLimiter = rateLimit({ prefix: 'user-otp-request', max: 5, windowMs: 60 * 60_000 })
// Canjear código: 10 por minuto (freno a la fuerza bruta sobre 6 dígitos).
const otpVerifyLimiter = rateLimit({ prefix: 'user-otp-verify', max: 10, windowMs: 60_000 })

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}
function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString()
}

function serializeUser(user: any) {
  return {
    id: user._id.toString(),
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono,
  }
}

/** Emite la sesión del vecino: access corto (se renueva solo) + refresh que no
 *  vence pero SÍ se puede revocar. Antes era un token de 10 años irrevocable:
 *  si te robaban el celular no había forma de cerrar la sesión. [cazabug S1-01] */
async function issueSession(c: any, user: any, appId: unknown) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  const { token: refreshToken } = await issueRefreshToken({
    subjectType: 'user',
    subjectId: user._id.toString(),
    userAgent: c.req.header('user-agent'),
    // La sesión del vecino no vence: no le pedimos el código nunca más en ese
    // celular. Lo que ganamos es poder revocarla.
    neverExpires: true,
  })
  return { accessToken, refreshToken }
}

/** Genera y manda el código de 6 dígitos. Devuelve el código en claro para el
 *  `_debugCode` de desarrollo. */
async function issueUserOtp(c: any, appId: unknown, email: string): Promise<string> {
  await Otp.deleteMany({ appId, email, purpose: 'user' })
  const code = generateOtp()
  await Otp.create({
    appId,
    email,
    purpose: 'user',
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  })
  // El código es bearer-equivalente (5 min): nunca en logs de prod. [cazabug S1-04]
  if (otpDisclosureAllowed()) console.log(`[otp/user] ${email} (app ${appId}) → ${code}`)

  const tenant = c.get('tenant') as
    | { nombre?: string; subdomain?: string; brand?: { primaryColor?: string; logoUrl?: string } }
    | undefined
  sendOtpCode(email, code, tenant?.nombre ?? 'Mi Ciudad', {
    brandColor: tenant?.brand?.primaryColor,
    logoUrl: tenant?.brand?.logoUrl,
    loginUrl: tenant?.subdomain ? `https://${tenant.subdomain}.micuidad.com/#/perfil` : undefined,
  }).catch((err) => console.error('[user-otp-email]', err))

  return code
}

/**
 * POST /auth/claim — alta del vecino en el mostrador.
 *
 * Email NUEVO  → crea la cuenta y entra al instante (sin código). Crear la
 *                cuenta propia no ataca a nadie: no hace falta verificar.
 * Email EXISTE → NO loguea. Manda un código al mail. Es el caso "me cambié de
 *                celular", y es donde estaba el agujero: antes alcanzaba con
 *                saber un dato público del otro para quedarse con su cuenta.
 *                [cazabug S1-01]
 */
userAuthRoutes.post('/claim', claimLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = userClaimSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { nombre, email } = parsed.data
  // Normalizamos con el país del TENANT. [cazabug S1-02]
  const tenant = c.get('tenant') as { phonePrefix?: string } | undefined
  const telefono = normalizeTelefono(parsed.data.telefono, tenant?.phonePrefix)
  if (!/^\d{8,13}$/.test(telefono)) {
    return c.json({ ok: false, error: 'Poné tu celular con código de área' }, 400)
  }

  const existing = await User.findOne({ appId, email })
  if (existing) {
    // Cuenta ajena (o propia en otro celular): hay que probar la casilla.
    const code = await issueUserOtp(c, appId, email)
    return c.json({
      ok: true,
      created: false,
      needsCode: true,
      ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
    })
  }

  let user
  try {
    user = await User.create({ appId, nombre, email, telefono, acceptedTcAt: new Date() })
  } catch (err) {
    // Carrera: dos altas simultáneas con el mismo email → el índice único rechaza
    // la segunda. Tratamos ese caso igual que "ya existe": mandamos código.
    if ((err as { code?: number })?.code === 11000) {
      const code = await issueUserOtp(c, appId, email)
      return c.json({
        ok: true,
        created: false,
        needsCode: true,
        ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
      })
    }
    throw err
  }

  const { accessToken, refreshToken } = await issueSession(c, user, appId)
  return c.json({ ok: true, created: true, accessToken, refreshToken, user: serializeUser(user) }, 201)
})

/**
 * POST /auth/request-otp — "Entrar desde mi cuenta" (Perfil). Manda el código al
 * mail del vecino que ya tiene cuenta.
 *
 * Devolvemos `registered` explícito para que el front sepa si mandarlo al alta.
 * Es el mismo trade-off de enumeración que ya acepta el login del comercio: saber
 * que un mail está registrado en la app es información de bajo valor.
 */
userAuthRoutes.post('/request-otp', otpRequestLimiter, async (c) => {
  const appId = getAppId(c)
  const parsed = userOtpRequestSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email } = parsed.data

  const user = await User.findOne({ appId, email })
  if (!user) return c.json({ ok: true, registered: false })

  const code = await issueUserOtp(c, appId, email)
  return c.json({
    ok: true,
    registered: true,
    ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
  })
})

/** POST /auth/verify-otp — canjea el código por una sesión. */
userAuthRoutes.post('/verify-otp', otpVerifyLimiter, async (c) => {
  const appId = getAppId(c)
  const parsed = userOtpVerifySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { email, code } = parsed.data

  const otp = await Otp.findOne({ appId, email, purpose: 'user' })
  if (!otp || otp.consumedAt) return c.json({ ok: false, error: 'código inválido' }, 401)
  if (otp.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'código expirado' }, 401)
  }
  // Gate ATÓMICO contra fuerza bruta: chequear `attempts` con un read y recién
  // después incrementar (incluso con $inc atómico) deja una ventana (TOCTOU) —
  // una ráfaga concurrente lee el mismo valor viejo, pasa el gate y evalúa la
  // adivinanza igual. Medido: 20 requests en paralelo daban 8-10 adivinanzas
  // reales en vez de 5, y hasta permitían loguearse con el código correcto
  // fuera de turno. Con el filtro `attempts: { $lt: MAX }` dentro del propio
  // update, Mongo serializa los findOneAndUpdate sobre el mismo documento y el
  // que llega tarde no matchea → 429 sin ventana.
  const gated = await Otp.findOneAndUpdate(
    { _id: otp._id, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  )
  if (!gated) return c.json({ ok: false, error: 'demasiados intentos' }, 429)
  if (sha256(code) !== gated.codeHash) {
    return c.json({ ok: false, error: 'código inválido' }, 401)
  }

  // Consumo ATÓMICO: si dos requests traen el mismo código a la vez, sólo una
  // gana el findOneAndUpdate sobre consumedAt:null. Anti-replay y anti-carrera.
  const consumed = await Otp.findOneAndUpdate(
    { _id: otp._id, consumedAt: null },
    { consumedAt: new Date() },
    { new: true },
  )
  if (!consumed) return c.json({ ok: false, error: 'código inválido' }, 401)

  // Buscamos al vecino DESPUÉS de validar el código, pero si no existe el código
  // ya quedó consumido — es lo correcto: un código gastado no debe poder reusarse.
  const user = await User.findOne({ appId, email })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 404)

  user.lastLoginAt = new Date()
  await user.save()

  const { accessToken, refreshToken } = await issueSession(c, user, appId)
  return c.json({ ok: true, accessToken, refreshToken, user: serializeUser(user) })
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
      nombre: user.nombre,
      telefono: user.telefono,
      // Campos legacy (pueden estar vacíos en cuentas nuevas):
      dni: user.dni,
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

  // Por si existieran refresh tokens legacy de este vecino (el claim ya no emite).
  await RefreshToken.updateMany(
    { subjectId: auth.sub, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  )

  await user.deleteOne()

  return c.json({ ok: true, mensaje: 'Tu cuenta y datos personales fueron eliminados.' })
})
