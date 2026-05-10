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
  return () => {
    set!.delete(listener)
    if (set!.size === 0) listeners.delete(merchantId)
  }
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
