import type { Context, MiddlewareHandler } from 'hono'
import { verifyAccessToken, type AccessPayload } from '@/services/jwt.service'

declare module 'hono' {
  interface ContextVariableMap {
    auth: AccessPayload
  }
}

function readToken(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

export const requireMerchantAuth: MiddlewareHandler = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ ok: false, error: 'unauthorized' }, 401)
  try {
    const payload = verifyAccessToken(token)
    if (payload.type !== 'merchant_user') {
      return c.json({ ok: false, error: 'forbidden' }, 403)
    }
    c.set('auth', payload)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  await next()
}

export const requireUserAuth: MiddlewareHandler = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ ok: false, error: 'unauthorized' }, 401)
  try {
    const payload = verifyAccessToken(token)
    if (payload.type !== 'user') {
      return c.json({ ok: false, error: 'forbidden' }, 403)
    }
    c.set('auth', payload)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  await next()
}

/**
 * Auth para super-admin del SaaS. Cross-tenant (NO requiere tenantContext).
 * El token se emite cuando el owner pasa email + password + código TOTP.
 */
export const requireOwnerAuth: MiddlewareHandler = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ ok: false, error: 'unauthorized' }, 401)
  try {
    const payload = verifyAccessToken(token)
    if (payload.type !== 'owner') {
      return c.json({ ok: false, error: 'forbidden' }, 403)
    }
    c.set('auth', payload)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  await next()
}
