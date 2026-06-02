/**
 * Programa de lanzamiento — fuente única de verdad para la oferta y los
 * números de escasez que se muestran en la landing ("ya van X de 20").
 *
 * Cuando entra un comercio nuevo, subí COMERCIOS_ADHERIDOS y se actualiza
 * solo en todas las secciones (Hero, Pricing, SocialProof, FinalCTA, FAQ).
 */

/** Cupos totales del programa de lanzamiento. */
export const TOTAL_CUPOS = 20

/** Comercios ya adheridos (actualizar a mano a medida que se suman). */
export const COMERCIOS_ADHERIDOS = 2

/** Lugares que quedan en la oferta de lanzamiento. */
export const CUPOS_RESTANTES = TOTAL_CUPOS - COMERCIOS_ADHERIDOS

/** Meses gratis para los primeros TOTAL_CUPOS comercios. */
export const MESES_GRATIS = 3

/** Precio mensual una vez terminado el período gratis. */
export const PRECIO_MENSUAL = 50000
export const PRECIO_MENSUAL_LABEL = '$50.000'

/** Frase de escasez reutilizable, p. ej. "Ya van 2 de 20 — quedan 18 lugares". */
export const ESCASEZ_LABEL = `Ya van ${COMERCIOS_ADHERIDOS} de ${TOTAL_CUPOS} — quedan ${CUPOS_RESTANTES} lugares`
