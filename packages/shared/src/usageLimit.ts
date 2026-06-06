// Límite de uso por persona en un cupón — lógica PURA (sin DB).
// Single source of truth FE/BE de la decisión: cuántas veces puede usar un
// cupón cada persona dentro de una ventana, y cuándo vuelve a estar disponible.

export type UsoVentana = 'devida' | 'semana' | 'quincena' | 'mes' | 'ilimitado'

/** Días de cada ventana. `null` = sin tope (ilimitado); `0` = todo el historial (devida). */
export const VENTANA_DIAS: Record<UsoVentana, number | null> = {
  ilimitado: null,
  devida: 0,
  semana: 7,
  quincena: 15,
  mes: 30,
}

const DIA_MS = 24 * 60 * 60 * 1000

export type UsoLimiteConfig = {
  usoMaxPorPersona?: number | null
  usoVentana?: UsoVentana | null
}

export type UsoLimiteResult = {
  ventana: UsoVentana
  max: number
  usos: number
  bloqueado: boolean
  /** ISO de cuándo vuelve a estar disponible (ventana temporal + bloqueado); null si no aplica. */
  nextDisponible: string | null
}

/**
 * Decisión pura del límite de uso por persona.
 * Cupones viejos sin config → {usoMaxPorPersona:1, usoVentana:'devida'} (arregla el abuso por default).
 *
 * @param config        usoMaxPorPersona + usoVentana del cupón.
 * @param fechasDeCanje  redeemedAt de los canjes del (usuario × cupón).
 * @param now            referencia temporal.
 */
export function evaluarUsoLimite(
  config: UsoLimiteConfig,
  fechasDeCanje: Date[],
  now: Date = new Date(),
): UsoLimiteResult {
  const ventana: UsoVentana = config.usoVentana ?? 'devida'
  const max = Math.max(1, config.usoMaxPorPersona ?? 1)

  if (ventana === 'ilimitado') {
    return { ventana, max, usos: 0, bloqueado: false, nextDisponible: null }
  }

  const dias = VENTANA_DIAS[ventana] ?? 0
  const inicio = dias > 0 ? now.getTime() - dias * DIA_MS : 0
  const enVentana = fechasDeCanje
    .filter((d) => d.getTime() >= inicio)
    .sort((a, b) => a.getTime() - b.getTime())
  const usos = enVentana.length
  const bloqueado = usos >= max

  let nextDisponible: string | null = null
  if (bloqueado && dias > 0 && enVentana.length > 0) {
    // Cuando el canje más viejo de la ventana caiga fuera, usos baja por debajo
    // de max → vuelve a estar disponible.
    nextDisponible = new Date(enVentana[0].getTime() + dias * DIA_MS).toISOString()
  }

  return { ventana, max, usos, bloqueado, nextDisponible }
}
