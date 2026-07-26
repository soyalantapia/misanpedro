/**
 * Términos del programa de lanzamiento — ESPEJO de `apps/landing/src/lib/launch.ts`.
 *
 * Por convención del repo el front NO importa `@misanpedro/shared`: la lógica/constantes
 * chicas se duplican con un comentario al canónico (igual que `calcAhorroCanje` en
 * `lib/cuponValor.ts`). Si cambiás un valor acá, cambialo TAMBIÉN en la landing.
 *
 * Contexto: el modelo es por HITO, no por tiempo — la plataforma es gratis hasta que se
 * completen los primeros TOTAL_CUPOS comercios; recién ahí arranca el precio mensual del
 * tenant (`App.precioMensual`), congelado de por vida. La auditoría PM del 25/07 encontró
 * que esta pantalla seguía prometiendo "3 meses gratis" (modelo viejo) mientras la landing
 * ya prometía el hito: el comerciante veía una promesa distinta —y peor— justo al registrarse.
 */

/** Gratis hasta los primeros N comercios de la ciudad. */
export const TOTAL_CUPOS = 50
