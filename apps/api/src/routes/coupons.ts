import { Hono } from 'hono'
import { Types } from 'mongoose'
import { couponCreateSchema, couponUpdateSchema } from '@misanpedro/shared'
import { Coupon, Merchant } from '@/models'
import { requireMerchantAuth, requireMerchantActive } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'

export const couponsRoutes = new Hono()

couponsRoutes.use('*', tenantContext)

function serializeCoupon(c: any, merchant?: any) {
  return {
    id: c._id.toString(),
    merchantId: c.merchantId.toString(),
    titulo: c.titulo,
    descripcion: c.descripcion,
    condiciones: c.condiciones,
    porcentaje: c.porcentaje,
    vigenciaHasta: c.vigenciaHasta?.toISOString?.() ?? c.vigenciaHasta,
    diasAplica: c.diasAplica,
    estado: c.estado,
    stockMaximo: c.stockMaximo,
    stockUsado: c.stockUsado,
    imagenUrl: c.imagenUrl,
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
  return c.json({ ok: true, coupons: coupons.map((c) => serializeCoupon(c)) })
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
  return c.json({ ok: true, coupon: serializeCoupon(coupon) }, 201)
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
  if (data.vigenciaHasta !== undefined) coupon.vigenciaHasta = new Date(data.vigenciaHasta)
  if (data.diasAplica !== undefined) coupon.diasAplica = data.diasAplica
  if (data.estado !== undefined) coupon.estado = data.estado
  await coupon.save()
  return c.json({ ok: true, coupon: serializeCoupon(coupon) })
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
  await coupon.deleteOne()
  return c.json({ ok: true })
})
