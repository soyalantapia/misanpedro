import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { verifyAccessToken } from '@/services/jwt.service'
import { subscribe } from '@/services/notifications.service'

export const notificationsRoutes = new Hono()

/**
 * GET /notifications/stream — Server-Sent Events para notificaciones real-time
 * del comercio autenticado.
 *
 * El navegador no puede agregar headers a EventSource, así que aceptamos el
 * token en query string `?token=...` (válido para este caso porque el token
 * sólo va a localhost o https).
 */
notificationsRoutes.get('/stream', (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ ok: false, error: 'token required' }, 401)

  let auth
  try {
    auth = verifyAccessToken(token)
  } catch {
    return c.json({ ok: false, error: 'invalid token' }, 401)
  }
  if (auth.type !== 'merchant_user' || !auth.merchantId) {
    return c.json({ ok: false, error: 'forbidden' }, 403)
  }
  const merchantId = auth.merchantId

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

    // Heartbeat cada 25s para mantener vivo el conexion (proxies suelen
    // cortar después de 30s de inactividad).
    await stream.writeSSE({ event: 'connected', data: 'ok' })
    while (alive) {
      await stream.sleep(25_000)
      if (!alive) break
      try {
        await stream.writeSSE({ event: 'heartbeat', data: String(Date.now()) })
      } catch {
        alive = false
      }
    }
    unsubscribe?.()
  })
})
