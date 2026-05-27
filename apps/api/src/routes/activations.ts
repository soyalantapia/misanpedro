import { Hono } from 'hono'
import { Types } from 'mongoose'
import { randomInt } from 'node:crypto'
import { activateCouponSchema } from '@misanpedro/shared'
import { Activation, Coupon, Merchant, User } from '@/models'
import { requireUserAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { publish } from '@/services/notifications.service'

export const activationsRoutes = new Hono()

activationsRoutes.use('*', tenantContext)

function generateNumeric(): string {
  return randomInt(100_000, 1_000_000).toString()
}

async function generateUniqueCode(appId: Types.ObjectId): Promise<string> {
  // El index unique es `{appId, codigoNumerico}`. Verificamos POR TENANT.
  for (let i = 0; i < 12; i++) {
    const code = generateNumeric()
    const exists = await Activation.exists({ appId, codigoNumerico: code })
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
  const appId = getAppId(c)
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

  const coupon = await Coupon.findOne({ _id: couponId, appId })
  if (!coupon || coupon.estado !== 'activo') {
    return c.json({ ok: false, error: 'cupón no disponible' }, 404)
  }
  if (coupon.vigenciaHasta.getTime() < Date.now()) {
    return c.json({ ok: false, error: 'cupón vencido' }, 400)
  }

  // Si el usuario ya tiene una activación activa para este cupón, devolverla.
  // Los códigos no expiran por tiempo: viven hasta que se canjeen o cancelen.
  const existing = await Activation.findOne({
    appId,
    couponId: coupon._id,
    userId: auth.sub,
    status: 'activo',
  })
  if (existing) {
    const merchant = await Merchant.findOne({ _id: coupon.merchantId, appId })
    return c.json({ ok: true, activation: serializeActivation(existing, coupon, merchant) })
  }

  // Retry por si hay race en codigoNumerico (index único por tenant).
  // Si el índice parcial {appId, couponId, userId, status:'activo'} lanza 11000,
  // significa que una request concurrente ya creó la activación — la devolvemos.
  let activation: any = null
  let lastErr: any = null
  for (let attempt = 0; attempt < 3 && !activation; attempt++) {
    try {
      const codigoNumerico = await generateUniqueCode(appId)
      const qrPayload = `msp:act:${codigoNumerico}:${coupon._id.toString()}`
      activation = await Activation.create({
        appId,
        couponId: coupon._id,
        userId: auth.sub,
        codigoNumerico,
        qrPayload,
        activatedAt: new Date(),
        // Sin TTL: el código vale mientras el cupón esté activo. Si el cupón
        // se pausa o vence (Coupon.estado/vigenciaHasta), la activación
        // tampoco se va a poder canjear (chequeo en redemptions/validate).
        status: 'activo',
      })
    } catch (err: any) {
      lastErr = err
      if (err?.code !== 11000) throw err
      // Determinar si el conflicto es por el índice parcial de activación única
      // (race condition de double-tap). Si es así, recuperamos la ya creada.
      const raceActivation = await Activation.findOne({
        appId, couponId: coupon._id, userId: auth.sub, status: 'activo',
      })
      if (raceActivation) {
        const merchant = await Merchant.findOne({ _id: coupon.merchantId, appId })
        return c.json({ ok: true, activation: serializeActivation(raceActivation, coupon, merchant) })
      }
      // Si no hay activación activa, el 11000 fue por codigoNumerico → reintentar
    }
  }
  if (!activation) {
    console.error('[activations] no se pudo generar código único', lastErr)
    return c.json({ ok: false, error: 'no se pudo generar código único, intentá de nuevo' }, 500)
  }

  const merchant = await Merchant.findOne({ _id: coupon.merchantId, appId })
  // Notif al cajero (no bloqueante)
  void (async () => {
    try {
      const user = await User.findOne({ _id: auth.sub, appId })
      if (user) {
        publish({
          type: 'activation.created',
          merchantId: coupon.merchantId.toString(),
          payload: {
            activationId: activation._id.toString(),
            couponTitulo: coupon.titulo,
            userNombre: user.nombre,
            codigoNumerico: activation.codigoNumerico,
          },
        })
      }
    } catch {
      /* noop */
    }
  })()
  return c.json({ ok: true, activation: serializeActivation(activation, coupon, merchant) }, 201)
})

// GET /activations/me — activaciones del usuario (con filtro por status)
activationsRoutes.get('/me', requireUserAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  const status = c.req.query('status')
  const filter: Record<string, any> = { appId, userId: auth.sub }
  if (status) filter.status = status

  const activations = await Activation.find(filter).sort({ activatedAt: -1 }).limit(100)
  const couponIds = [...new Set(activations.map((a) => a.couponId.toString()))]
  const coupons = await Coupon.find({ appId, _id: { $in: couponIds } })
  const couponMap = new Map(coupons.map((c) => [c._id.toString(), c]))
  const merchantIds = [...new Set(coupons.map((c) => c.merchantId.toString()))]
  const merchants = await Merchant.find({ appId, _id: { $in: merchantIds } })
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

// GET /activations/:id — detalle (auth user, sólo dueño dentro del tenant)
activationsRoutes.get('/:id', requireUserAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const activation = await Activation.findOne({ _id: id, appId })
  if (!activation) return c.json({ ok: false, error: 'not found' }, 404)
  if (activation.userId.toString() !== auth.sub) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  const coupon = await Coupon.findOne({ _id: activation.couponId, appId })
  const merchant = coupon ? await Merchant.findOne({ _id: coupon.merchantId, appId }) : null
  return c.json({ ok: true, activation: serializeActivation(activation, coupon, merchant) })
})

// POST /activations/:id/cancel — cancelar activación
activationsRoutes.post('/:id/cancel', requireUserAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const activation = await Activation.findOne({ _id: id, appId })
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
