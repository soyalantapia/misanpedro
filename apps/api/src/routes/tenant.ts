import { Hono } from 'hono'
import { App, Merchant } from '@/models'
import { toAsciiLabel } from '@/middleware/tenant'

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

  // Conteo REAL de comercios adheridos (estado activo) — la landing lo usa para el
  // contador de lanzamiento ("Ya van N de 20"), que antes era una constante fija.
  const merchantsActivos = await Merchant.countDocuments({ appId: app._id, estado: 'activo' })

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
      precioMensual: app.precioMensual,
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
