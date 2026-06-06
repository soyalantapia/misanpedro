import { Hono } from 'hono'
import { Types } from 'mongoose'
import {
  redeemByCodeSchema,
  redeemByPayloadSchema,
  confirmRedemptionSchema,
} from '@misanpedro/shared'
import { Activation, Coupon, CustomerNote, Merchant, Redemption, User } from '@/models'
import { z } from 'zod'
import { requireMerchantAuth, requireMerchantActive } from '@/middleware/auth'
import { rateLimit } from '@/middleware/security'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendUserRedemption } from '@/services/email.service'
import { publish } from '@/services/notifications.service'
import { checkUsoLimite } from '@/services/usageLimit'

export const redemptionsRoutes = new Hono()

redemptionsRoutes.use('*', tenantContext)

// Anti-brute force de códigos: 60 validates por minuto por comercio
const validateLimiter = rateLimit({ prefix: 'validate', max: 60, windowMs: 60_000 })

function serializeForValidation(
  activation: any,
  coupon: any,
  user: any,
  isFirstVisit: boolean,
) {
  return {
    activationId: activation._id.toString(),
    codigoNumerico: activation.codigoNumerico,
    activatedAt: activation.activatedAt?.toISOString?.() ?? new Date().toISOString(),
    status: activation.status,
    // expiresAt queda como deprecated; los nuevos códigos no expiran por tiempo
    expiresAt: activation.expiresAt?.toISOString?.(),
    isFirstVisit,
    coupon: {
      id: coupon._id.toString(),
      titulo: coupon.titulo,
      porcentaje: coupon.porcentaje,
      condiciones: coupon.condiciones,
      merchantId: coupon.merchantId.toString(),
    },
    user: {
      id: user._id.toString(),
      nombre: user.nombre,
      dni: user.dni,
    },
  }
}

// POST /redemptions/validate — comercio valida código o payload
redemptionsRoutes.post('/validate', validateLimiter, requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))

  let activation = null
  if (typeof body.codigoNumerico === 'string') {
    const parsed = redeemByCodeSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'código inválido' }, 400)
    activation = await Activation.findOne({ appId, codigoNumerico: parsed.data.codigoNumerico })
  } else if (typeof body.qrPayload === 'string') {
    const parsed = redeemByPayloadSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'qr inválido' }, 400)
    const parts = parsed.data.qrPayload.split(':')
    if (parts.length !== 4 || parts[0] !== 'msp' || parts[1] !== 'act') {
      return c.json({ ok: false, error: 'qr inválido' }, 400)
    }
    activation = await Activation.findOne({ appId, codigoNumerico: parts[2] })
  } else {
    return c.json({ ok: false, error: 'código o qr requerido' }, 400)
  }

  if (!activation) return c.json({ ok: false, error: 'no encontrado' }, 404)

  const coupon = await Coupon.findOne({ _id: activation.couponId, appId })
  if (!coupon) return c.json({ ok: false, error: 'cupón no encontrado' }, 404)

  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'cupón de otro comercio' }, 403)
  }

  if (activation.status !== 'activo') {
    return c.json({ ok: false, error: `ya ${activation.status}`, status: activation.status }, 409)
  }

  // Chequeamos que el cupón siga vigente (sin TTL en la activación)
  if (coupon.estado !== 'activo') {
    return c.json({ ok: false, error: 'el cupón ya no está activo', status: 'inactivo' }, 409)
  }
  if (coupon.vigenciaHasta.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'el cupón está vencido', status: 'vencido' }, 409)
  }

  const user = await User.findOne({ _id: activation.userId, appId })
  if (!user) return c.json({ ok: false, error: 'usuario no encontrado' }, 404)

  // Primera visita: ningún canje previo de este usuario en este comercio
  const prevRedemptions = await Redemption.countDocuments({
    appId,
    userId: activation.userId,
    merchantId: coupon.merchantId,
  })
  const isFirstVisit = prevRedemptions === 0

  return c.json({
    ok: true,
    validation: serializeForValidation(activation, coupon, user, isFirstVisit),
  })
})

// POST /redemptions/confirm — confirmar canje
redemptionsRoutes.post('/confirm', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = confirmRedemptionSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { activationId, montoTicket } = parsed.data

  if (!Types.ObjectId.isValid(activationId)) {
    return c.json({ ok: false, error: 'no encontrado' }, 404)
  }
  const activation = await Activation.findOne({ _id: activationId, appId })
  if (!activation) return c.json({ ok: false, error: 'no encontrado' }, 404)

  if (activation.status !== 'activo') {
    return c.json({ ok: false, error: `ya ${activation.status}` }, 409)
  }

  const coupon = await Coupon.findOne({ _id: activation.couponId, appId })
  if (!coupon) return c.json({ ok: false, error: 'cupón no encontrado' }, 404)
  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'cupón de otro comercio' }, 403)
  }
  // Sin TTL en activations: chequeo sólo el cupón.
  if (coupon.estado !== 'activo') {
    return c.json({ ok: false, error: 'el cupón ya no está activo' }, 409)
  }
  if (coupon.vigenciaHasta.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'el cupón está vencido' }, 409)
  }

  // Re-chequeo del límite de uso por persona (carreras / códigos viejos):
  // el guard de activación pudo no correr (código de antes) o haber carrera.
  const limite = await checkUsoLimite(appId, coupon._id, activation.userId, coupon)
  if (limite.bloqueado) {
    return c.json(
      {
        ok: false,
        error: 'Este vecino ya usó el cupón el máximo de veces permitido.',
        motivo: 'limite_por_persona',
        nextDisponible: limite.nextDisponible,
      },
      409,
    )
  }

  const ahorroEstimado = montoTicket
    ? Math.round((montoTicket * coupon.porcentaje) / 100)
    : 0

  activation.status = 'canjeado'
  activation.redeemedAt = new Date()
  activation.montoTicket = montoTicket
  activation.ahorroEstimado = ahorroEstimado
  await activation.save()

  let redemption
  try {
    redemption = await Redemption.create({
      appId,
      activationId: activation._id,
      couponId: coupon._id,
      merchantId: coupon.merchantId,
      userId: activation.userId,
      merchantUserId: auth.sub,
      montoTicket,
      ahorroEstimado,
      redeemedAt: activation.redeemedAt,
    })
  } catch (err) {
    // Carrera / doble-tap: el índice único {activationId} garantiza UN solo
    // canje. Si otra confirmación simultánea ya lo registró, devolvemos un
    // "ya canjeado" limpio en vez de un 500 con el error crudo de Mongo.
    if ((err as { code?: number })?.code === 11000) {
      return c.json({ ok: false, error: 'ya canjeado' }, 409)
    }
    throw err
  }

  coupon.stockUsado = (coupon.stockUsado ?? 0) + 1
  await coupon.save()

  // Email + event (no bloqueante)
  void (async () => {
    try {
      const user = await User.findOne({ _id: activation.userId, appId })
      const merchant = await Merchant.findOne({ _id: coupon.merchantId, appId })
      if (user?.email && merchant) {
        await sendUserRedemption({
          to: user.email,
          nombre: user.nombre,
          comercio: merchant.nombre,
          cupon: coupon.titulo,
          porcentaje: coupon.porcentaje,
          ahorro: ahorroEstimado,
          fecha: activation.redeemedAt!.toLocaleString('es-AR'),
        })
      }
      if (user) {
        publish({
          type: 'redemption.created',
          merchantId: coupon.merchantId.toString(),
          payload: {
            redemptionId: redemption._id.toString(),
            couponTitulo: coupon.titulo,
            userNombre: user.nombre,
            ahorroEstimado,
            montoTicket,
            redeemedAt: activation.redeemedAt!.toISOString(),
          },
        })
      }
    } catch (err) {
      console.error('[redemption-email]', err)
    }
  })()

  return c.json({
    ok: true,
    redemption: {
      id: redemption._id.toString(),
      activationId: activation._id.toString(),
      couponId: coupon._id.toString(),
      montoTicket,
      ahorroEstimado,
      redeemedAt: activation.redeemedAt.toISOString(),
    },
  })
})

// GET /redemptions/recent — últimos canjes del comercio
redemptionsRoutes.get('/recent', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const limitRaw = parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50

  const redemptions = await Redemption.find({ appId, merchantId: auth.merchantId })
    .sort({ redeemedAt: -1 })
    .limit(limit)

  const couponIds = [...new Set(redemptions.map((r) => r.couponId.toString()))]
  const userIds = [...new Set(redemptions.map((r) => r.userId?.toString()).filter(Boolean))]
  const coupons = await Coupon.find({ appId, _id: { $in: couponIds } })
  const users = await User.find({ appId, _id: { $in: userIds } })
  const couponMap = new Map(coupons.map((c) => [c._id.toString(), c]))
  const userMap = new Map(users.map((u) => [u._id.toString(), u]))

  return c.json({
    ok: true,
    redemptions: redemptions.map((r) => {
      const coupon = couponMap.get(r.couponId.toString())
      const user = r.userId ? userMap.get(r.userId.toString()) : undefined
      return {
        id: r._id.toString(),
        couponId: r.couponId.toString(),
        userId: r.userId?.toString(),
        montoTicket: r.montoTicket,
        ahorroEstimado: r.ahorroEstimado,
        redeemedAt: r.redeemedAt.toISOString(),
        coupon: coupon ? { titulo: coupon.titulo, porcentaje: coupon.porcentaje } : undefined,
        user: user ? { nombre: user.nombre, dni: user.dni } : undefined,
      }
    }),
  })
})

// GET /redemptions/clientes — clientes únicos con métricas
redemptionsRoutes.get('/clientes', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)

  const redemptions = await Redemption.find({ appId, merchantId: auth.merchantId }).sort({
    redeemedAt: -1,
  })
  const userMap = new Map<string, any>()
  for (const r of redemptions) {
    if (!r.userId) continue
    const id = r.userId.toString()
    const acc = userMap.get(id) ?? {
      userId: id,
      canjes: 0,
      ahorroTotal: 0,
      ingresosTotal: 0,
      ultimoCanjeAt: r.redeemedAt,
      primerCanjeAt: r.redeemedAt,
    }
    acc.canjes += 1
    acc.ahorroTotal += r.ahorroEstimado || 0
    acc.ingresosTotal += r.montoTicket || 0
    if (r.redeemedAt > acc.ultimoCanjeAt) acc.ultimoCanjeAt = r.redeemedAt
    if (r.redeemedAt < acc.primerCanjeAt) acc.primerCanjeAt = r.redeemedAt
    userMap.set(id, acc)
  }

  const users = await User.find({ appId, _id: { $in: [...userMap.keys()] } })
  const userInfoMap = new Map(users.map((u) => [u._id.toString(), u]))

  const clientes = [...userMap.values()].map((c) => {
    const u = userInfoMap.get(c.userId)
    return {
      ...c,
      ultimoCanjeAt: c.ultimoCanjeAt.toISOString(),
      primerCanjeAt: c.primerCanjeAt.toISOString(),
      nombre: u?.nombre,
      dni: u?.dni,
      email: u?.email,
      whatsapp: u?.whatsapp,
      fechaNacimiento: u?.fechaNacimiento,
    }
  })
  clientes.sort((a, b) => b.canjes - a.canjes)

  return c.json({ ok: true, clientes })
})

// ─── Notas internas sobre clientes ─────────────────────────────────────

const noteCreateSchema = z.object({
  userId: z.string(),
  text: z.string().min(1).max(1000),
  tags: z.array(z.string().max(40)).max(10).optional(),
})

redemptionsRoutes.get('/clientes/:userId/notes', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const userId = c.req.param('userId')
  if (!Types.ObjectId.isValid(userId)) return c.json({ ok: false, error: 'invalid id' }, 400)
  const notes = await CustomerNote.find({
    appId,
    merchantId: auth.merchantId,
    userId,
  }).sort({ createdAt: -1 })
  return c.json({
    ok: true,
    notes: notes.map((n) => ({
      id: n._id.toString(),
      text: n.text,
      tags: n.tags,
      createdAt: (n as any).createdAt,
      createdBy: n.createdBy.toString(),
    })),
  })
})

redemptionsRoutes.post('/clientes/notes', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = noteCreateSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  if (!Types.ObjectId.isValid(parsed.data.userId)) {
    return c.json({ ok: false, error: 'invalid userId' }, 400)
  }
  // Validar que el user existe en este tenant. Antes el endpoint dejaba
  // crear notas apuntando a userIds inexistentes — ensucia data y permite
  // un atacante autenticado generar registros basura.
  const userExists = await User.exists({ _id: parsed.data.userId, appId })
  if (!userExists) {
    return c.json({ ok: false, error: 'cliente no encontrado' }, 404)
  }
  const note = await CustomerNote.create({
    appId,
    merchantId: auth.merchantId,
    userId: parsed.data.userId,
    createdBy: auth.sub,
    text: parsed.data.text.trim(),
    tags: parsed.data.tags ?? [],
  })
  return c.json(
    {
      ok: true,
      note: {
        id: note._id.toString(),
        text: note.text,
        tags: note.tags,
        createdAt: (note as any).createdAt,
      },
    },
    201,
  )
})

redemptionsRoutes.delete('/clientes/notes/:id', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'invalid id' }, 400)
  const note = await CustomerNote.findOne({ _id: id, appId })
  if (!note) return c.json({ ok: false, error: 'not found' }, 404)
  if (note.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  await note.deleteOne()
  return c.json({ ok: true })
})
