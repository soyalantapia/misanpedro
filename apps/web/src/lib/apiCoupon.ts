import type { ApiCoupon } from './api'
import type { Coupon } from './types'

/**
 * Mapea un ApiCoupon (backend) al Coupon local del vecino, con TODOS los campos
 * del sistema de valor (tipoOferta / precioReferencia / precioFijo / alcance /
 * mostrarAhorroVecino / productoGancho / franja). Único punto de mapeo para que
 * card, detalle y ficha del comercio muestren el valor igual.
 * `merchantId` = el slug del comercio (lo resuelve el caller).
 */
export function apiCouponToLocal(c: ApiCoupon, merchantId: string): Coupon {
  return {
    id: c.id,
    merchantId,
    titulo: c.titulo,
    descripcion: c.descripcion,
    condiciones: c.condiciones ?? '',
    porcentaje: c.porcentaje,
    precioReferencia: c.precioReferencia,
    precioFijo: c.precioFijo,
    vigenciaHasta: c.vigenciaHasta,
    imagenSeed: 'custom',
    imagenUrl: c.imagenUrl ?? undefined,
    estado: c.estado as Coupon['estado'],
    diasAplica: c.diasAplica,
    tipoOferta: c.tipoOferta,
    alcance: c.alcance,
    mostrarAhorroVecino: c.mostrarAhorroVecino,
    productoGancho: c.productoGancho,
    franjaDesde: c.franjaDesde,
    franjaHasta: c.franjaHasta,
  }
}
