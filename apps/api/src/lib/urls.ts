import { env } from '@/env'

/**
 * Dominio raíz de la plataforma. Cada ciudad vive en `<subdomain>.<PLATFORM_DOMAIN>`
 * (ej. `sanpedro.micuidad.com`, `minarino.micuidad.com`). Overridable por env para
 * staging/tests; default = el dominio de producción.
 */
const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN || 'micuidad.com').toLowerCase()

type TenantUrlInput = { subdomain?: string | null; customDomain?: string | null }

/**
 * URL pública (origin, sin trailing slash) del frontend de UNA ciudad.
 *
 * Prioridad: `customDomain` → `<subdomain>.<PLATFORM_DOMAIN>`. Solo si el tenant no
 * trae ninguno (no debería pasar: `subdomain` es required en el modelo App) cae al
 * `APP_URL_FRONT` global. Úsese para construir back_urls de pago y CTAs de email
 * por-tenant, en vez de la variable global que mandaba todo a la ciudad principal.
 */
export function tenantFrontUrl(tenant: TenantUrlInput): string {
  if (tenant?.customDomain) return `https://${tenant.customDomain}`
  if (tenant?.subdomain) return `https://${String(tenant.subdomain).toLowerCase()}.${PLATFORM_DOMAIN}`
  return env.APP_URL_FRONT.replace(/\/+$/, '')
}
