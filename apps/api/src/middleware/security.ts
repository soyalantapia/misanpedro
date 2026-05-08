import { randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { env, isProd } from '@/env'

/**
 * Inyecta security headers básicos (equivalente a helmet con defaults).
 * Notas:
 *   - HSTS sólo en prod
 *   - CSP simple para una API JSON; no aplica a static assets
 *   - X-Frame-Options DENY para evitar clickjacking
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-DNS-Prefetch-Control', 'off')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProd) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

/**
 * Asocia un id único a cada request para correlación de logs.
 * Respeta `x-request-id` upstream (proxies) si ya viene seteado.
 */
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}

export const requestId: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header('x-request-id')
  const id = incoming && incoming.length > 0 && incoming.length <= 200 ? incoming : randomUUID()
  c.set('requestId', id)
  c.header('X-Request-Id', id)
  await next()
}

/**
 * Redirección HTTPS en producción. Si llegan HTTP detrás de un proxy que
 * setea X-Forwarded-Proto, redirige a HTTPS con 301.
 * Sólo se activa con isProd && TRUST_PROXY=true.
 */
export const httpsRedirect: MiddlewareHandler = async (c, next) => {
  if (isProd && env.TRUST_PROXY) {
    const proto = c.req.header('x-forwarded-proto')
    if (proto && proto !== 'https') {
      const host = c.req.header('host') ?? ''
      const url = c.req.url
      const path = url.replace(/^https?:\/\/[^/]+/, '')
      return c.redirect(`https://${host}${path}`, 301)
    }
  }
  await next()
}

// ─── Rate limiter in-memory (token bucket simplificado) ────────────────

type Bucket = { tokens: number; updatedAt: number }
const buckets = new Map<string, Bucket>()

// Limpia buckets viejos cada 5 min
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [key, b] of buckets) {
    if (b.updatedAt < cutoff) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref?.()

function clientKey(c: Context, prefix: string): string {
  if (env.TRUST_PROXY) {
    const xff = c.req.header('x-forwarded-for')
    const ip = xff?.split(',')[0]?.trim() ?? 'unknown'
    return `${prefix}:${ip}`
  }
  // En dev sin proxy, usar User-Agent (mejor que nada)
  const ua = c.req.header('user-agent') ?? 'noua'
  return `${prefix}:${ua.slice(0, 80)}`
}

export type RateLimitOptions = {
  /** Identificador del bucket (ej: 'login', 'register'). */
  prefix: string
  /** Máximo de requests permitidos por ventana. */
  max: number
  /** Ventana en ms. */
  windowMs: number
}

/**
 * Token bucket simple. Cada request consume 1 token; los tokens se reponen
 * a razón de `max / windowMs` por ms. Si se queda en 0, devuelve 429.
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const refillPerMs = opts.max / opts.windowMs
  return async (c, next) => {
    const key = clientKey(c, opts.prefix)
    const now = Date.now()
    const existing = buckets.get(key)
    let tokens = opts.max
    if (existing) {
      const elapsed = now - existing.updatedAt
      tokens = Math.min(opts.max, existing.tokens + elapsed * refillPerMs)
    }
    if (tokens < 1) {
      const retryAfter = Math.ceil((1 - tokens) / refillPerMs / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        { ok: false, error: 'demasiados intentos, esperá un momento' },
        429,
      )
    }
    buckets.set(key, { tokens: tokens - 1, updatedAt: now })
    await next()
  }
}

/** Limpia los buckets — usado en tests o reset manual. */
export function _resetRateLimits() {
  buckets.clear()
}
