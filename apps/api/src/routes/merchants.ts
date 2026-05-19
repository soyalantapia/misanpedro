import { Hono } from 'hono'
import { merchantUpdateSchema } from '@misanpedro/shared'
import { Coupon, Merchant, Redemption } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'

export const merchantsRoutes = new Hono()

merchantsRoutes.use('*', tenantContext)

function serializeMerchant(m: any) {
  if (!m) return null
  const coords = m.location?.coordinates
  return {
    id: m._id.toString(),
    slug: m.slug,
    nombre: m.nombre,
    categoria: m.categoria,
    direccion: m.direccion,
    lat: coords?.[1],
    lng: coords?.[0],
    telefono: m.telefono,
    horarios: m.horarios,
    horariosDetalle: m.horariosDetalle,
    cover: m.cover,
    coverImageUrl: m.coverImageUrl,
    logoUrl: m.logoUrl,
    mapsUrl: m.mapsUrl,
    logoSeed: m.logoSeed,
    destacado: !!m.destacado,
    foundingMember: !!m.foundingMember,
    nivel: m.nivel,
    estado: m.estado,
    razonSocial: m.razonSocial,
    cuit: m.cuit,
    condicionFiscal: m.condicionFiscal,
    direccionFiscal: m.direccionFiscal,
    notasInternas: m.notasInternas,
    arrepentimientoExpiraEn: m.arrepentimientoExpiraEn?.toISOString?.(),
  }
}

// Listado público de comercios activos POR TENANT
merchantsRoutes.get('/', async (c) => {
  const appId = getAppId(c)
  const categoria = c.req.query('categoria')
  const q = c.req.query('q')?.toLowerCase()

  const filter: Record<string, any> = { appId, estado: 'activo' }
  if (categoria) filter.categoria = categoria

  let merchants = await Merchant.find(filter).sort({ destacado: -1, nombre: 1 })
  if (q) {
    merchants = merchants.filter((m) =>
      m.nombre.toLowerCase().includes(q) || m.direccion.toLowerCase().includes(q),
    )
  }

  return c.json({ ok: true, merchants: merchants.map(serializeMerchant) })
})

// GET /merchants/me/profile — perfil completo del comercio autenticado (cualquier estado).
merchantsRoutes.get('/me/profile', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const merchant = await Merchant.findOne({ _id: auth.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)
  return c.json({ ok: true, merchant: serializeMerchant(merchant) })
})

// PATCH /merchants/me — comercio editando su propio perfil
merchantsRoutes.patch('/me', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = merchantUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }

  const merchant = await Merchant.findOne({ _id: auth.merchantId, appId })
  if (!merchant) return c.json({ ok: false, error: 'merchant not found' }, 404)

  const data = parsed.data
  if (data.nombre !== undefined) merchant.nombre = data.nombre
  if (data.categoria !== undefined) merchant.categoria = data.categoria
  if (data.direccion !== undefined) merchant.direccion = data.direccion
  if (data.telefono !== undefined) merchant.telefono = data.telefono
  if (data.horarios !== undefined) merchant.horarios = data.horarios
  if (data.horariosDetalle !== undefined) merchant.horariosDetalle = data.horariosDetalle as any
  if (data.coverImageUrl !== undefined) merchant.coverImageUrl = data.coverImageUrl ?? undefined
  if (data.logoUrl !== undefined) merchant.logoUrl = data.logoUrl ?? undefined
  if (data.mapsUrl !== undefined) merchant.mapsUrl = data.mapsUrl ?? undefined
  if (data.cuit !== undefined) merchant.cuit = data.cuit ?? undefined
  if (data.razonSocial !== undefined) merchant.razonSocial = data.razonSocial ?? undefined
  if (data.condicionFiscal !== undefined) merchant.condicionFiscal = data.condicionFiscal ?? undefined
  if (data.direccionFiscal !== undefined) merchant.direccionFiscal = data.direccionFiscal ?? undefined
  if (data.notasInternas !== undefined) merchant.notasInternas = data.notasInternas ?? undefined

  await merchant.save()
  return c.json({ ok: true, merchant: serializeMerchant(merchant) })
})

// GET /merchants/me/stats — métricas del comercio autenticado
merchantsRoutes.get('/me/stats', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)

  const redemptions = await Redemption.find({ appId, merchantId: auth.merchantId })
  const total = redemptions.length
  const ahorroTotal = redemptions.reduce((s, r) => s + (r.ahorroEstimado || 0), 0)
  const ingresosTotal = redemptions.reduce((s, r) => s + (r.montoTicket || 0), 0)
  const clientesUnicos = new Set(redemptions.map((r) => r.userId?.toString())).size

  return c.json({
    ok: true,
    stats: {
      canjes: total,
      ahorroTotal,
      ingresosTotal,
      clientesUnicos,
    },
  })
})

// GET /merchants/:slug — detalle público
merchantsRoutes.get('/:slug', async (c) => {
  const appId = getAppId(c)
  const slug = c.req.param('slug')
  const merchant = await Merchant.findOne({ appId, slug, estado: 'activo' })
  if (!merchant) return c.json({ ok: false, error: 'not found' }, 404)

  const coupons = await Coupon.find({
    appId,
    merchantId: merchant._id,
    estado: 'activo',
    vigenciaHasta: { $gte: new Date() },
  }).sort({ createdAt: -1 })

  return c.json({
    ok: true,
    merchant: serializeMerchant(merchant),
    coupons: coupons.map(serializeCoupon),
  })
})

function serializeCoupon(c: any) {
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
  }
}
