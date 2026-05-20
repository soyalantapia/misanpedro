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

import { Coupon } from '@/models'

const TICK_MS = 10 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

export async function runExpirySweep(): Promise<{ couponsExpired: number }> {
  const now = new Date()
  let couponsExpired = 0

  try {
    const c = await Coupon.updateMany(
      { estado: 'activo', vigenciaHasta: { $lt: now } },
      { estado: 'vencido' },
    )
    couponsExpired = c.modifiedCount ?? 0
  } catch (err) {
    console.error('[expiry] cupones falló:', err)
  }

  if (couponsExpired > 0) {
    console.log(`[expiry] sweep: ${couponsExpired} cupones vencidos`)
  }

  return { couponsExpired }
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
