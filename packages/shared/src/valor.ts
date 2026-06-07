/**
 * Cálculo del ahorro registrado al CANJEAR, por tipo de oferta. Función pura,
 * compartida FE/BE, testeable. El cajero carga `montoTicket`; el ahorro es:
 *   · precio_fijo  → lo que el vecino se ahorró sobre lo que gastó (ticket − precio fijo).
 *   · porcentaje / happy_hour → el % del ticket.
 */
export function calcAhorroCanje(
  coupon: { tipoOferta?: string | null; porcentaje: number; precioFijo?: number | null },
  montoTicket: number,
): number {
  if (!montoTicket || montoTicket <= 0) return 0
  if (coupon.tipoOferta === 'precio_fijo' && coupon.precioFijo != null) {
    return Math.max(0, Math.round(montoTicket - coupon.precioFijo))
  }
  return Math.round((montoTicket * coupon.porcentaje) / 100)
}
