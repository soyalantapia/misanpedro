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
import { tokens } from './api'
import { useMerchantSession } from './merchantStore'

export type MerchantNotifEvent = {
  id: string
  type: 'redemption.created' | 'activation.created'
  occurredAt: string
  receivedAt: number
  read: boolean
  payload: any
}

const STORAGE_KEY = 'misanpedro.merchant.notif.v1'
const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'
const MAX_EVENTS = 50

function loadStored(): MerchantNotifEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MerchantNotifEvent[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : []
  } catch {
    return []
  }
}

function persist(events: MerchantNotifEvent[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    /* noop */
  }
}

export function useMerchantNotifications() {
  const { session } = useMerchantSession()
  const [events, setEvents] = useState<MerchantNotifEvent[]>(() => loadStored())
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<number | null>(null)

  useEffect(() => {
    if (!session) {
      // Cerramos cualquier conexión previa
      esRef.current?.close()
      esRef.current = null
      return
    }
    const access = tokens.get('merchant').access
    if (!access) return

    let stopped = false

    function open() {
      if (stopped) return
      const url = `${API_URL.replace(/\/$/, '')}/api/v1/notifications/stream?token=${encodeURIComponent(
        access!,
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
            persist(merged)
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
        if (stopped) return
        // Reintento con backoff simple a 5s
        if (retryRef.current) window.clearTimeout(retryRef.current)
        retryRef.current = window.setTimeout(open, 5000)
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
      persist(next)
      return next
    })
  }

  function clearAll() {
    setEvents(() => {
      persist([])
      return []
    })
  }

  const unread = events.filter((e) => !e.read).length
  return { events, unread, markAllRead, clearAll }
}
