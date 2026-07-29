/**
 * Job de expiración: corre al boot y luego cada 10 min.
 *
 * Ahora SOLO marca cupones vencidos. Las activations YA NO TIENEN TTL —
 * el código vale mientras el cupón esté activo. Si el cupón vence, las
 * activaciones siguen como "activo" en DB pero al canjearlo el endpoint
 * `/redemptions/confirm` chequea `coupon.estado` y `coupon.vigenciaHasta`
 * y rechaza el canje.
 *
 * Decisión de diseño:
 *   - Sin TTL = vecino no se siente apurado por el countdown
 *   - El comercio sigue protegido porque el canje chequea el cupón en runtime
 *   - Activations huérfanas no son problema (no ocupan recursos críticos)
 *
 * Idempotente. Si la DB se cae el job loguea y sigue.
 */

import { Coupon, Merchant, Subscription, OwnerAuditLog } from '@/models'

const TICK_MS = 10 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

export async function runExpirySweep(): Promise<{ couponsExpired: number; merchantsSuspended: number }> {
  const now = new Date()
  let couponsExpired = 0
  let merchantsSuspended = 0

  try {
    const c = await Coupon.updateMany(
      { estado: 'activo', vigenciaHasta: { $lt: now } },
      { estado: 'vencido' },
    )
    couponsExpired = c.modifiedCount ?? 0
  } catch (err) {
    console.error('[expiry] cupones falló:', err)
  }

  // Reconciliación suscripción → acceso del comercio. [cazabug S11-01]
  // Un comercio cuya suscripción pasó a cancelled/paused/rejected Y cuyo período
  // pagado (nextBillingAt) YA venció debe dejar de operar. Sin esto seguía 'activo'
  // —creando cupones, viendo PII de clientes y visible en el catálogo— para siempre,
  // porque el webhook solo hacía la transición pending_payment→activo, nunca la
  // inversa. Conservador: NO tocamos a los que están en free-trial (freeTrialUntil
  // futuro) ni a los que siguen dentro del período pagado (nextBillingAt futuro),
  // y solo bajamos a los que hoy están 'activo' (idempotente).
  try {
    const lapsed = await Subscription.find({
      status: { $in: ['cancelled', 'paused', 'rejected'] },
      nextBillingAt: { $lt: now },
    })
      .select('merchantId')
      .lean()
    if (lapsed.length > 0) {
      const ids = lapsed.map((s) => s.merchantId)
      const filtro = {
        _id: { $in: ids },
        estado: 'activo',
        $and: [
          {
            $or: [
              { freeTrialUntil: { $exists: false } },
              { freeTrialUntil: null },
              { freeTrialUntil: { $lt: now } },
            ],
          },
          // Si un HUMANO fijó el estado a mano, no lo pisamos. El owner reactiva
          // un comercio (pagó por transferencia, hubo un error, lo que sea) y diez
          // minutos después esto lo volvía a suspender en silencio: el comercio
          // llamaba de nuevo y el panel seguía mostrando "Activo". Cuando una
          // persona decide, la automatización se corre. [cazabug loop2]
          { $or: [{ estadoManualAt: { $exists: false } }, { estadoManualAt: null }] },
        ],
      }

      // Los buscamos ANTES de bajarlos para poder dejar rastro de cada uno: la
      // Auditoría mostraba "Reactivó comercio" y después nada, así que el owner
      // no encontraba quién lo había suspendido — porque no había sido nadie.
      const aSuspender = await Merchant.find(filtro).select('nombre').lean()
      const res = await Merchant.updateMany(filtro, { estado: 'suspendido' })
      merchantsSuspended = res.modifiedCount ?? 0

      if (aSuspender.length > 0) {
        await OwnerAuditLog.insertMany(
          aSuspender.map((m: any) => ({
            action: 'system.merchant.suspend',
            recurso: 'merchant',
            recursoId: String(m._id),
            ownerEmail: 'sistema',
            detail: `${m.nombre} — suscripción vencida (automático)`,
            at: new Date(),
          })),
        ).catch((err) => console.error('[expiry] no pude auditar la suspensión:', err))
      }
    }
  } catch (err) {
    console.error('[expiry] reconciliación de suscripciones falló:', err)
  }

  if (couponsExpired > 0) {
    console.log(`[expiry] sweep: ${couponsExpired} cupones vencidos`)
  }
  if (merchantsSuspended > 0) {
    console.log(`[expiry] sweep: ${merchantsSuspended} comercios suspendidos por suscripción vencida`)
  }

  return { couponsExpired, merchantsSuspended }
}

export function startExpiryLoop(): void {
  if (timer) return
  // Corre una primera vez de inmediato (no await — no bloquea bootstrap)
  void runExpirySweep()
  timer = setInterval(() => {
    void runExpirySweep()
  }, TICK_MS)
}

export function stopExpiryLoop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
