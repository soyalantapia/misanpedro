import type { Coupon, Merchant } from '@/lib/types'
import type { Ocasion } from '@/lib/ocasiones'

/**
 * Buscador del "Armá tu plan": dada una ocasión (intención en lenguaje de
 * persona), devuelve los CUPONES activos cuyos comercios pertenecen a las
 * categorías de esa ocasión, ordenados por mayor % de descuento (lo que más le
 * rinde al vecino).
 *
 * Es un finder de cupones sobre lo que ya está bajado — sin presupuesto, sin
 * precios de referencia, sin personas. La cuponera funciona con %: el plan es
 * simplemente "estos son los cupones que te sirven para lo que querés hacer".
 */
export type CuponMatch = {
  coupon: Coupon
  merchant: Merchant
}

export function cuponesDeOcasion(params: {
  coupons: Coupon[]
  getMerchantById: (id: string) => Merchant | undefined
  ocasion: Ocasion
}): CuponMatch[] {
  const { coupons, getMerchantById, ocasion } = params
  const cats = new Set(ocasion.categorias)

  const out: CuponMatch[] = []
  for (const c of coupons) {
    if (c.estado !== 'activo') continue
    const m = getMerchantById(c.merchantId)
    if (!m) continue
    if (!cats.has(m.categoria)) continue
    out.push({ coupon: c, merchant: m })
  }

  // Mejor descuento primero (lo que más le rinde la plata al vecino).
  out.sort((a, b) => b.coupon.porcentaje - a.coupon.porcentaje)
  return out
}
