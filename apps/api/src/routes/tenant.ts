import { Hono } from 'hono'
import type { Types } from 'mongoose'
import { App, Coupon, Merchant } from '@/models'
import { toAsciiLabel } from '@/middleware/tenant'
import { precioPlanEfectivo } from '@/lib/precioPlan'

/**
 * Comercios que cuentan para el contador de lanzamiento de la landing.
 *
 * La vara NO es "se dio de alta": es **más de un cupón cargado**. Un comercio que
 * se registró y nunca publicó nada no es un comercio adherido para el vecino —
 * abre la app y no tiene qué canjear. Contarlo infla el número, que es justo lo
 * que la landing promete no hacer.
 *
 * Se cuentan los cupones sin mirar `estado`: que uno haya vencido no borra que el
 * comercio se puso en marcha, y así el contador nunca retrocede (un contador de
 * lanzamiento que baja solo confunde).
 *
 * Ambas queries van scopeadas por `appId`: el conteo de una ciudad nunca puede
 * incluir comercios de otra.
 */
export async function contarComerciosAdheridos(appId: Types.ObjectId): Promise<number> {
  const conVariosCupones = await Coupon.aggregate<{ _id: Types.ObjectId }>([
    { $match: { appId } },
    { $group: { _id: '$merchantId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $project: { _id: 1 } },
  ])
  if (conVariosCupones.length === 0) return 0
  return Merchant.countDocuments({
    _id: { $in: conVariosCupones.map((r) => r._id) },
    appId,
    estado: 'activo',
  })
}

export const tenantRoutes = new Hono()

/**
 * Endpoint público (sin auth) que devuelve la config de un tenant.
 * El frontend lo consume al detectar el subdomain (sanpedro.misanpedro.app)
 * para aplicar branding (logo, colores, nombre).
 *
 * NO devuelve datos sensibles. Es público porque el subdomain ya es público.
 */
tenantRoutes.get('/:slug/config', async (c) => {
  const slug = toAsciiLabel(c.req.param('slug').toLowerCase())
  // La "key" puede ser el slug O el subdomain (label del host en .micuidad.com,
  // ej. 'minarino'/'xn--minario-9za'), así el comodín *.micuidad.com resuelve solo.
  const app = await App.findOne({ $or: [{ slug }, { subdomain: slug }] }).lean()

  if (!app) {
    // No reflejamos el slug en la respuesta JSON aunque el atacante ya lo
    // controla (vino en el path). Es defensa en profundidad: evita XSS
    // reflected si algún cliente toma la respuesta y la rendea sin escape.
    return c.json({ ok: false, error: 'tenant not found' }, 404)
  }
  if (app.status === 'archived') {
    return c.json({ ok: false, error: 'tenant archived' }, 410)
  }
  if (app.status === 'suspended') {
    return c.json({ ok: false, error: 'tenant suspended' }, 403)
  }

  // Conteo REAL para el contador de lanzamiento de la landing ("Ya van N de 50").
  // Antes contaba toda alta con estado activo, incluidas las que nunca publicaron
  // un cupón; ahora exige más de un cupón cargado (ver contarComerciosAdheridos).
  const merchantsActivos = await contarComerciosAdheridos(app._id)

  return c.json({
    ok: true,
    tenant: {
      slug: app.slug,
      nombre: app.nombre,
      ciudad: app.ciudad,
      // Conteo real de comercios adheridos (para el contador de escasez de la landing).
      merchantsActivos,
      provincia: app.provincia,
      pais: app.pais,
      // Fallback ARS/es-AR: los docs sembrados antes de agregar estos campos no
      // los tienen y lean() no aplica los defaults del schema → undefined. Igual
      // que en la lista pública, garantizamos que siempre viajen.
      moneda: app.moneda ?? 'ARS',
      locale: app.locale ?? 'es-AR',
      phonePrefix: app.phonePrefix,
      // Precio EFECTIVO, resuelto con la misma función que usa el cobro. Antes
      // viajaba crudo (undefined si la ciudad no lo tenía cargado) y cada
      // consumidor se inventaba su propio fallback: la landing prometía 30.000
      // mientras el débito salía 50.000. Ver lib/precioPlan.ts.
      precioMensual: precioPlanEfectivo(app),
      subdomain: app.subdomain,
      customDomain: app.customDomain,
      brand: app.brand,
      settings: app.settings,
      status: app.status,
      geoCenter: app.geoCenter ?? { lat: -33.6797, lng: -59.6669 },
      // Datos legales/fiscales del responsable de esta ciudad (para Términos y
      // Privacidad tenant-aware). Público: ya figuran en las páginas legales.
      legal: app.legal,
    },
  })
})

/**
 * Listado de tenants públicos (status=active) — para la pantalla
 * "elegí tu ciudad" del frontend cuando no detecta subdomain.
 */
tenantRoutes.get('/', async (c) => {
  const apps = await App.find({ status: 'active' })
    .select(
      'slug nombre ciudad provincia subdomain customDomain moneda locale brand.logoUrl brand.primaryColor',
    )
    .sort({ ciudad: 1 })
    .lean()

  return c.json({
    ok: true,
    tenants: apps.map((a) => ({
      slug: a.slug,
      nombre: a.nombre,
      ciudad: a.ciudad,
      provincia: a.provincia,
      subdomain: a.subdomain,
      customDomain: a.customDomain,
      moneda: a.moneda ?? 'ARS',
      locale: a.locale ?? 'es-AR',
      logo: a.brand?.logoUrl,
      primaryColor: a.brand?.primaryColor,
    })),
  })
})
