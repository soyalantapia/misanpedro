import { Hono } from 'hono'
import { App } from '@/models'

export const tenantRoutes = new Hono()

/**
 * Endpoint público (sin auth) que devuelve la config de un tenant.
 * El frontend lo consume al detectar el subdomain (sanpedro.misanpedro.app)
 * para aplicar branding (logo, colores, nombre).
 *
 * NO devuelve datos sensibles. Es público porque el subdomain ya es público.
 */
tenantRoutes.get('/:slug/config', async (c) => {
  const slug = c.req.param('slug').toLowerCase()
  const app = await App.findOne({ slug }).lean()

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

  return c.json({
    ok: true,
    tenant: {
      slug: app.slug,
      nombre: app.nombre,
      ciudad: app.ciudad,
      provincia: app.provincia,
      pais: app.pais,
      subdomain: app.subdomain,
      customDomain: app.customDomain,
      brand: app.brand,
      settings: app.settings,
      status: app.status,
      geoCenter: app.geoCenter ?? { lat: -33.6797, lng: -59.6669 },
    },
  })
})

/**
 * Listado de tenants públicos (status=active) — para la pantalla
 * "elegí tu ciudad" del frontend cuando no detecta subdomain.
 */
tenantRoutes.get('/', async (c) => {
  const apps = await App.find({ status: 'active' })
    .select('slug nombre ciudad provincia subdomain customDomain brand.logoUrl brand.primaryColor')
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
      logo: a.brand?.logoUrl,
      primaryColor: a.brand?.primaryColor,
    })),
  })
})
