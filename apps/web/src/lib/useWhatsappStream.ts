/**
 * Hook que mantiene una conexión SSE con /api/v1/wa/stream del comercio
 * actual. Refleja el estado de la sesión WhatsApp en tiempo real:
 *
 *   - status: disconnected | qr | authenticating | ready | error
 *   - qr: string crudo del último código (cambia ~cada 20s mientras pendiente)
 *   - campaign.progress en vivo durante un envío masivo
 *
 * Reconexión automática con backoff básico de 5s en errores de red.
 *
 * Uso:
 *   const wa = useWhatsappStream()
 *   if (wa.status === 'qr') <QRCode value={wa.qr} />
 *   if (wa.campaign) <Progress sent={wa.campaign.sent} total={wa.campaign.total} />
 */

import { useEffect, useRef, useState } from 'react'
import { api, tokens } from './api'
import { useMerchantSession } from './merchantStore'

export type WaStatus =
  | 'disconnected'
  | 'qr'
  | 'authenticating'
  | 'ready'
  | 'error'

export type WaCampaignProgress = {
  campaignId: string
  sent: number
  failed: number
  total: number
  done: boolean
}

export type WaStreamState = {
  status: WaStatus
  qr: string | null
  lastError: string | null
  campaign: WaCampaignProgress | null
}

const initial: WaStreamState = {
  status: 'disconnected',
  qr: null,
  lastError: null,
  campaign: null,
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001'

export function useWhatsappStream() {
  const { session } = useMerchantSession()
  const [state, setState] = useState<WaStreamState>(initial)
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<number | null>(null)

  useEffect(() => {
    if (!session) {
      esRef.current?.close()
      esRef.current = null
      setState(initial)
      return
    }
    let stopped = false

    // Reconexión: ANTES de reabrir, refrescamos el access (rota cada 1h; un error
    // de SSE suele ser token vencido). me() pasa por api.ts → auto-refresh en 401;
    // si el refresh falla, dispara session-expired y ApiSync redirige al login. Sin
    // esto, el stream moría a la hora y reintentaba para siempre con el token muerto.
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
      // Pedimos un ticket efímero (60s) por header, en vez de mandar el access
      // token en la URL (que puede quedar en logs de proxy).
      if (!tokens.get('merchant').access) {
        scheduleReconnect()
        return
      }
      let ticket: string
      try {
        ticket = (await api.merchantApi.waTicket()).ticket
      } catch {
        if (!stopped) scheduleReconnect()
        return
      }
      if (stopped) return
      const url = `${API_URL.replace(/\/$/, '')}/api/v1/wa/stream?ticket=${encodeURIComponent(
        ticket,
      )}`
      const es = new EventSource(url)
      esRef.current = es

      es.addEventListener('status', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          setState((s) => ({
            ...s,
            status: data.status as WaStatus,
            lastError: data.lastError ?? null,
          }))
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('qr', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          setState((s) => ({ ...s, qr: data.qr, status: 'qr' }))
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('campaign.progress', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          setState((s) => ({
            ...s,
            campaign: {
              campaignId: data.campaignId,
              sent: data.sent,
              failed: data.failed,
              total: data.total,
              done: false,
            },
          }))
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('campaign.done', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          setState((s) => ({
            ...s,
            campaign: {
              campaignId: data.campaignId,
              sent: data.sentCount,
              failed: data.failedCount,
              total: data.sentCount + data.failedCount,
              done: true,
            },
          }))
        } catch {
          /* ignore */
        }
      })

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

  function resetCampaign() {
    setState((s) => ({ ...s, campaign: null }))
  }

  return { ...state, resetCampaign }
}
