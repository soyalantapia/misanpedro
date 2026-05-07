import { Hono } from 'hono'
import { Types } from 'mongoose'
import { randomInt } from 'node:crypto'
import { activateCouponSchema } from '@misanpedro/shared'
import { Activation, Coupon, Merchant } from '@/models'
import { requireUserAuth } from '@/middleware/auth'

export const activationsRoutes = new Hono()

const ACTIVATION_TTL_MS = 30 * 60 * 1000 // 30 min

function generateNumeric(): string {
  return randomInt(100_000, 1_000_000).toString()
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateNumeric()
    const exists = await Activation.exists({ codigoNumerico: code, status: 'activo' })
    if (!exists) return code
  }
  throw new Error('could not generate unique code')
}

function serializeActivation(a: any, coupon?: any, merchant?: any) {
  return {
    id: a._id.toString(),
    couponId: a.couponId.toString(),
    userId: a.userId.toString(),
    codigoNumerico: a.codigoNumerico,
    qrPayload: a.qrPayload,
    activatedAt: a.activatedAt?.toISOString?.() ?? a.activatedAt,
    expiresAt: a.expiresAt?.toISOString?.() ?? a.expiresAt,
    status: a.status,
    redeemedAt: a.redeemedAt?.toISOString?.(),
    ahorroEstimado: a.ahorroEstimado,
    montoTicket: a.montoTicket,
    coupon: coupon
      ? {
          id: coupon._id.toString(),
          titulo: coupon.titulo,
          porcentaje: coupon.porcentaje,
          merchantId: coupon.merchantId.toString(),
          imagenUrl: coupon.imagenUrl,
        }
      : undefined,
    merchant: merchant
      ? {
          id: merchant._id.toString(),
          slug: merchant.slug,
          nombre: merchant.nombre,
          categoria: merchant.categoria,
          logoSeed: merchant.logoSeed,
        }
      : undefined,
  }
}

// POST /activations — vecino activa un cupón
activationsRoutes.post('/', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  const body = await c.req.json().catch(() => ({}))
  const parsed = activateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input' }, 400)
  }
  const { couponId } = parsed.data
  if (!Types.ObjectId.isValid(couponId)) {
    return c.json({ ok: false, error: 'cupón no encontrado' }, 404)
  }

  const coupon = await Coupon.findById(couponId)
  if (!coupon || coupon.estado !== 'activo') {
    return c.json({ ok: false, error: 'cupón no disponible' }, 404)
  }
  if (coupon.vigenciaHasta.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'cupón vencido' }, 400)
  }

  // Si el usuario ya tiene una activación activa para este cupón, devolverla
  const existing = await Activation.findOne({
    couponId: coupon._id,
    userId: auth.sub,
    status: 'activo',
    expiresAt: { $gt: new Date() },
  })
  if (existing) {
    const merchant = await Merchant.findById(coupon.merchantId)
    return c.json({ ok: true, activation: serializeActivation(existing, coupon, merchant) })
  }

  const codigoNumerico = await generateUniqueCode()
  const qrPayload = `msp:act:${codigoNumerico}:${coupon._id.toString()}`
  const activation = await Activation.create({
    couponId: coupon._id,
    userId: auth.sub,
    codigoNumerico,
    qrPayload,
    activatedAt: new Date(),
    expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS),
    status: 'activo',
  })

  const merchant = await Merchant.findById(coupon.merchantId)
  return c.json({ ok: true, activation: serializeActivation(activation, coupon, merchant) }, 201)
})

// GET /activations/me — activaciones del usuario (con filtro por status)
activationsRoutes.get('/me', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  const status = c.req.query('status')
  const filter: Record<string, any> = { userId: auth.sub }
  if (status) filter.status = status

  const activations = await Activation.find(filter).sort({ activatedAt: -1 }).limit(100)
  const couponIds = [...new Set(activations.map((a) => a.couponId.toString()))]
  const coupons = await Coupon.find({ _id: { $in: couponIds } })
  const couponMap = new Map(coupons.map((c) => [c._id.toString(), c]))
  const merchantIds = [...new Set(coupons.map((c) => c.merchantId.toString()))]
  const merchants = await Merchant.find({ _id: { $in: merchantIds } })
  const merchantMap = new Map(merchants.map((m) => [m._id.toString(), m]))

  return c.json({
    ok: true,
    activations: activations.map((a) => {
      const coupon = couponMap.get(a.couponId.toString())
      const merchant = coupon ? merchantMap.get(coupon.merchantId.toString()) : undefined
      return serializeActivation(a, coupon, merchant)
    }),
  })
})

// GET /activations/:id — detalle (auth user, sólo dueño)
activationsRoutes.get('/:id', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const activation = await Activation.findById(id)
  if (!activation) return c.json({ ok: false, error: 'not found' }, 404)
  if (activation.userId.toString() !== auth.sub) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  const coupon = await Coupon.findById(activation.couponId)
  const merchant = coupon ? await Merchant.findById(coupon.merchantId) : null
  return c.json({ ok: true, activation: serializeActivation(activation, coupon, merchant) })
})

// POST /activations/:id/cancel — cancelar activación
activationsRoutes.post('/:id/cancel', requireUserAuth, async (c) => {
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const activation = await Activation.findById(id)
  if (!activation) return c.json({ ok: false, error: 'not found' }, 404)
  if (activation.userId.toString() !== auth.sub) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  if (activation.status === 'activo') {
    activation.status = 'cancelado'
    await activation.save()
  }
  return c.json({ ok: true, activation: serializeActivation(activation) })
})
