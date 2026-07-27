import { Hono } from 'hono'
import { userClaimSchema, normalizeTelefono } from '@misanpedro/shared'
import { User } from '@/models'
import { signAccessToken } from '@/services/jwt.service'
import { requireUserAuth } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'

export const userAuthRoutes = new Hono()

// Toda la auth del vecino requiere tenant.
userAuthRoutes.use('*', tenantContext)

// Rate-limit SUAVE: el claim no manda mensajes (cero costo) y la verificación la
// hace el cajero en persona. Solo evitamos abuso grosero.
const claimLimiter = rateLimit({ prefix: 'user-claim', max: 30, windowMs: 60 * 60_000 })

// Token de LARGA duración: la identidad es el teléfono y la sesión es permanente
// (no hay "Salir"). 10 años ≈ no expira. No emitimos refresh para el vecino.
const USER_TOKEN_TTL = '3650d'

function serializeUser(user: any) {
  return {
    id: user._id.toString(),
    nombre: user.nombre,
    telefono: user.telefono,
  }
}

/**
 * POST /auth/claim — captura LIVIANA al primer canje (nombre + teléfono, SIN OTP).
 * findOrCreate por (appId, telefono): si el teléfono ya existe RECUPERA la cuenta
 * (y su ahorro); si no, la crea. Devuelve un token 'user' de larga duración.
 */
userAuthRoutes.post('/claim', claimLimiter, async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = userClaimSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  // Normalizamos con el país del TENANT (el schema ya no puede: no lo conoce).
  // La identidad del vecino es (appId, telefono canónico), así que una regla de
  // otro país partiría o fusionaría cuentas. [cazabug S1-02]
  const tenant = c.get('tenant') as { phonePrefix?: string } | undefined
  const { nombre } = parsed.data
  const telefono = normalizeTelefono(parsed.data.telefono, tenant?.phonePrefix)
  if (!/^\d{8,13}$/.test(telefono)) {
    return c.json({ ok: false, error: 'Poné tu celular con código de área' }, 400)
  }

  let user = await User.findOne({ appId, telefono })
  if (!user) {
    try {
      user = await User.create({ appId, nombre, telefono, acceptedTcAt: new Date() })
    } catch (err) {
      // Carrera: dos claims simultáneos del mismo teléfono → el índice único
      // {appId, telefono} rechaza el 2º. Recuperamos el que ganó.
      if ((err as { code?: number })?.code === 11000) {
        user = await User.findOne({ appId, telefono })
      }
      if (!user) throw err
    }
  } else {
    // Recuperación en otro dispositivo: refrescamos nombre (si cambió) + login.
    if (nombre && user.nombre !== nombre) user.nombre = nombre
    user.lastLoginAt = new Date()
    await user.save()
  }

  const accessToken = signAccessToken(
    { sub: user._id.toString(), type: 'user', appId: String(appId) },
    USER_TOKEN_TTL,
  )

  return c.json({ ok: true, accessToken, user: serializeUser(user) })
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
