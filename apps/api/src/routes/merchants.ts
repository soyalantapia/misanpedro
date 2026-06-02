import { Hono } from 'hono'
import { merchantUpdateSchema } from '@misanpedro/shared'
import { Coupon, Merchant, Redemption, User } from '@/models'
import { requireMerchantAuth } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { computeAsesorStats, type Periodo } from '@/services/merchantStats'

export const merchantsRoutes = new Hono()

merchantsRoutes.use('*', tenantContext)

/**
 * Serializer base — campos visibles al vecino (público).
 * Información de contacto y operación, NUNCA datos fiscales/internos.
 */
function serializeMerchantPublic(m: any) {
  if (!m) return null
  const coords = m.location?.coordinates
  return {
    id: m._id.toString(),
    slug: m.slug,
    nombre: m.nombre,
    categoria: m.categoria,
    categoriaOtro: m.categoriaOtro,
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
    // Micro-sitio (carta de presentación del comercio)
    tagline: m.tagline,
    descripcion: m.descripcion,
    servicios: Array.isArray(m.servicios) ? m.servicios : [],
    galeria: Array.isArray(m.galeria) ? m.galeria : [],
    productos: Array.isArray(m.productos)
      ? m.productos.map((p: any) => ({
          nombre: p.nombre,
          precio: p.precio,
          descripcion: p.descripcion,
        }))
      : [],
    redes: m.redes
      ? {
          instagram: m.redes.instagram,
          facebook: m.redes.facebook,
          web: m.redes.web,
          whatsapp: m.redes.whatsapp,
        }
      : undefined,
    destacado: !!m.destacado,
    foundingMember: !!m.foundingMember,
    nivel: m.nivel,
    estado: m.estado,
  }
}

/**
 * Serializer privado — incluye datos fiscales (cuit/razón social) y notas
 * internas. SOLO se debe usar en endpoints autenticados como dueño/admin
 * del propio comercio. NO devolver a vecinos.
 */
function serializeMerchantPrivate(m: any) {
  const pub = serializeMerchantPublic(m)
  if (!pub) return null
  return {
    ...pub,
    razonSocial: m.razonSocial,
    cuit: m.cuit,
    condicionFiscal: m.condicionFiscal,
    direccionFiscal: m.direccionFiscal,
    notasInternas: m.notasInternas,
    arrepentimientoExpiraEn: m.arrepentimientoExpiraEn?.toISOString?.(),
  }
}

// Alias por compatibilidad. El catálogo público SIEMPRE pasa por
// serializeMerchantPublic; el panel del comercio usa el Private.
const serializeMerchant = serializeMerchantPublic

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
  // Endpoint del comercio sobre sí mismo → incluye datos fiscales/internos.
  return c.json({ ok: true, merchant: serializeMerchantPrivate(merchant) })
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
  if (data.categoriaOtro !== undefined) merchant.categoriaOtro = data.categoriaOtro ?? undefined
  if (data.direccion !== undefined) merchant.direccion = data.direccion
  // Sólo reescribimos el punto si llegan ambas coordenadas. GeoJSON guarda
  // [lng, lat] (al revés que el form). Así el comercio corrige un pin mal
  // ubicado o el placeholder del centro sin que editar la dirección lo pise.
  if (data.lat !== undefined && data.lng !== undefined) {
    merchant.location = { type: 'Point', coordinates: [data.lng, data.lat] }
  }
  if (data.telefono !== undefined) merchant.telefono = data.telefono
  if (data.horarios !== undefined) merchant.horarios = data.horarios
  if (data.horariosDetalle !== undefined) merchant.horariosDetalle = data.horariosDetalle as any
  if (data.coverImageUrl !== undefined) merchant.coverImageUrl = data.coverImageUrl ?? undefined
  if (data.logoUrl !== undefined) merchant.logoUrl = data.logoUrl ?? undefined
  if (data.mapsUrl !== undefined) merchant.mapsUrl = data.mapsUrl ?? undefined
  if (data.tagline !== undefined) merchant.tagline = data.tagline ?? undefined
  if (data.descripcion !== undefined) merchant.descripcion = data.descripcion ?? undefined
  if (data.servicios !== undefined) merchant.servicios = data.servicios
  if (data.galeria !== undefined) merchant.galeria = data.galeria
  if (data.productos !== undefined) merchant.productos = data.productos as any
  if (data.redes !== undefined) merchant.redes = (data.redes ?? undefined) as any
  if (data.cuit !== undefined) merchant.cuit = data.cuit ?? undefined
  if (data.razonSocial !== undefined) merchant.razonSocial = data.razonSocial ?? undefined
  if (data.condicionFiscal !== undefined) merchant.condicionFiscal = data.condicionFiscal ?? undefined
  if (data.direccionFiscal !== undefined) merchant.direccionFiscal = data.direccionFiscal ?? undefined
  if (data.notasInternas !== undefined) merchant.notasInternas = data.notasInternas ?? undefined

  await merchant.save()
  // PATCH lo hace el comercio sobre sí mismo → incluye datos fiscales.
  return c.json({ ok: true, merchant: serializeMerchantPrivate(merchant) })
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

// GET /merchants/me/stats/asesor?periodo=mes|7dias|mesPasado|todo
// Stats del comercio para la página "Asesor de estadísticas". Calcula TODO de
// la tabla Redemption del comercio (scoped por appId + merchantId del token).
// Cargamos los docs y agregamos en JS — mismo patrón que /me/stats y
// /redemptions/clientes (el volumen por comercio es chico). NO toca /me/stats.
merchantsRoutes.get('/me/stats/asesor', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)

  const periodoRaw = c.req.query('periodo')
  const periodo: Periodo = (['mes', '7dias', 'mesPasado', 'todo'] as const).includes(
    periodoRaw as never,
  )
    ? (periodoRaw as Periodo)
    : 'mes'

  // Scoping estricto: SOLO canjes de este comercio en este tenant.
  const all = await Redemption.find({ appId, merchantId: auth.merchantId })
  const raw = computeAsesorStats(
    all.map((r) => ({
      userId: r.userId?.toString() ?? '',
      couponId: r.couponId.toString(),
      montoTicket: r.montoTicket,
      redeemedAt: r.redeemedAt,
    })),
    periodo,
    new Date(),
  )

  // Joins de display: título del cupón y nombre del cliente (scoped por appId).
  const couponDocs = raw.cupones.length
    ? await Coupon.find({ appId, _id: { $in: raw.cupones.map((x) => x.couponId) } })
    : []
  const couponTitulo = new Map(couponDocs.map((x) => [x._id.toString(), x.titulo]))
  const cupones = raw.cupones.map((x) => ({
    titulo: couponTitulo.get(x.couponId) ?? 'Cupón',
    canjes: x.canjes,
  }))

  const userDocs = raw.mejores.length
    ? await User.find({ appId, _id: { $in: raw.mejores.map((m) => m.userId) } })
    : []
  const userNombre = new Map(userDocs.map((u) => [u._id.toString(), u.nombre]))
  const mejoresClientes = raw.mejores.map((m) => ({
    nombre: userNombre.get(m.userId) ?? 'Cliente',
    visitas: m.visitas,
  }))

  return c.json({
    ok: true,
    stats: {
      periodo: raw.periodo,
      ventas: raw.ventas,
      clientes: raw.clientes,
      nuevos: raw.nuevos,
      crecimiento: raw.crecimiento,
      volvieron: raw.volvieron,
      unaSolaVez: raw.unaSolaVez,
      totalClientes: raw.totalClientes,
      cuandoVienen: raw.cuandoVienen,
      cupones,
      mejoresClientes,
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
