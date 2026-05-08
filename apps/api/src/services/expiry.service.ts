/**
 * Job de expiración: corre al boot y luego cada 10 min.
 *   - Cupones con vigenciaHasta < now y estado='activo' → 'vencido'
 *   - Activations con expiresAt < now y status='activo' → 'expirado'
 *
 * Idempotente. Si la DB se cae el job loguea y sigue.
 */

import { Activation, Coupon } from '@/models'

const TICK_MS = 10 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

export async function runExpirySweep(): Promise<{
  couponsExpired: number
  activationsExpired: number
}> {
  const now = new Date()
  let couponsExpired = 0
  let activationsExpired = 0

  try {
    const c = await Coupon.updateMany(
      { estado: 'activo', vigenciaHasta: { $lt: now } },
      { estado: 'vencido' },
    )
    couponsExpired = c.modifiedCount ?? 0
  } catch (err) {
    console.error('[expiry] cupones falló:', err)
  }

  try {
    const a = await Activation.updateMany(
      { status: 'activo', expiresAt: { $lt: now } },
      { status: 'expirado' },
    )
    activationsExpired = a.modifiedCount ?? 0
  } catch (err) {
    console.error('[expiry] activations falló:', err)
  }

  if (couponsExpired > 0 || activationsExpired > 0) {
    console.log(
      `[expiry] sweep: ${couponsExpired} cupones vencidos, ${activationsExpired} activations expiradas`,
    )
  }

  return { couponsExpired, activationsExpired }
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
