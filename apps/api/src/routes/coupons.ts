import { Hono } from 'hono'
import { Types } from 'mongoose'
import { couponCreateSchema, couponUpdateSchema } from '@misanpedro/shared'
import { Activation, Coupon, Merchant, Referral } from '@/models'
import { requireMerchantAuth, requireMerchantActive } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { sendCouponPush } from '@/services/push.service'

export const couponsRoutes = new Hono()

couponsRoutes.use('*', tenantContext)

export function serializeCoupon(c: any, merchant?: any, opts: { includePrivate?: boolean } = {}) {
  return {
    id: c._id.toString(),
    merchantId: c.merchantId.toString(),
    titulo: c.titulo,
    descripcion: c.descripcion,
    condiciones: c.condiciones,
    porcentaje: c.porcentaje,
    precioReferencia: c.precioReferencia,
    precioFijo: c.precioFijo,
    vigenciaHasta: c.vigenciaHasta?.toISOString?.() ?? c.vigenciaHasta,
    diasAplica: c.diasAplica,
    estado: c.estado,
    stockMaximo: c.stockMaximo,
    stockUsado: c.stockUsado,
    imagenUrl: c.imagenUrl,
    // ─── Asesor de cupones: campos PÚBLICOS (el vecino los puede ver) ────
    tipoOferta: c.tipoOferta,
    exclusiva: c.exclusiva,
    dias: c.dias,
    franjaDesde: c.franjaDesde,
    franjaHasta: c.franjaHasta,
    productoGancho: c.productoGancho,
    alcance: c.alcance ?? 'puntual',
    mostrarAhorroVecino: c.mostrarAhorroVecino ?? true,
    // Límite de uso por persona (público — el vecino lo usa para mostrar "usado").
    // Cupones viejos sin estos campos → defaults seguros {1, 'devida'}.
    usoMaxPorPersona: c.usoMaxPorPersona ?? 1,
    usoVentana: c.usoVentana ?? 'devida',
    // ─── PRIVADO del comercio: NUNCA al vecino. Solo en respuestas del
    //     propio comercio (mine/list, create, patch). ───────────────────
    ...(opts.includePrivate
      ? { costoReferencia: c.costoReferencia, objetivo: c.objetivo }
      : {}),
    merchant: merchant
      ? {
          id: merchant._id.toString(),
          slug: merchant.slug,
          nombre: merchant.nombre,
          categoria: merchant.categoria,
          logoSeed: merchant.logoSeed,
          cover: merchant.cover,
        }
      : undefined,
  }
}

// Listado público de cupones activos POR TENANT (con merchant embebido)
couponsRoutes.get('/', async (c) => {
  const appId = getAppId(c)
  const categoria = c.req.query('categoria')
  const merchantSlug = c.req.query('merchant')

  const merchantFilter: Record<string, any> = { appId, estado: 'activo' }
  if (categoria) merchantFilter.categoria = categoria
  if (merchantSlug) merchantFilter.slug = merchantSlug

  const merchants = await Merchant.find(merchantFilter)
  const merchantMap = new Map(merchants.map((m) => [m._id.toString(), m]))
  const merchantIds = merchants.map((m) => m._id)

  const coupons = await Coupon.find({
    appId,
    merchantId: { $in: merchantIds },
    estado: 'activo',
    vigenciaHasta: { $gte: new Date() },
  }).sort({ createdAt: -1 })

  return c.json({
    ok: true,
    coupons: coupons.map((c) => serializeCoupon(c, merchantMap.get(c.merchantId.toString()))),
  })
})

// GET /coupons/:id — detalle público
couponsRoutes.get('/:id', async (c) => {
  const appId = getAppId(c)
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const coupon = await Coupon.findOne({ _id: id, appId })
  if (!coupon) return c.json({ ok: false, error: 'not found' }, 404)
  const merchant = await Merchant.findOne({ _id: coupon.merchantId, appId })
  return c.json({ ok: true, coupon: serializeCoupon(coupon, merchant) })
})

// ─── CRUD comercio ──────────────────────────────────────────────────────

couponsRoutes.get('/mine/list', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const coupons = await Coupon.find({ appId, merchantId: auth.merchantId }).sort({
    createdAt: -1,
  })
  return c.json({
    ok: true,
    coupons: coupons.map((c) => serializeCoupon(c, undefined, { includePrivate: true })),
  })
})

couponsRoutes.post('/', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = couponCreateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const coupon = await Coupon.create({
    ...parsed.data,
    appId,
    merchantId: auth.merchantId,
    vigenciaHasta: new Date(parsed.data.vigenciaHasta),
  })
  const merchant = await Merchant.findById(auth.merchantId)
  // Web Push no bloqueante: avisamos a los vecinos suscriptos a esta categoría.
  if (merchant && coupon.estado === 'activo') {
    sendCouponPush(appId, {
      id: coupon._id.toString(),
      titulo: coupon.titulo,
      porcentaje: coupon.porcentaje,
      categoria: merchant.categoria,
      merchantNombre: merchant.nombre,
    }).catch((err) => console.error('[coupon-push]', err))
  }
  // ─── Referidos: si es el PRIMER cupón activo de este comercio, confirmamos
  //     el referido pendiente y acreditamos 1 semana gratis al referidor.
  //     Idempotente: gateado por firstCouponAt vacío + Referral 'pending'.
  if (merchant && coupon.estado === 'activo' && !merchant.firstCouponAt) {
    // Claim ATÓMICO del "primer cupón": si dos requests concurrentes crean el
    // primer cupón a la vez, solo UNO gana este findOneAndUpdate (firstCouponAt:
    // null) y procesa el referido → el referidor no se acredita dos veces. Usamos
    // el doc reclamado (`claimed`) en adelante: el `merchant` en memoria tiene
    // firstCouponAt:null y un .save() lo revertiría.
    const claimed = await Merchant.findOneAndUpdate(
      { _id: merchant._id, appId, firstCouponAt: null },
      { firstCouponAt: new Date() },
      { new: true },
    )
    if (claimed) {
      try {
        const referral = await Referral.findOne({
          appId,
          referredMerchantId: claimed._id,
          status: 'pending',
        })
        if (referral) {
          const now = new Date()
          const DAY = 24 * 60 * 60 * 1000
          // ── Lado REFERIDO: +15 días gratis a su propio trial por activarse.
          if (!claimed.referredRewardGrantedAt) {
            const baseRef =
              claimed.freeTrialUntil && claimed.freeTrialUntil > now ? claimed.freeTrialUntil : now
            claimed.freeTrialUntil = new Date(baseRef.getTime() + 15 * DAY)
            claimed.referredRewardGrantedAt = now
            await claimed.save()
            referral.referredDaysGranted = 15
          }
          // ── Lado REFERIDOR: +7 días (tope 8 semanas).
          const CAP_WEEKS = 8
          const referrer = await Merchant.findById(referral.referrerMerchantId)
          if (referrer && (referrer.referralWeeksEarned ?? 0) < CAP_WEEKS) {
            const base =
              referrer.freeTrialUntil && referrer.freeTrialUntil > now ? referrer.freeTrialUntil : now
            referrer.freeTrialUntil = new Date(base.getTime() + 7 * DAY)
            referrer.referralWeeksEarned = (referrer.referralWeeksEarned ?? 0) + 1
            await referrer.save()
            referral.status = 'confirmed'
            referral.weeksGranted = 1
            referral.confirmedAt = now
          } else {
            referral.status = 'confirmed'
            referral.weeksGranted = 0
            referral.rejectedReason = 'cap_reached'
            referral.confirmedAt = now
          }
          await referral.save()
        }
      } catch (err) {
        console.error('[referral-confirm]', err)
      }
    }
  }
  return c.json(
    { ok: true, coupon: serializeCoupon(coupon, merchant ?? undefined, { includePrivate: true }) },
    201,
  )
})

couponsRoutes.patch('/:id', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const coupon = await Coupon.findOne({ _id: id, appId })
  if (!coupon) return c.json({ ok: false, error: 'not found' }, 404)
  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  const body = await c.req.json().catch(() => ({}))
  const parsed = couponUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const data = parsed.data
  if (data.titulo !== undefined) coupon.titulo = data.titulo
  if (data.descripcion !== undefined) coupon.descripcion = data.descripcion
  if (data.condiciones !== undefined) coupon.condiciones = data.condiciones
  if (data.porcentaje !== undefined) coupon.porcentaje = data.porcentaje
  if (data.precioReferencia !== undefined) coupon.precioReferencia = data.precioReferencia
  if (data.precioFijo !== undefined) coupon.precioFijo = data.precioFijo ?? undefined
  if (data.imagenUrl !== undefined) coupon.imagenUrl = data.imagenUrl ?? undefined
  if (data.vigenciaHasta !== undefined) coupon.vigenciaHasta = new Date(data.vigenciaHasta)
  if (data.diasAplica !== undefined) coupon.diasAplica = data.diasAplica
  if (data.estado !== undefined) coupon.estado = data.estado
  // `null` = limpiar el campo (Mongoose desetea al asignar undefined en .save()).
  // `undefined`/omitido = no tocar.
  if (data.costoReferencia !== undefined) coupon.costoReferencia = data.costoReferencia ?? undefined
  if (data.objetivo !== undefined) coupon.objetivo = data.objetivo ?? undefined
  if (data.tipoOferta !== undefined) coupon.tipoOferta = data.tipoOferta
  if (data.exclusiva !== undefined) coupon.exclusiva = data.exclusiva
  if (data.dias !== undefined) coupon.dias = data.dias ?? undefined
  if (data.franjaDesde !== undefined) coupon.franjaDesde = data.franjaDesde ?? undefined
  if (data.franjaHasta !== undefined) coupon.franjaHasta = data.franjaHasta ?? undefined
  if (data.productoGancho !== undefined) coupon.productoGancho = data.productoGancho ?? undefined
  if (data.alcance !== undefined) coupon.alcance = data.alcance
  if (data.mostrarAhorroVecino !== undefined) coupon.mostrarAhorroVecino = data.mostrarAhorroVecino
  if (data.usoMaxPorPersona !== undefined) coupon.usoMaxPorPersona = data.usoMaxPorPersona
  if (data.usoVentana !== undefined) coupon.usoVentana = data.usoVentana
  // `null` = quitar el tope. Si se reactiva un tope sobre un cupón ya 'agotado'
  // por edición, el estado se re-evalúa en el próximo canje (guard atómico).
  if (data.stockMaximo !== undefined) coupon.stockMaximo = data.stockMaximo ?? undefined
  await coupon.save()
  return c.json({ ok: true, coupon: serializeCoupon(coupon, undefined, { includePrivate: true }) })
})

couponsRoutes.delete('/:id', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const id = c.req.param('id')
  if (!Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'not found' }, 404)
  const coupon = await Coupon.findOne({ _id: id, appId })
  if (!coupon) return c.json({ ok: false, error: 'not found' }, 404)
  if (coupon.merchantId.toString() !== auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  // Antes de borrar, cerrar las activaciones VIVAS de este cupón. Sin esto quedaban
  // en 'activo' apuntando a un cupón inexistente: el vecino tenía en la billetera un
  // código que ya no se podía canjear y del que no se podía deshacer (el botón de
  // cancelar está debajo del guard que lo expulsaba al inicio). Los canjes ya hechos
  // NO se tocan: son historial y tienen su propio snapshot. [cazabug loop2]
  const cerradas = await Activation.updateMany(
    { appId, couponId: coupon._id, status: 'activo' },
    { status: 'expirado' },
  )
  if (cerradas.modifiedCount > 0) {
    console.log(
      `[coupons] cupón ${coupon._id.toString()} borrado — ${cerradas.modifiedCount} activación(es) cerradas`,
    )
  }
  await coupon.deleteOne()
  return c.json({ ok: true })
})
