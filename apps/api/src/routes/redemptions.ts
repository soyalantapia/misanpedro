import { Hono } from 'hono'
import { Types } from 'mongoose'
import {
  redeemByCodeSchema,
  redeemByPayloadSchema,
  confirmRedemptionSchema,
} from '@misanpedro/shared'
import { Activation, Coupon, Redemption, User } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'

export const redemptionsRoutes = new Hono()

function serializeForValidation(activation: any, coupon: any, user: any) {
  return {
    activationId: activation._id.toString(),
    codigoNumerico: activation.codigoNumerico,
    status: activation.status,
    expiresAt: activation.expiresAt?.toISOString?.(),
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
redemptionsRoutes.post('/validate', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))

  let activation = null
  if (typeof body.codigoNumerico === 'string') {
    const parsed = redeemByCodeSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'código inválido' }, 400)
    activation = await Activation.findOne({ codigoNumerico: parsed.data.codigoNumerico })
  } else if (typeof body.qrPayload === 'string') {
    const parsed = redeemByPayloadSchema.safeParse(body)
    if (!parsed.success) return c.json({ ok: false, error: 'qr inválido' }, 400)
    // formato: msp:act:CODIGO:COUPONID
    const parts = parsed.data.qrPayload.split(':')
    if (parts.length !== 4 || parts[0] !== 'msp' || parts[1] !== 'act') {
      return c.json({ ok: false, error: 'qr inválido' }, 400)
    }
    activation = await Activation.findOne({ codigoNumerico: parts[2] })
  } else {
    return c.json({ ok: false, error: 'código o qr requerido' }, 400)
  }

  if (!activation) return c.json({ ok: false, error: 'no encontrado' }, 404)

  const coupon = await Coupon.findById(activation.couponId)
  if (!coupon) return c.json({ ok: false, error: 'cupón no encontrado' }, 404)

  // Verificar que el cupón pertenezca a este comercio
  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'cupón de otro comercio' }, 403)
  }

  if (activation.status !== 'activo') {
    return c.json({ ok: false, error: `ya ${activation.status}`, status: activation.status }, 409)
  }
  if (activation.expiresAt.getTime() < Date.now()) {
    activation.status = 'expirado'
    await activation.save()
    return c.json({ ok: false, error: 'expirado', status: 'expirado' }, 409)
  }

  const user = await User.findById(activation.userId)
  if (!user) return c.json({ ok: false, error: 'usuario no encontrado' }, 404)

  return c.json({
    ok: true,
    validation: serializeForValidation(activation, coupon, user),
  })
})

// POST /redemptions/confirm — confirmar canje (crea Redemption y marca Activation)
redemptionsRoutes.post('/confirm', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = confirmRedemptionSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const { activationId, montoTicket } = parsed.data

  if (!Types.ObjectId.isValid(activationId)) {
    return c.json({ ok: false, error: 'no encontrado' }, 404)
  }
  const activation = await Activation.findById(activationId)
  if (!activation) return c.json({ ok: false, error: 'no encontrado' }, 404)

  if (activation.status !== 'activo') {
    return c.json({ ok: false, error: `ya ${activation.status}` }, 409)
  }
  if (activation.expiresAt.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'expirado' }, 409)
  }

  const coupon = await Coupon.findById(activation.couponId)
  if (!coupon) return c.json({ ok: false, error: 'cupón no encontrado' }, 404)
  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'cupón de otro comercio' }, 403)
  }

  const ahorroEstimado = montoTicket
    ? Math.round((montoTicket * coupon.porcentaje) / 100)
    : 0

  // Marcar activation como canjeada
  activation.status = 'canjeado'
  activation.redeemedAt = new Date()
  activation.montoTicket = montoTicket
  activation.ahorroEstimado = ahorroEstimado
  await activation.save()

  // Crear Redemption
  const redemption = await Redemption.create({
    activationId: activation._id,
    couponId: coupon._id,
    merchantId: coupon.merchantId,
    userId: activation.userId,
    merchantUserId: auth.sub,
    montoTicket,
    ahorroEstimado,
    redeemedAt: activation.redeemedAt,
  })

  // Incrementar contador del cupón
  coupon.stockUsado = (coupon.stockUsado ?? 0) + 1
  await coupon.save()

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
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const limitRaw = parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50

  const redemptions = await Redemption.find({ merchantId: auth.merchantId })
    .sort({ redeemedAt: -1 })
    .limit(limit)

  const couponIds = [...new Set(redemptions.map((r) => r.couponId.toString()))]
  const userIds = [...new Set(redemptions.map((r) => r.userId.toString()))]
  const coupons = await Coupon.find({ _id: { $in: couponIds } })
  const users = await User.find({ _id: { $in: userIds } })
  const couponMap = new Map(coupons.map((c) => [c._id.toString(), c]))
  const userMap = new Map(users.map((u) => [u._id.toString(), u]))

  return c.json({
    ok: true,
    redemptions: redemptions.map((r) => {
      const coupon = couponMap.get(r.couponId.toString())
      const user = userMap.get(r.userId.toString())
      return {
        id: r._id.toString(),
        couponId: r.couponId.toString(),
        userId: r.userId.toString(),
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
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)

  const redemptions = await Redemption.find({ merchantId: auth.merchantId }).sort({
    redeemedAt: -1,
  })
  const userMap = new Map<string, any>()
  for (const r of redemptions) {
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

  const users = await User.find({ _id: { $in: [...userMap.keys()] } })
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
    }
  })
  clientes.sort((a, b) => b.canjes - a.canjes)

  return c.json({ ok: true, clientes })
})
