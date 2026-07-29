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

/**
 * Precio de la landing PARAGUAS (micuidad.com sin ciudad) — NO es el precio de
 * ninguna ciudad concreta.
 *
 * Cada ciudad tiene el suyo y el backend ya lo resuelve: `GET /tenant/:slug/config`
 * devuelve `precioMensual` SIEMPRE con un número, calculado con la misma función
 * que usa el cobro (api `lib/precioPlan.ts`). Así que en cualquier ciudad real
 * este valor no se usa; sólo aparece cuando no hay ciudad que resolver.
 *
 * Antes era un fallback de verdad: si la ciudad no tenía `precioMensual` cargado
 * —y es un campo OPCIONAL en la API— la landing prometía estos 30.000 y el débito
 * salía por el default del backend, 50.000. El comercio leía un precio y le
 * cobraban otro.
 *
 * ⚠️ Si tocás este número, no hay nada que lo sincronice con el backend. No lo
 * uses como "el precio del producto": el precio del producto vive en el tenant.
 */
export const PRECIO_MENSUAL = 30000
