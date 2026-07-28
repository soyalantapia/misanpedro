import { domainToASCII } from 'node:url'
import type { Context, MiddlewareHandler } from 'hono'
import { Types } from 'mongoose'
import { App, type AppDoc } from '@/models'

/**
 * Normaliza un label de subdomain a ASCII (punycode). Ej: 'minariño' →
 * 'xn--minario-9za'. Los hosts IDN llegan ya en punycode en el header Host, así
 * que guardamos/matcheamos siempre en esta forma. ASCII queda igual (no-op).
 */
export function toAsciiLabel(label: string): string {
  const clean = label.trim().toLowerCase()
  return domainToASCII(clean) || clean
}

/**
 * Resuelve el tenant por una "key" que puede ser el slug O el subdomain (el
 * primer label del host, ya en ASCII/punycode). Unifica la resolución para
 * servir cada ciudad en <slug>.micuidad.com vía comodín DNS (sin DNS por ciudad).
 */
export async function findTenantByKey(key: string): Promise<AppDoc | null> {
  const k = key.trim().toLowerCase()
  return (await App.findOne({ $or: [{ slug: k }, { subdomain: k }] })) as AppDoc | null
}

/**
 * Resuelve el tenant por su DOMINIO PROPIO (`customDomain`), ej. misanpedro.com.
 * Es el único camino cuando el host no tiene subdominio que mirar, así que lo
 * usan tanto `tenantContext` como la inyección de metas del landing.
 */
export async function findTenantByCustomDomain(host: string): Promise<AppDoc | null> {
  const h = host.trim().toLowerCase().split(':')[0]
  if (!h) return null
  return (await App.findOne({ customDomain: h })) as AppDoc | null
}

declare module 'hono' {
  interface ContextVariableMap {
    tenant: AppDoc
    /** Conveniencia: appId stringified para queries Mongoose. */
    appId: string
  }
}

/**
 * Resuelve el tenant del request en este orden:
 *   1. Header `X-Tenant-Slug: sanpedro`    (cliente explícito)
 *   2. Subdomain del Host header           (sanpedro.misanpedro.app)
 *   3. Custom domain en `customDomain`      (misanpedro.app)
 *   4. Query string `?tenant=sanpedro`     (debug/preview)
 *   5. Si nada: en development → fallback a primer App active.
 *      En producción → 400 (sin tenant no se puede operar).
 *
 * Pone en el contexto:
 *   c.get('tenant')  → AppDoc completo
 *   c.get('appId')   → ObjectId stringified
 *
 * Endpoints que NO necesitan tenant (ej /api/v1/health, /api/v1/owner/*)
 * NO usan este middleware.
 */
export const tenantContext: MiddlewareHandler = async (c, next) => {
  const host = c.req.header('host')?.toLowerCase().split(':')[0] || ''
  let tenant: AppDoc | null = null

  // 1) Header explícito: sigue teniendo la máxima prioridad (contrato del cliente).
  const hdr = (c.req.header('X-Tenant-Slug') || c.req.header('x-tenant-slug'))?.toLowerCase()
  if (hdr) tenant = await findTenantByKey(hdr)

  // 2) Dominio propio del tenant (misanpedro.com).
  //    🔴 ESTO ANTES ERA CÓDIGO MUERTO. El lookup vivía DESPUÉS del guard de
  //    `slug`, y resolveTenantSlug devuelve null para un dominio sin subdominio
  //    (misanpedro.com tiene 2 labels y no termina en .micuidad.com), así que el
  //    request moría con 400 antes de llegar hasta acá. El customDomain estaba
  //    documentado arriba y no funcionaba en ningún caso.
  if (!tenant && host) {
    tenant = await findTenantByCustomDomain(host)
  }

  // 3) Subdominio de un dominio de la plataforma, o ?tenant= para debug.
  if (!tenant) {
    const slug = resolveTenantSlug(c)
    if (!slug) {
      return c.json(
        { ok: false, error: 'missing tenant', hint: 'set X-Tenant-Slug header or use subdomain' },
        400,
      )
    }
    tenant = await findTenantByKey(slug)
  }

  if (!tenant) {
    // NO incluimos el slug fallido en la respuesta para evitar info-leak
    // (ej. exponer el subdomain interno de Railway/Render o ayudar a un
    // atacante a enumerar tenants posibles).
    return c.json({ ok: false, error: 'tenant not found' }, 404)
  }

  if (tenant.status === 'archived') {
    return c.json({ ok: false, error: 'tenant archived' }, 410)
  }

  if (tenant.status === 'suspended') {
    return c.json({ ok: false, error: 'tenant suspended' }, 403)
  }

  c.set('tenant', tenant)
  c.set('appId', String(tenant._id))
  await next()
}

/**
 * Versión "soft" que NO bloquea si no hay tenant — solo lo setea si existe.
 * Útil en endpoints que pueden funcionar con o sin tenant (raro, mayormente
 * para health/diagnostics).
 */
export const optionalTenantContext: MiddlewareHandler = async (c, next) => {
  const slug = resolveTenantSlug(c)
  if (slug) {
    const tenant = await findTenantByKey(slug)
    if (tenant) {
      c.set('tenant', tenant)
      c.set('appId', String(tenant._id))
    }
  }
  await next()
}

function resolveTenantSlug(c: Context): string | null {
  // 1) Header explícito
  const hdr = c.req.header('X-Tenant-Slug') || c.req.header('x-tenant-slug')
  if (hdr) return hdr.toLowerCase()

  // 2) Subdomain (solo en dominios "tenant-friendly" — no en infra PaaS)
  const host = c.req.header('host')?.toLowerCase().split(':')[0]
  if (host) {
    // Whitelist de dominios donde el subdomain SÍ identifica al tenant.
    // Si el host es un dominio de PaaS (Railway, Render, Fly, etc.) o
    // localhost, NO interpretamos el primer label como slug — porque
    // `api-production-43c52.up.railway.app` no es un tenant válido.
    const TENANT_HOST_SUFFIXES = ['.misanpedro.app', '.micuidad.com']
    const isTenantDomain = TENANT_HOST_SUFFIXES.some((s) => host.endsWith(s))
    if (isTenantDomain) {
      const parts = host.split('.')
      if (parts.length >= 3) {
        const sub = parts[0]
        // Filtrar subdominios "técnicos" que NO son tenants:
        const RESERVED = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios', 'administracion', 'ciudades'])
        if (!RESERVED.has(sub)) return toAsciiLabel(sub)
      }
    }
  }

  // 3) Custom domain matching se hace en el middleware (no acá),
  //    porque requiere DB lookup. Sigue con query string fallback.

  // 4) Query string (útil para testing manual)
  const url = new URL(c.req.url)
  const q = url.searchParams.get('tenant')
  if (q) return q.toLowerCase()

  return null
}

/**
 * Helper para usar en handlers: garantiza appId disponible.
 * Si llegaste a usar este helper, ya pasaste por `tenantContext`.
 */
export function getAppId(c: Context): Types.ObjectId {
  const s = c.get('appId')
  if (!s) throw new Error('tenantContext middleware required before getAppId()')
  return new Types.ObjectId(s)
}

/**
 * Helper: parche al filtro para inyectar appId automáticamente.
 * Ej:    User.find(withTenant(c, { email }))
 *  →     User.find({ appId: <objectid>, email })
 */
export function withTenant<T extends Record<string, unknown>>(
  c: Context,
  filter: T = {} as T,
): T & { appId: Types.ObjectId } {
  return { appId: getAppId(c), ...filter }
}
