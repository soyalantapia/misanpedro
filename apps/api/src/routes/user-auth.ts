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
  touchRefreshTokenUsage,
} from '@/services/jwt.service'
import { requireUserAuth } from '@/middleware/auth'
import { rateLimit, tooManyForKey } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendOtpCode } from '@/services/email.service'
import { otpDisclosureAllowed } from '@/lib/envSafety'
import { consumeOtpAttempt } from '@/lib/otpGate'

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

/**
 * Genera y manda el código de 6 dígitos.
 *
 * En PRODUCCIÓN esperamos el envío (igual que ya hacen comercio y owner): si el
 * mail no sale, `sent:false` — así el caller puede devolver un 503 humano en vez
 * de dejar al vecino parado en el mostrador con un "te mandamos un código" que
 * nunca llegó y que nadie (ni él, ni el cajero) puede explicar. Antes esto era
 * fire-and-forget (`.catch` que sólo logueaba) en los TRES casos; comercio y
 * owner ya se habían arreglado, el vecino quedó afuera. [cazabug]
 *
 * Fuera de producción seguimos siendo fire-and-forget: no vale la pena frenar
 * el desarrollo por la latencia del mail (y en local ni hay transporte real).
 */
async function issueUserOtp(
  c: any,
  appId: unknown,
  email: string,
): Promise<{ code: string; sent: boolean; limited?: boolean }> {
  // Segundo candado, por CASILLA. El límite por IP protege al servidor pero no a
  // la víctima: con varias IPs se le llena el mail de códigos que nunca pidió y se
  // nos quema la reputación del remitente. El email no se puede rotar. Va acá
  // adentro para cubrir los dos caminos que mandan código (la recuperación desde
  // /claim y /request-otp) sin depender de que cada uno se acuerde. [cazabug loop2]
  if (tooManyForKey(`otp-user:${email}`, 5, 60 * 60_000)) {
    return { code: '', sent: false, limited: true }
  }
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
  const send = () =>
    sendOtpCode(email, code, tenant?.nombre ?? 'Mi Ciudad', {
      brandColor: tenant?.brand?.primaryColor,
      logoUrl: tenant?.brand?.logoUrl,
      loginUrl: tenant?.subdomain ? `https://${tenant.subdomain}.micuidad.com/#/perfil` : undefined,
    })

  if (process.env.NODE_ENV === 'production') {
    const result = await send().catch((err) => {
      console.error('[user-otp-email]', err)
      return { ok: false as const }
    })
    return { code, sent: result.ok }
  }

  send().catch((err) => console.error('[user-otp-email]', err))
  return { code, sent: true }
}

/**
 * Corre la rama "hay que mandar un código de recuperación" de /claim (email que
 * YA existe, o chocó por una alta simultánea) bajo el MISMO límite que
 * /request-otp (`otpRequestLimiter`, 5/h) en vez de `claimLimiter` (30/h).
 *
 * Por qué: `claimLimiter` es alto a propósito porque el alta nueva NO manda mail
 * y varios comercios comparten la IP del mostrador. Pero esta rama SÍ manda un
 * mail real — si corriera bajo el límite del alta, conociendo el email de una
 * víctima se le podían disparar hasta 30 mails por hora, evadiendo de paso el
 * cap de 5 pensado justo para esto. Invocamos el middleware `otpRequestLimiter`
 * a mano (en vez de montarlo en la ruta) porque sólo esta rama de /claim
 * necesita el límite bajo — la de alta nueva sigue sólo bajo `claimLimiter`.
 * [cazabug]
 */
async function issueRecoveryCode(c: any, appId: unknown, email: string): Promise<Response> {
  let branchResponse!: Response
  const limited = await otpRequestLimiter(c, async () => {
    const { code, sent, limited: porCasilla } = await issueUserOtp(c, appId, email)
    if (porCasilla) {
      branchResponse = c.json(
        { ok: false, error: 'Ya pedimos varios códigos para ese email. Esperá un rato.' },
        429,
      )
      return
    }
    branchResponse = sent
      ? c.json({
          ok: true,
          created: false,
          needsCode: true,
          ...(otpDisclosureAllowed() ? { _debugCode: code } : {}),
        })
      : c.json(
          { ok: false, error: 'No pudimos enviar el código. Probá de nuevo en unos minutos.' },
          503,
        )
  })
  return limited ?? branchResponse
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
    return issueRecoveryCode(c, appId, email)
  }

  let user
  try {
    user = await User.create({ appId, nombre, email, telefono, acceptedTcAt: new Date() })
  } catch (err) {
    // Carrera: dos altas simultáneas con el mismo email → el índice único rechaza
    // la segunda. Tratamos ese caso igual que "ya existe": mandamos código.
    if ((err as { code?: number })?.code === 11000) {
      return issueRecoveryCode(c, appId, email)
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

  const { code, sent, limited } = await issueUserOtp(c, appId, email)
  if (limited) {
    return c.json(
      { ok: false, error: 'Ya pedimos varios códigos para ese email. Esperá un rato.' },
      429,
    )
  }
  if (!sent) {
    return c.json(
      { ok: false, error: 'No pudimos enviar el código. Probá de nuevo en unos minutos.' },
      503,
    )
  }
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
  // Gate ATÓMICO contra fuerza bruta (detalle del porqué en el helper).
  const gated = await consumeOtpAttempt(otp._id, OTP_MAX_ATTEMPTS)
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

/**
 * POST /auth/refresh — renueva el access. NO rota el refresh: la sesión del
 * vecino es persistente y rotar arriesga desloguearlo si se pierde una respuesta
 * de red (mismo criterio que el comercio).
 */
userAuthRoutes.post('/refresh', async (c) => {
  const appId = getAppId(c)
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ ok: false, error: 'refresh token required' }, 400)
  }
  const consumed = await consumeRefreshToken(refreshToken)
  if (!consumed || consumed.subjectType !== 'user') {
    return c.json({ ok: false, error: 'invalid refresh token' }, 401)
  }
  const user = await User.findOne({ _id: consumed.subjectId, appId })
  if (!user) return c.json({ ok: false, error: 'user not found' }, 401)

  // Marcamos el refresh como USADO (no sólo creado): es lo que hace que
  // `/auth/sessions` muestre la fecha de uso real y no la de alta. Best-effort:
  // si esta escritura falla no tiene que tirar abajo el refresh en sí.
  await touchRefreshTokenUsage(refreshToken).catch(() => {})

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    type: 'user',
    appId: String(appId),
  })
  return c.json({ ok: true, accessToken, refreshToken })
})

/** POST /auth/logout — cierra la sesión de ESTE dispositivo. */
userAuthRoutes.post('/logout', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}))
  if (refreshToken) await revokeRefreshToken(refreshToken)
  return c.json({ ok: true })
})

/**
 * POST /auth/logout-all — cierra la sesión en TODOS los dispositivos. Es lo que
 * el vecino usa cuando pierde el celular: hasta ahora era imposible, porque el
 * token de 10 años no se podía revocar. [cazabug S1-01]
 */
userAuthRoutes.post('/logout-all', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  // El contrato pide cuántas sesiones se cerraron (el front lo muestra como
  // confirmación: "cerramos N sesiones"). `revokeAllForSubject` ya devuelve el
  // `modifiedCount` del updateMany, así que no hace falta duplicar la query acá.
  const revoked = await revokeAllForSubject('user', auth.sub)
  return c.json({ ok: true, revoked })
})

/** GET /auth/sessions — dispositivos con sesión abierta (pantalla de Perfil). */
userAuthRoutes.get('/sessions', requireUserAuth, async (c) => {
  const { RefreshToken } = await import('@/models')
  const auth = c.get('auth')
  const docs = await RefreshToken.find({
    subjectId: auth.sub,
    subjectType: 'user',
    revokedAt: { $exists: false },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean()

  return c.json({
    ok: true,
    sessions: docs.map((d: any) => ({
      id: String(d._id),
      // El user-agent crudo es ilegible para el vecino; mostramos algo humano.
      dispositivo: describirDispositivo(d.userAgent),
      // `lastUsedAt` es la fecha del último `/refresh` (uso real). Si todavía no
      // se refrescó ni una vez (sesión recién creada), caemos a `createdAt`. Antes
      // usaba `updatedAt`, que nunca cambiaba porque `consumeRefreshToken` no
      // escribe nada — la pantalla mostraba siempre la fecha de alta. [cazabug]
      ultimaVez: d.lastUsedAt ?? d.createdAt,
    })),
  })
})

/** Traduce el user-agent a algo que un vecino entienda. */
function describirDispositivo(ua?: string): string {
  if (!ua) return 'Un dispositivo'
  if (/iPhone|iPad/i.test(ua)) return 'iPhone o iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Una computadora Windows'
  if (/Mac OS/i.test(ua)) return 'Una Mac'
  return 'Un dispositivo'
}

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
  // `subjectType` explícito: hoy es inofensivo omitirlo (los ObjectId no
  // colisionan entre colecciones), pero así la intención de "sólo ESTE vecino"
  // queda escrita y no apoyada en un supuesto.
  await RefreshToken.updateMany(
    { subjectId: auth.sub, subjectType: 'user', revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  )

  await user.deleteOne()

  return c.json({ ok: true, mensaje: 'Tu cuenta y datos personales fueron eliminados.' })
})
