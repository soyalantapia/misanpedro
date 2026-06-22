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
  /** Prefijo telefónico internacional. Ej: "+54". */
  prefijo: string
  /** Emoji de bandera (opcional, solo display). */
  bandera?: string
}

export const PAISES: readonly Pais[] = [
  { nombre: 'Argentina', moneda: 'ARS', locale: 'es-AR', prefijo: '+54', bandera: '🇦🇷' },
  { nombre: 'Colombia', moneda: 'COP', locale: 'es-CO', prefijo: '+57', bandera: '🇨🇴' },
  { nombre: 'Chile', moneda: 'CLP', locale: 'es-CL', prefijo: '+56', bandera: '🇨🇱' },
  { nombre: 'México', moneda: 'MXN', locale: 'es-MX', prefijo: '+52', bandera: '🇲🇽' },
  { nombre: 'Uruguay', moneda: 'UYU', locale: 'es-UY', prefijo: '+598', bandera: '🇺🇾' },
  { nombre: 'Perú', moneda: 'PEN', locale: 'es-PE', prefijo: '+51', bandera: '🇵🇪' },
  { nombre: 'Paraguay', moneda: 'PYG', locale: 'es-PY', prefijo: '+595', bandera: '🇵🇾' },
  { nombre: 'Bolivia', moneda: 'BOB', locale: 'es-BO', prefijo: '+591', bandera: '🇧🇴' },
  { nombre: 'Ecuador', moneda: 'USD', locale: 'es-EC', prefijo: '+593', bandera: '🇪🇨' },
  { nombre: 'Estados Unidos', moneda: 'USD', locale: 'en-US', prefijo: '+1', bandera: '🇺🇸' },
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
