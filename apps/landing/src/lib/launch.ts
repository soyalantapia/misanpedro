/**
 * Programa de lanzamiento — términos de la oferta (cupos + precio fallback).
 *
 * MODELO: la plataforma es GRATIS hasta que se completen los primeros
 * TOTAL_CUPOS comercios; a partir de ahí cada comercio paga PRECIO_MENSUAL/mes,
 * congelado de por vida. (Antes era "3 meses gratis" por tiempo; ahora es por
 * hito de adhesión — decisión del dueño.)
 *
 * El CONTEO de comercios adheridos NO vive acá: es un dato REAL que viene del
 * backend (GET /tenant/:slug/config → merchantsActivos) y se deriva con el
 * helper `cupos(config)` de lib/tenant.ts.
 */

/** Cupos del programa de lanzamiento: gratis hasta los primeros N comercios. */
export const TOTAL_CUPOS = 50

/** Precio mensual FALLBACK (si el tenant no trae precioMensual). El real sale del
 *  tenant (priceLabel lo formatea con la moneda de la ciudad). */
export const PRECIO_MENSUAL = 30000
export const PRECIO_MENSUAL_LABEL = '$30.000'
