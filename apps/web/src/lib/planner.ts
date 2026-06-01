import type { Coupon, Merchant } from '@/lib/types'
import type { Ocasion } from '@/lib/ocasiones'

/**
 * Motor del planificador "Armá tu plan" (100% client-side, sobre los cupones
 * ya bajados). Dada una ocasión + presupuesto + cantidad de personas, arma:
 *   - `primarios`: planes que ENTRAN en el presupuesto (tienen precioReferencia),
 *     ordenados por mayor ahorro absoluto. Top 3.
 *   - `secundarios`: cupones de la ocasión SIN precio de referencia (no se puede
 *     estimar el gasto), ordenados por % off. Degradación elegante para los
 *     cupones viejos que aún no cargaron precio.
 */
export type Plan = {
  coupon: Coupon
  merchant: Merchant
  /** Precio por persona con el descuento aplicado (null si no hay referencia). */
  precioUnit: number | null
  /** Total estimado para N personas (null si no hay referencia). */
  total: number | null
  /** Ahorro absoluto total vs. precio normal (null si no hay referencia). */
  ahorro: number | null
}

export type PlanResult = {
  primarios: Plan[]
  secundarios: Plan[]
}

const MAX_PRIMARIOS = 3
const MAX_SECUNDARIOS = 6

export function computePlanes(params: {
  coupons: Coupon[]
  getMerchantById: (id: string) => Merchant | undefined
  ocasion: Ocasion
  presupuesto: number
  personas: number
}): PlanResult {
  const { coupons, getMerchantById, ocasion, presupuesto, personas } = params
  const n = Math.max(1, Math.floor(personas) || 1)
  const cats = new Set(ocasion.categorias)

  const conPrecio: Plan[] = []
  const sinPrecio: Plan[] = []

  for (const c of coupons) {
    if (c.estado !== 'activo') continue
    const m = getMerchantById(c.merchantId)
    if (!m) continue
    if (!cats.has(m.categoria)) continue

    if (c.precioReferencia != null && c.precioReferencia > 0) {
      const precioUnit = Math.round(c.precioReferencia * (1 - c.porcentaje / 100))
      const total = precioUnit * n
      const ahorro = Math.round((c.precioReferencia * c.porcentaje) / 100) * n
      conPrecio.push({ coupon: c, merchant: m, precioUnit, total, ahorro })
    } else {
      sinPrecio.push({ coupon: c, merchant: m, precioUnit: null, total: null, ahorro: null })
    }
  }

  const primarios = conPrecio
    .filter((p) => p.total != null && p.total <= presupuesto)
    .sort((a, b) => b.ahorro! - a.ahorro! || b.coupon.porcentaje - a.coupon.porcentaje)
    .slice(0, MAX_PRIMARIOS)

  const secundarios = sinPrecio
    .sort((a, b) => b.coupon.porcentaje - a.coupon.porcentaje)
    .slice(0, MAX_SECUNDARIOS)

  return { primarios, secundarios }
}
