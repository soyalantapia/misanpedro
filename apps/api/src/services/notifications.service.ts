/**
 * Pub/sub in-memory para notificaciones real-time via SSE.
 *
 * Cada comercio se suscribe a sus propios eventos. Cuando ocurre un canje,
 * se publica al canal del merchantId.
 *
 * Limitaciones:
 *   - Memoria local (no escalable a múltiples instancias). Para producción
 *     con varios pods, migrar a Redis pub/sub.
 *   - Un cajero conectado por comercio recibe notif al instante.
 */

type Listener = (event: NotifEvent) => void

export type NotifEvent =
  | {
      type: 'redemption.created'
      merchantId: string
      payload: {
        redemptionId: string
        couponTitulo: string
        userNombre: string
        ahorroEstimado: number
        montoTicket?: number
        redeemedAt: string
      }
    }
  | {
      type: 'activation.created'
      merchantId: string
      payload: {
        activationId: string
        couponTitulo: string
        userNombre: string
        codigoNumerico: string
      }
    }

const listeners = new Map<string, Set<Listener>>()

export function subscribe(merchantId: string, listener: Listener): () => void {
  let set = listeners.get(merchantId)
  if (!set) {
    set = new Set()
    listeners.set(merchantId, set)
  }
  set.add(listener)
  const propio = set
  return () => {
    propio.delete(listener)
    // Sólo se borra la entrada del mapa si TODAVÍA es la nuestra. Sin esa
    // comprobación, un unsubscribe repetido de un stream ya muerto —que ve su Set
    // vacío para siempre— borraba del mapa el Set del cliente que reconectó, y ese
    // cliente quedaba con la conexión viva pero sin recibir un solo evento: al
    // comercio no le aparecía el QR ni le cambiaba el estado, sin nada que fallara.
    // Se volvió alcanzable al arreglar la fuga de SSE, donde unsubscribe corre en
    // onAbort y otra vez al salir del loop del heartbeat. [cazabug loop2]
    if (propio.size === 0 && listeners.get(merchantId) === propio) {
      listeners.delete(merchantId)
    }
  }
}

/**
 * Cuántos listeners hay colgados de un comercio. Sólo para tests: es lo que
 * permite ver la fuga sin adivinar. Espejo de `_listenersDe` en
 * whatsapp.service.ts — las dos rutas de stream tenían el mismo bug.
 * [cazabug loop2]
 */
export function _listenersDe(merchantId: string): number {
  return listeners.get(merchantId)?.size ?? 0
}

export function publish(event: NotifEvent): void {
  const set = listeners.get(event.merchantId)
  if (!set) return
  for (const fn of set) {
    try {
      fn(event)
    } catch (err) {
      console.error('[notif] listener error', err)
    }
  }
}
