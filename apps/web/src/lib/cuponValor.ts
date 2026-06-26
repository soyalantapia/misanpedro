import type { Coupon } from './types'

export type ValorModo = 'precio_fijo' | 'pesos_exacto' | 'pesos_aprox' | 'solo_pct'

export type ValorDisplay = {
  /** % para el badge (siempre se muestra). */
  porcentaje: number
  /** Cómo expresar el valor del cupón al vecino. */
  modo: ValorModo
  /** precio_fijo: precio final con el cupón. */
  precioFijo?: number
  /** precio normal de referencia (precio_fijo / pesos_*). */
  precioRef?: number
  /** lo que paga el vecino (pesos_exacto). */
  paga?: number
  /** pesos ahorrados (precio_fijo con ref / pesos_*). */
  ahorro?: number
  /** sobre qué aplica (productoGancho) — para solo_pct / pesos_aprox. */
  sobre?: string
  esHappyHour: boolean
  franja?: { desde: string; hasta: string }
}

/**
 * Ahorro registrado al CANJEAR, por tipo de oferta. DUPLICADO del canónico
 * packages/shared/src/valor.ts (el front no importa @misanpedro/shared, ver
 * usoLimite.ts). MANTENER EN SINCRONÍA: el preview del ahorro que ve el cajero
 * DEBE coincidir con lo que persiste el backend al confirmar. Lockeado por
 * cuponValor.test.ts con los mismos vectores que valor.test.ts.
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

type ValorInput = Pick<
  Coupon,
  | 'porcentaje'
  | 'precioReferencia'
  | 'precioFijo'
  | 'tipoOferta'
  | 'alcance'
  | 'mostrarAhorroVecino'
  | 'productoGancho'
  | 'franjaDesde'
  | 'franjaHasta'
>

/**
 * SISTEMA DE VALOR DEL CUPÓN — traduce los campos a CÓMO mostrar el valor al
 * vecino, de forma HONESTA (nunca inventa pesos sobre un ticket ficticio).
 *
 *   precio_fijo              → "Pagás $X"  (+ "antes $Y · ahorrás $Z" si hay precioRef)
 *   %/happy + precio + ON:
 *     · puntual              → "Pagás $Y · ahorrás $Z"  (EXACTO)
 *     · categoria            → "Ahorrás ~$Z (en una de $Y)"  (orientativo)
 *   sin precio  o  toggle OFF → "X% OFF" + sobre qué aplica  (SOLO el %)
 */
export function valorCupon(c: ValorInput): ValorDisplay {
  const tipo = c.tipoOferta ?? 'porcentaje'
  const pct = c.porcentaje
  const precioRef = c.precioReferencia && c.precioReferencia > 0 ? c.precioReferencia : undefined
  const sobre = c.productoGancho?.trim() || undefined
  const esHappyHour = tipo === 'happy_hour'
  const franja =
    c.franjaDesde && c.franjaHasta ? { desde: c.franjaDesde, hasta: c.franjaHasta } : undefined

  // PRECIO FIJO: el precio ES la oferta.
  if (tipo === 'precio_fijo' && c.precioFijo != null) {
    const ahorro =
      precioRef != null && precioRef > c.precioFijo ? Math.round(precioRef - c.precioFijo) : undefined
    return { porcentaje: pct, modo: 'precio_fijo', precioFijo: c.precioFijo, precioRef, ahorro, sobre, esHappyHour: false }
  }

  // PORCENTAJE / HAPPY HOUR
  const mostrar = c.mostrarAhorroVecino !== false // default true
  if (mostrar && precioRef != null) {
    const ahorro = Math.round((precioRef * pct) / 100)
    if ((c.alcance ?? 'puntual') === 'categoria') {
      return { porcentaje: pct, modo: 'pesos_aprox', precioRef, ahorro, sobre, esHappyHour, franja }
    }
    const paga = Math.round(precioRef * (1 - pct / 100))
    return { porcentaje: pct, modo: 'pesos_exacto', precioRef, paga, ahorro, sobre, esHappyHour, franja }
  }

  // Sin precio o el comercio apagó el ahorro en pesos → solo el %.
  return { porcentaje: pct, modo: 'solo_pct', sobre, esHappyHour, franja }
}

/** Franja legible para el vecino: "15 a 18 hs". */
export function franjaTexto(f?: { desde: string; hasta: string }): string | null {
  return f ? `${f.desde} a ${f.hasta} hs` : null
}
