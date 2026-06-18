/**
 * Catálogo de países soportados para ciudades multi-país.
 *
 * Cada ciudad (App/tenant) tiene país (display), moneda (ISO-4217) y locale
 * (BCP-47). El locale maneja el formato de moneda/números/fechas vía Intl; la
 * traducción de la UI a otros idiomas es un proyecto aparte.
 *
 * Defaults del contrato: pais "Argentina", moneda "ARS", locale "es-AR".
 */

export type Pais = {
  /** Nombre display del país. Ej: "Argentina". */
  nombre: string
  /** Código de moneda ISO-4217. Ej: "ARS". */
  moneda: string
  /** Locale BCP-47 para Intl. Ej: "es-AR". */
  locale: string
  /** Emoji de bandera (opcional, solo display). */
  bandera?: string
}

export const PAISES: readonly Pais[] = [
  { nombre: 'Argentina', moneda: 'ARS', locale: 'es-AR', bandera: '🇦🇷' },
  { nombre: 'Colombia', moneda: 'COP', locale: 'es-CO', bandera: '🇨🇴' },
  { nombre: 'Chile', moneda: 'CLP', locale: 'es-CL', bandera: '🇨🇱' },
  { nombre: 'México', moneda: 'MXN', locale: 'es-MX', bandera: '🇲🇽' },
  { nombre: 'Uruguay', moneda: 'UYU', locale: 'es-UY', bandera: '🇺🇾' },
  { nombre: 'Perú', moneda: 'PEN', locale: 'es-PE', bandera: '🇵🇪' },
  { nombre: 'Paraguay', moneda: 'PYG', locale: 'es-PY', bandera: '🇵🇾' },
  { nombre: 'Bolivia', moneda: 'BOB', locale: 'es-BO', bandera: '🇧🇴' },
  { nombre: 'Ecuador', moneda: 'USD', locale: 'es-EC', bandera: '🇪🇨' },
  { nombre: 'Estados Unidos', moneda: 'USD', locale: 'en-US', bandera: '🇺🇸' },
] as const

/** Defaults del contrato (Argentina). */
export const PAIS_DEFAULT: Pais = PAISES[0]

/**
 * Busca un país por su nombre display (case-insensitive, ignora acentos).
 * Devuelve undefined si no hay match.
 */
export function findPaisByNombre(nombre: string | undefined | null): Pais | undefined {
  if (!nombre) return undefined
  const norm = normalize(nombre)
  return PAISES.find((p) => normalize(p.nombre) === norm)
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
