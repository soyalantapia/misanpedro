import type { Context, MiddlewareHandler } from 'hono'
import { verifyAccessToken, type AccessPayload } from '@/services/jwt.service'
import { Merchant, Owner } from '@/models'

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
    if (!sameTenant(c, payload)) {
      return c.json({ ok: false, error: 'tenant mismatch' }, 403)
    }
    c.set('auth', payload)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  await next()
}

/**
 * Tenant binding: si la ruta resolvió un tenant (appId) y el token trae su
 * propio appId, deben coincidir. Evita que un sujeto del tenant A opere sobre
 * el tenant B spoofeando `X-Tenant-Slug`. Guardado: si la ruta no usa
 * tenantContext (reqAppId vacío) o el token no tiene appId, no bloquea.
 */
function sameTenant(c: Context, payload: AccessPayload): boolean {
  const reqAppId = c.get('appId')
  if (!reqAppId || !payload.appId) return true
  return payload.appId === reqAppId
}

export const requireUserAuth: MiddlewareHandler = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ ok: false, error: 'unauthorized' }, 401)
  try {
    const payload = verifyAccessToken(token)
    if (payload.type !== 'user') {
      return c.json({ ok: false, error: 'forbidden' }, 403)
    }
    if (!sameTenant(c, payload)) {
      return c.json({ ok: false, error: 'tenant mismatch' }, 403)
    }
    c.set('auth', payload)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  await next()
}

/**
 * Auth para super-admin del SaaS. Cross-tenant (NO requiere tenantContext).
 *
 * Revalida contra la BASE en cada request: que siga habilitado, y con qué rol.
 * No alcanza con los claims del token. [cazabug loop2 · P0]
 *
 * Antes la autorización se resolvía 100% con el JWT y el access vive 1h, así que
 * echar a alguien del equipo NO le cortaba el acceso: durante esa hora seguía
 * creando ciudades, suspendiendo comercios y —lo grave— invitándose a sí mismo
 * con otro email y rol super, quedándose con una cuenta nueva y limpia. Revocar
 * el refresh no ayuda: no invalida un access ya emitido.
 *
 * En el barrido anterior esto se parchó SÓLO en support-session, por considerarlo
 * "el de alto poder". Crear un super es estrictamente más peligroso que impersonar
 * un comercio: el criterio no podía aplicarse endpoint por endpoint. Va acá, en la
 * superficie entera.
 *
 * Costo: una query indexada por request en un panel de baja concurrencia.
 */
export const requireOwnerAuth: MiddlewareHandler = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ ok: false, error: 'unauthorized' }, 401)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  if (payload.type !== 'owner') {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }

  const owner = await Owner.findById(payload.sub).select('enabled rol').lean()
  if (!owner || !owner.enabled) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }

  // El rol lo manda la BASE, no el token: si lo degradaron hace un minuto, el
  // token todavía dice el rol viejo y no queremos creerle.
  c.set('auth', { ...payload, rol: owner.rol })
  await next()
}

/**
 * RBAC del owner: exige que el rol esté en `roles`. Asume que `requireOwnerAuth`
 * corrió antes, que es quien deja en `c.get('auth').rol` el rol LEÍDO DE LA BASE
 * (no el del token). El BACK es la fuente de verdad de los permisos — el front
 * sólo oculta lo que no se puede.
 * Roles: super | admin | finanzas | soporte | viewer (ver la matriz en
 * routes/owner.ts). Un cambio de rol o una baja del equipo cortan en el acto.
 */
export const requireOwnerRole =
  (...roles: string[]): MiddlewareHandler =>
  async (c, next) => {
    const auth = c.get('auth') as { type?: string; rol?: string } | undefined
    if (!auth || auth.type !== 'owner') return c.json({ ok: false, error: 'forbidden' }, 403)
    if (!roles.includes(auth.rol ?? '')) {
      return c.json({ ok: false, error: 'forbidden', rolRequerido: roles }, 403)
    }
    await next()
  }

/**
 * Verifica que el merchant del JWT esté en estado OPERATIVO (activo o
 * pending_payment). Bloquea endpoints "productivos" cuando el comercio:
 *   - canceló su suscripción         (estado='cancelado')
 *   - fue suspendido por backoffice  (estado='suspendido')
 *
 * Endpoints donde NO usar este middleware (deben seguir funcionando):
 *   - /merchant/auth/*       → login, logout, refresh, forgot/reset password
 *   - /merchants/me/profile  → ver datos propios para reactivar
 *   - PATCH /merchants/me    → editar perfil
 *   - /billing/*             → cobro / reactivación de suscripción
 *
 * Endpoints donde SÍ usar (uso operativo del producto):
 *   - /coupons crear/editar/borrar
 *   - /redemptions/validate y /confirm
 *   - /wa/*  (WhatsApp campaigns)
 *   - /redemptions/clientes/* (notas a clientes)
 *
 * Asume que `requireMerchantAuth` corrió antes.
 */
export const requireMerchantActive: MiddlewareHandler = async (c, next) => {
  const auth = c.get('auth')
  if (!auth?.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  const m = await Merchant.findOne({ _id: auth.merchantId }, { estado: 1 }).lean()
  if (!m) {
    return c.json({ ok: false, error: 'merchant not found' }, 404)
  }
  // pending_payment es OK porque es el estado natural mientras el comercio
  // termina el flujo de pago. Solo bloqueamos los terminales.
  if (m.estado === 'cancelado' || m.estado === 'suspendido') {
    return c.json(
      {
        ok: false,
        error: 'merchant inactivo',
        estado: m.estado,
        mensaje:
          m.estado === 'cancelado'
            ? 'Tu suscripción está cancelada. Reactivala desde Mi Comercio para volver a operar.'
            : 'Tu cuenta está suspendida. Contactá soporte.',
      },
      403,
    )
  }
  await next()
}
