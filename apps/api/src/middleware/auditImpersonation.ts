import type { MiddlewareHandler } from 'hono'
import { OwnerAuditLog } from '@/models'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Endpoints de la propia sesión de soporte: no son "acciones sobre el comercio".
const SKIP_SUFFIX = ['/merchant/auth/support-exchange', '/merchant/auth/refresh', '/merchant/auth/logout']

/**
 * Auditoría del MODO SOPORTE. Corre envolviendo cada request: si fue una mutación
 * (POST/PUT/PATCH/DELETE) que salió OK y el auth lleva `impersonatedBy` (sesión de
 * soporte), registra en OwnerAuditLog QUIÉN (owner) tocó QUÉ comercio. Fire-and-forget:
 * la auditoría nunca agrega latencia ni rompe la respuesta. El `sub` del token sigue
 * siendo el propietario, así que la acción en sí se atribuye al comercio; esto es el
 * rastro paralelo (silencioso para el comercio).
 */
export const auditImpersonation: MiddlewareHandler = async (c, next) => {
  await next()
  try {
    if (!MUTATING.has(c.req.method)) return
    if (c.res.status >= 400) return
    const auth = c.get('auth') as
      | { impersonatedBy?: string; merchantId?: string }
      | undefined
    if (!auth?.impersonatedBy) return
    const path = new URL(c.req.url).pathname
    if (SKIP_SUFFIX.some((p) => path.endsWith(p))) return
    void OwnerAuditLog.create({
      ownerId: auth.impersonatedBy,
      action: `support.${c.req.method.toLowerCase()}`,
      recurso: 'merchant',
      recursoId: auth.merchantId,
      detail: `${c.req.method} ${path}`,
      ip: c.req.header('x-forwarded-for'),
      at: new Date(),
    }).catch(() => {})
  } catch {
    /* la auditoría nunca debe romper la request */
  }
}
