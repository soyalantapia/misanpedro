import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { resolveSseMerchant, signSseTicket } from '@/services/jwt.service'
import { requireMerchantAuth } from '@/middleware/auth'
import { subscribe } from '@/services/notifications.service'

export const notificationsRoutes = new Hono()

/**
 * GET /notifications/ticket — emite un ticket efímero (60s) para abrir el stream.
 * Va autenticado por header (Authorization), así el access token NO viaja en la URL.
 */
notificationsRoutes.get('/ticket', requireMerchantAuth, (c) => {
  const auth = c.get('auth') as { merchantId?: string }
  if (!auth?.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  return c.json({ ok: true, ticket: signSseTicket(auth.merchantId) })
})

/**
 * GET /notifications/stream — Server-Sent Events para notificaciones real-time
 * del comercio autenticado.
 *
 * EventSource no permite headers → el credencial viaja en la query. Preferimos un
 * `?ticket=` efímero (ver /ticket); aceptamos `?token=` legacy por compat con
 * bundles cacheados por el Service Worker.
 */
notificationsRoutes.get('/stream', (c) => {
  const merchantId = resolveSseMerchant(c.req.query('ticket'), c.req.query('token'))
  if (!merchantId) return c.json({ ok: false, error: 'invalid ticket' }, 401)

  return streamSSE(c, async (stream) => {
    let unsubscribe: (() => void) | null = null
    let alive = true

    // Listener que escribe a la stream
    const onEvent = async (event: any) => {
      if (!alive) return
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.payload),
          id: String(Date.now()),
        })
      } catch {
        alive = false
      }
    }
    unsubscribe = subscribe(merchantId, onEvent)

    // El cliente se fue. Es LA señal buena: el `catch { alive = false }` de arriba
    // no sirve porque el `write` de Hono se traga todos los errores, así que el
    // loop giraba para siempre y este unsubscribe no corría nunca. Con el
    // EventSource reconectando solo, cada corte dejaba otro listener. [cazabug loop2]
    stream.onAbort(() => {
      alive = false
      unsubscribe?.()
    })

    // Heartbeat cada 25s para mantener vivo el conexion (proxies suelen
    // cortar después de 30s de inactividad).
    await stream.writeSSE({ event: 'connected', data: 'ok' })
    while (alive && !stream.aborted) {
      await stream.sleep(25_000)
      if (!alive || stream.aborted) break
      try {
        await stream.writeSSE({ event: 'heartbeat', data: String(Date.now()) })
      } catch {
        alive = false
      }
    }
    unsubscribe?.()
  })
})
