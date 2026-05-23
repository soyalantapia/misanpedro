import type { Context, MiddlewareHandler } from 'hono'
import { Types } from 'mongoose'
import { App, type AppDoc } from '@/models'

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
 *   2. Subdomain del Host header           (sanpedro.cuponcito.app)
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
  const slug = resolveTenantSlug(c)
  if (!slug) {
    return c.json(
      { ok: false, error: 'missing tenant', hint: 'set X-Tenant-Slug header or use subdomain' },
      400,
    )
  }

  // Primero intentamos custom domain (más específico) o slug
  const host = c.req.header('host')?.toLowerCase().split(':')[0] || ''
  let tenant: AppDoc | null = null

  if (host) {
    tenant = (await App.findOne({ customDomain: host })) as AppDoc | null
  }
  if (!tenant) {
    tenant = (await App.findOne({ slug })) as AppDoc | null
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
    const tenant = (await App.findOne({ slug })) as AppDoc | null
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
    const TENANT_HOST_SUFFIXES = ['.cuponcito.app', '.misanpedro.app']
    const isTenantDomain = TENANT_HOST_SUFFIXES.some((s) => host.endsWith(s))
    if (isTenantDomain) {
      const parts = host.split('.')
      if (parts.length >= 3) {
        const sub = parts[0]
        // Filtrar subdominios "técnicos" que NO son tenants:
        const RESERVED = new Set(['www', 'api', 'admin', 'owner', 'app', 'comercios'])
        if (!RESERVED.has(sub)) return sub
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
