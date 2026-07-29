/**
 * Qué hacer cuando el vecino toca "Canjear descuento".
 *
 * Función pura, sin React ni stores → fácil de testear, que es justo lo que
 * faltaba: este era el punto donde la app le fabricaba al vecino un código de 6
 * dígitos que no existía en el backend. [cazabug loop2 · P0]
 *
 * EL BUG: el camino de demo ("activá local, sin backend") se elegía cuando NO
 * había token. Pero "no hay token" significa dos cosas MUY distintas:
 *   - en la demo: no hay backend, está bien activar local
 *   - en producción: tu sesión se murió
 * Compartían discriminante, así que en producción el vecino se llevaba al
 * mostrador un código inventado, el cajero le decía "no existe", y él lo tenía
 * en pantalla. Nunca había visto un cartel de sesión vencida.
 *
 * EL ARREGLO: el modo demo lo decide el CUPÓN (uno sembrado no tiene id de Mongo),
 * no la ausencia de token. Si el cupón es real y no hay sesión usable, lo mandamos
 * a identificarse — nunca a un código falso.
 */

export type DecisionActivar =
  /** No hay sesión usable para este cupón real: que entre con su email. */
  | { tipo: 'pedir-datos' }
  /** Cupón de demo/seed: activación local, no hay nada que pedirle al backend. */
  | { tipo: 'local' }
  /** Caso real: POST /activations. */
  | { tipo: 'backend' }

/** Los cupones que viven en el backend tienen ObjectId de Mongo. */
function esCuponDelBackend(couponId: string): boolean {
  return /^[0-9a-f]{24}$/i.test(couponId)
}

export function decidirActivacion(input: {
  hayUser: boolean
  hayToken: boolean
  couponId: string
}): DecisionActivar {
  if (!input.hayUser) return { tipo: 'pedir-datos' }

  // El cupón manda: si no vive en el backend, es de la demo y se activa local.
  if (!esCuponDelBackend(input.couponId)) return { tipo: 'local' }

  // Cupón real sin sesión viva: la sesión se murió (la revocaron desde otro
  // dispositivo, o venció el refresh). Que vuelva a entrar; NO le inventamos
  // un código que el comercio no va a poder validar.
  if (!input.hayToken) return { tipo: 'pedir-datos' }

  return { tipo: 'backend' }
}
