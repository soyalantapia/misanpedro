import { evaluarUsoLimite, type UsoLimiteConfig, type UsoLimiteResult } from '@misanpedro/shared'
import { Redemption } from '@/models'

/**
 * Guard REAL del límite de uso por persona. Cuenta los canjes (Redemption) del
 * (appId, couponId, userId) y evalúa el límite. Lo llaman DOS puntos:
 *   - activations POST /        (antes de crear la activación)
 *   - redemptions /confirm      (antes de registrar el canje — carreras/códigos viejos)
 * La decisión vive en `evaluarUsoLimite` (shared, pura + testeada).
 */
export async function checkUsoLimite(
  appId: unknown,
  couponId: unknown,
  userId: unknown,
  coupon: UsoLimiteConfig,
  now: Date = new Date(),
): Promise<UsoLimiteResult> {
  // 'ilimitado' nunca bloquea → evitamos la query.
  if ((coupon.usoVentana ?? 'devida') === 'ilimitado') {
    return evaluarUsoLimite(coupon, [], now)
  }
  const reds = await Redemption.find({ appId, couponId, userId })
    .select('redeemedAt')
    .sort({ redeemedAt: 1 })
    .lean()
  const fechas = reds.map((r: { redeemedAt: Date }) => new Date(r.redeemedAt))
  return evaluarUsoLimite(coupon, fechas, now)
}
