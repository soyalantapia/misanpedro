import { env } from '@/env'

/**
 * Precio mensual EFECTIVO de una ciudad — fuente única.
 *
 * El monto que un comercio paga por mes se calculaba por separado en cada lugar
 * que lo necesitaba, y cada uno se inventó su propio fallback: la landing 30.000,
 * el env del backend 50.000, la pantalla de plan 50.000, el JSON-LD estático
 * 30.000. Mientras el tenant tenga `precioMensual` cargado los cuatro coinciden
 * de casualidad; apenas falta —y es OPCIONAL en la API (owner.ts:632), aunque el
 * panel lo pida en el formulario— el comercio lee un precio y le debitan otro.
 *
 * La raíz no era cuál de los dos números estaba bien: era que `precioMensual`
 * viajaba CRUDO al frente, así que cada consumidor tenía que resolver el faltante
 * por su cuenta. Resolviéndolo acá, del lado del que cobra, no quedan dos números
 * que puedan divergir: lo que se anuncia ES lo que se debita.
 *
 * `0` no es un precio: un tenant con 0 cae al default global igual que si no
 * tuviera el campo (si algún día existe un plan gratis, es un flag aparte, no un
 * monto en cero — con 0 Mercado Pago rechaza el preapproval).
 */
export function precioPlanEfectivo(tenant: { precioMensual?: number | null }): number {
  const propio = tenant?.precioMensual
  return typeof propio === 'number' && propio > 0 ? propio : Number(env.PLAN_AMOUNT_ARS ?? 50_000)
}
