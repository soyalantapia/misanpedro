/**
 * Programa de lanzamiento — términos de la oferta (cupos, meses gratis, precio
 * fallback). El CONTEO de comercios adheridos NO vive acá: es un dato REAL que
 * viene del backend (GET /tenant/:slug/config → merchantsActivos) y se deriva con
 * el helper `cupos(config)` de lib/tenant.ts. Antes "ya van 2 de 20" era una
 * constante hardcodeada (mockup); ahora es el conteo real de la DB.
 */

/** Cupos totales del programa de lanzamiento (término de la oferta: "primeros 20"). */
export const TOTAL_CUPOS = 20

/** Meses gratis para los primeros TOTAL_CUPOS comercios. */
export const MESES_GRATIS = 3

/** Precio mensual FALLBACK (si el tenant no trae precioMensual). El real sale del
 *  tenant (priceLabel lo formatea con la moneda de la ciudad). */
export const PRECIO_MENSUAL = 50000
export const PRECIO_MENSUAL_LABEL = '$50.000'
