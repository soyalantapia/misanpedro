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

/**
 * IP real del cliente a partir del X-Forwarded-For.
 *
 * 🔴 Es la ÚLTIMA entrada, no la primera. El proxy de borde (Railway) APPENDEA la
 * IP que él ve al final de lo que ya venía en el header, así que el principio de
 * la cadena es texto que manda el cliente y puede inventar. Tomando el primero,
 * un atacante rotaba `X-Forwarded-For: 1.2.3.N` y cada request caía en un bucket
 * distinto: los 13 rate-limits de la plataforma quedaban anulados de una, incluidos
 * los tres de OTP (bombardeo de códigos a la casilla de cualquier vecino, comercio
 * u owner, y quema de la reputación del remitente SMTP). [cazabug loop2]
 *
 * Confiamos en UN proxy, así que la última entrada es la única no falsificable.
 * Se lee de process.env para poder testearlo sin reimportar el módulo de env.
 */
export function realClientIp(xff: string | undefined): string {
  const partes = (xff ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return partes.length > 0 ? partes[partes.length - 1] : 'unknown'
}

function clientKey(c: Context, prefix: string): string {
  const trustProxy = process.env.TRUST_PROXY === 'true' || env.TRUST_PROXY
  if (trustProxy) {
    return `${prefix}:${realClientIp(c.req.header('x-forwarded-for'))}`
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

/**
 * Freno por RECURSO en vez de por origen. Devuelve `true` si hay que cortar.
 *
 * El límite por IP protege al servidor, pero no a la víctima: quien tenga varias
 * IPs (un botnet, o simplemente una red móvil) igual le llena la casilla de códigos
 * a un vecino y nos quema la reputación del remitente SMTP. Este segundo candado
 * se cierra sobre el email destino, que es el recurso que queremos proteger y que
 * el atacante no puede rotar. [cazabug loop2]
 *
 * No es un middleware porque la clave (el email) recién se conoce después de
 * parsear el body.
 */
export function tooManyForKey(key: string, max: number, windowMs: number): boolean {
  const refillPerMs = max / windowMs
  const bucketKey = `bykey:${key}`
  const now = Date.now()
  const existing = buckets.get(bucketKey)
  let tokens = max
  if (existing) {
    const elapsed = now - existing.updatedAt
    tokens = Math.min(max, existing.tokens + elapsed * refillPerMs)
  }
  if (tokens < 1) return true
  buckets.set(bucketKey, { tokens: tokens - 1, updatedAt: now })
  return false
}

/** Limpia los buckets — usado en tests o reset manual. */
export function _resetRateLimits() {
  buckets.clear()
}
