/**
 * Hook que mantiene una conexión SSE con /api/v1/notifications/stream y
 * acumula los eventos `redemption.created` / `activation.created` que va
 * recibiendo. Reconecta automáticamente cuando la conexión se pierde.
 *
 * Uso:
 *   const { events, unread, markAllRead } = useMerchantNotifications()
 *
 * Notas:
 *   - EventSource no permite custom headers, así que el access token
 *     viaja por query string (?token=...).
 *   - Si no hay sesión activa no abrimos conexión.
 *   - Persiste los eventos en localStorage para que no desaparezcan al
 *     navegar entre páginas, manteniendo un máximo de 50 eventos.
 */

import { useEffect, useRef, useState } from 'react'
import { api, tokens } from './api'
import { useMerchantSession } from './merchantStore'

export type MerchantNotifEvent = {
  id: string
  type: 'redemption.created' | 'activation.created'
  occurredAt: string
  receivedAt: number
  read: boolean
  payload: any
}

const STORAGE_PREFIX = 'misanpedro.merchant.notif.v1'
// Key GLOBAL vieja (sin scope por comercio): en un dispositivo compartido, el
// comercio B cargaba las notificaciones —con PII de clientes (canjes)— del comercio
// A. Ya no se escribe; la borramos al cargar para limpiar la fuga. [cazabug S10-01]
const LEGACY_GLOBAL_KEY = STORAGE_PREFIX
const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
const MAX_EVENTS = 50

/** Bucket de localStorage scopeado por comercio: el historial de un comercio no
 *  es legible por otro que use el mismo browser. */
export function notifStorageKey(merchantId: string): string {
  return `${STORAGE_PREFIX}.${merchantId}`
}

export function loadStored(merchantId: string | null | undefined): MerchantNotifEvent[] {
  if (typeof window === 'undefined') return []
  // Higiene: eliminamos el bucket GLOBAL viejo (PII de otro comercio) si sigue ahí.
  try {
    window.localStorage.removeItem(LEGACY_GLOBAL_KEY)
  } catch {
    /* noop */
  }
  if (!merchantId) return []
  try {
    const raw = window.localStorage.getItem(notifStorageKey(merchantId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as MerchantNotifEvent[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : []
  } catch {
    return []
  }
}

export function persistNotif(merchantId: string | null | undefined, events: MerchantNotifEvent[]) {
  if (typeof window === 'undefined' || !merchantId) return
  try {
    window.localStorage.setItem(notifStorageKey(merchantId), JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    /* noop */
  }
}

export function useMerchantNotifications() {
  const { session } = useMerchantSession()
  const merchantId = session?.merchantId ?? null
  const [events, setEvents] = useState<MerchantNotifEvent[]>(() => loadStored(merchantId))
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<number | null>(null)

  // Al cambiar de comercio (otro login en el MISMO browser) recargamos el bucket
  // scopeado: nunca mostramos las notificaciones (con PII) del comercio anterior.
  useEffect(() => {
    setEvents(loadStored(merchantId))
  }, [merchantId])

  useEffect(() => {
    if (!session) {
      // Cerramos cualquier conexión previa
      esRef.current?.close()
      esRef.current = null
      return
    }
    let stopped = false

    // Reconexión con refresh del access (rota cada 1h). Sin esto, el stream de
    // notificaciones moría a la hora y reintentaba para siempre con el token muerto.
    function scheduleReconnect() {
      if (stopped) return
      if (retryRef.current) window.clearTimeout(retryRef.current)
      retryRef.current = window.setTimeout(() => {
        void api.merchantApi
          .me()
          .catch(() => {})
          .finally(() => open())
      }, 5000)
    }

    async function open() {
      if (stopped) return
      // Pedimos un ticket efímero (60s) por header en vez de mandar el access
      // token en la URL. Si no hay sesión o el ticket falla, reintentamos.
      if (!tokens.get('merchant').access) {
        scheduleReconnect()
        return
      }
      let ticket: string
      try {
        ticket = (await api.merchantApi.notificationsTicket()).ticket
      } catch {
        if (!stopped) scheduleReconnect()
        return
      }
      if (stopped) return
      const url = `${API_URL.replace(/\/$/, '')}/api/v1/notifications/stream?ticket=${encodeURIComponent(
        ticket,
      )}`
      const es = new EventSource(url)
      esRef.current = es

      const handler = (kind: MerchantNotifEvent['type']) => (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          setEvents((prev) => {
            const next: MerchantNotifEvent = {
              id: `${data.id ?? Math.random().toString(36).slice(2)}-${Date.now()}`,
              type: kind,
              occurredAt: data.occurredAt ?? new Date().toISOString(),
              receivedAt: Date.now(),
              read: false,
              payload: data,
            }
            const merged = [next, ...prev].slice(0, MAX_EVENTS)
            persistNotif(merchantId, merged)
            return merged
          })
        } catch {
          /* ignore malformed */
        }
      }
      es.addEventListener('redemption.created', handler('redemption.created') as any)
      es.addEventListener('activation.created', handler('activation.created') as any)

      es.onerror = () => {
        es.close()
        esRef.current = null
        scheduleReconnect()
      }
    }

    open()

    return () => {
      stopped = true
      if (retryRef.current) window.clearTimeout(retryRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [session?.userId, session?.merchantId])

  function markAllRead() {
    setEvents((prev) => {
      const next = prev.map((e) => ({ ...e, read: true }))
      persistNotif(merchantId, next)
      return next
    })
  }

  function clearAll() {
    setEvents(() => {
      persistNotif(merchantId, [])
      return []
    })
  }

  const unread = events.filter((e) => !e.read).length
  return { events, unread, markAllRead, clearAll }
}
