/**
 * WhatsApp Web service — integración real vía whatsapp-web.js (Puppeteer).
 *
 * Ciclo de vida por comercio:
 *   1) startSession(merchantId) instancia un Client con LocalAuth persistido en
 *      disco. Genera evento `qr` con el código que el comercio escanea.
 *   2) `authenticated` → `ready`. La sesión queda conectada.
 *   3) sendMessage(merchantId, to, text) envía por el chat 1-a-1.
 *   4) sendCampaign(merchantId, recipients, text, onProgress) itera con
 *      delay anti-ban (random 2-5s) y emite progreso por callback.
 *
 * Pub/sub para SSE: cualquier consumidor puede `subscribe(merchantId)` y
 * recibir eventos `qr`, `status`, `campaign.progress`, `campaign.done`.
 *
 * Persistencia: las credenciales viven en disco bajo
 * `${WHATSAPP_SESSIONS_DIR}/${merchantId}/`. Si se reinicia el server, la
 * sesión se restaura SIN re-escanear QR (LocalAuth).
 */

import path from 'node:path'
import { env } from '@/env'

type ClientStatus = 'disconnected' | 'qr' | 'authenticating' | 'ready' | 'error'

export type WaEvent =
  | { type: 'qr'; merchantId: string; qr: string }
  | { type: 'status'; merchantId: string; status: ClientStatus; lastError?: string }
  | {
      type: 'campaign.progress'
      merchantId: string
      campaignId: string
      sent: number
      failed: number
      total: number
    }
  | {
      type: 'campaign.done'
      merchantId: string
      campaignId: string
      sentCount: number
      failedCount: number
    }

type SessionState = {
  status: ClientStatus
  qr?: string
  lastError?: string
  client?: any
}

const sessions = new Map<string, SessionState>()
const listeners = new Map<string, Set<(e: WaEvent) => void>>()

let WAClient: any = null
let LocalAuth: any = null
let waLoadAttempted = false

async function loadWA() {
  if (waLoadAttempted) return
  waLoadAttempted = true
  try {
    const moduleName = 'whatsapp-web.js'
    const wa: any = await import(/* @vite-ignore */ moduleName)
    // whatsapp-web.js es CommonJS. Vía dynamic import, los exports quedan
    // dentro de wa.default. Algunos (Client) también están a nivel raíz,
    // pero LocalAuth sólo está en default.
    const src = wa.default ?? wa
    WAClient = src.Client ?? wa.Client
    LocalAuth = src.LocalAuth
    if (!WAClient || !LocalAuth) {
      console.warn('[wa] whatsapp-web.js cargado pero faltan exports',
        { hasClient: !!WAClient, hasLocalAuth: !!LocalAuth })
      return
    }
    console.log('[wa] whatsapp-web.js cargado correctamente')
  } catch (err) {
    console.warn('[wa] whatsapp-web.js no disponible; servicio en modo stub', err)
  }
}

function publish(event: WaEvent) {
  const set = listeners.get(event.merchantId)
  if (!set) return
  for (const fn of set) {
    try {
      fn(event)
    } catch (err) {
      console.error('[wa] listener error', err)
    }
  }
}

export function subscribe(
  merchantId: string,
  listener: (e: WaEvent) => void,
): () => void {
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

/**
 * Cuántos listeners hay colgados de un comercio. Sólo para tests: es lo que
 * permite ver la fuga sin adivinar (cada reconexión del EventSource sumaba uno
 * que no se soltaba nunca). [cazabug loop2]
 */
export function _listenersDe(merchantId: string): number {
  return listeners.get(merchantId)?.size ?? 0
}

export async function getStatus(merchantId: string): Promise<SessionState> {
  await loadWA()
  return sessions.get(merchantId) ?? { status: 'disconnected' }
}

/**
 * ¿Este comercio puede enviar AHORA? Espeja la decisión que toma `sendCampaign`
 * al arrancar (sesión lista, o stub de dev/QA). Permite validar ANTES de aceptar
 * una campaña async: si no se puede enviar, respondemos el error de una en vez de
 * un "202 aceptada" que nunca envía. [cazabug S9-01]
 */
export function isSendable(merchantId: string): boolean {
  const s = sessions.get(merchantId)
  if (s && s.status === 'ready' && s.client) return true
  // Stub SOLO en dev/QA (sin whatsapp-web.js). En prod NUNCA fingimos éxito.
  return !WAClient && process.env.NODE_ENV !== 'production'
}

export async function startSession(merchantId: string): Promise<SessionState> {
  await loadWA()
  const existing = sessions.get(merchantId)
  // Idempotencia: si ya hay una sesión viva (cualquier status excepto 'error'
  // o 'disconnected'), devolvemos esa SIN recrear el cliente. Recrearlo
  // mata el QR pendiente y el cliente Puppeteer abierto, lo cual rompe
  // el escaneo si el frontend dispara /wa/start varias veces.
  if (existing && existing.client && existing.status !== 'error') {
    return existing
  }
  // Si quedó un cliente en error, lo destruimos antes de crear uno nuevo.
  if (existing?.client) {
    try {
      await existing.client.destroy()
    } catch {
      /* noop */
    }
    sessions.delete(merchantId)
  }

  if (!WAClient || !LocalAuth) {
    const stub: SessionState = { status: 'qr', qr: 'STUB_QR_PLACEHOLDER' }
    sessions.set(merchantId, stub)
    publish({ type: 'qr', merchantId, qr: stub.qr! })
    return stub
  }

  const dataPath = path.join(env.WHATSAPP_SESSIONS_DIR, merchantId)
  // Permitimos override del binario de Chrome vía env `PUPPETEER_EXECUTABLE_PATH`.
  // Si no está seteado y estamos en Mac, usamos Google Chrome del sistema para
  // no depender del Chromium que descarga Puppeteer (que pide una versión muy
  // específica y a veces no está disponible). En Linux/CI configurar la env.
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined)
  const client = new WAClient({
    authStrategy: new LocalAuth({ clientId: merchantId, dataPath }),
    puppeteer: {
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  })

  const state: SessionState = { status: 'authenticating', client }
  sessions.set(merchantId, state)

  client.on('qr', (qr: string) => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'qr'
      s.qr = qr
    }
    publish({ type: 'qr', merchantId, qr })
    publish({ type: 'status', merchantId, status: 'qr' })
  })
  client.on('authenticated', () => {
    const s = sessions.get(merchantId)
    if (s) s.status = 'authenticating'
    publish({ type: 'status', merchantId, status: 'authenticating' })
  })
  client.on('ready', () => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'ready'
      s.qr = undefined
    }
    publish({ type: 'status', merchantId, status: 'ready' })
  })
  client.on('disconnected', (reason: string) => {
    sessions.delete(merchantId)
    publish({ type: 'status', merchantId, status: 'disconnected', lastError: reason })
  })
  client.on('auth_failure', (err: any) => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'error'
      s.lastError = String(err)
    }
    publish({ type: 'status', merchantId, status: 'error', lastError: String(err) })
  })

  client.initialize().catch((err: any) => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'error'
      s.lastError = err?.message ?? String(err)
    }
    publish({
      type: 'status',
      merchantId,
      status: 'error',
      lastError: err?.message ?? String(err),
    })
  })

  return state
}

export async function stopSession(merchantId: string): Promise<void> {
  const s = sessions.get(merchantId)
  if (s?.client) {
    try {
      await s.client.destroy()
    } catch {
      /* noop */
    }
  }
  sessions.delete(merchantId)
  publish({ type: 'status', merchantId, status: 'disconnected' })
}

/** Normaliza el número al formato esperado por wa: `${digits}@c.us`. */
function toChatId(to: string): string {
  return `${to.replace(/\D/g, '')}@c.us`
}

/** Destinatario de campaña: teléfono + nombre (para personalizar {{nombre}}). */
export type CampaignRecipient = { to: string; nombre?: string }

/**
 * Reemplaza el token {{nombre}} por el PRIMER nombre del destinatario.
 * El front manda la plantilla con {{nombre}} intacto y acá la personalizamos
 * por cada vecino (antes se mandaba el nombre del primer cliente a todos).
 * Fallback "vecin@" (término inclusivo de la marca) si no hay nombre real.
 */
function personalizar(text: string, nombre?: string): string {
  const first = (nombre ?? '').trim().split(/\s+/)[0]
  const safe = first && first.toLowerCase() !== 'vecin@' ? first : 'vecin@'
  return text.replace(/\{\{\s*nombre\s*\}\}/gi, safe)
}

export async function sendMessage(
  merchantId: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = sessions.get(merchantId)
  if (!s || s.status !== 'ready' || !s.client) {
    console.log(`[wa-stub] ${merchantId} → ${to}: ${text}`)
    return { ok: false, error: 'sesión no conectada' }
  }
  try {
    await s.client.sendMessage(toChatId(to), text)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/**
 * Envía una campaña de mensajes con rate-limit anti-ban (random 2-5s entre
 * cada envío) y publica progreso por SSE.
 *
 * Si el cliente no está conectado, devuelve error sin enviar nada.
 */
export async function sendCampaign(
  merchantId: string,
  campaignId: string,
  recipients: CampaignRecipient[],
  text: string,
  onEach?: (i: number, ok: boolean, error?: string) => Promise<void>,
): Promise<{ sentCount: number; failedCount: number }> {
  const s = sessions.get(merchantId)
  if (!s || s.status !== 'ready' || !s.client) {
    // Stub SOLO en dev/QA (sin whatsapp-web.js): simula los envíos para probar el
    // flujo. En PRODUCCIÓN NUNCA fingimos éxito: si la sesión no está conectada,
    // tiramos error — reportar "enviado" sin enviar engañaría al comercio.
    if (!WAClient && process.env.NODE_ENV !== 'production') {
      let sent = 0
      let failed = 0
      for (let i = 0; i < recipients.length; i++) {
        sent += 1
        await onEach?.(i, true)
        publish({
          type: 'campaign.progress',
          merchantId,
          campaignId,
          sent,
          failed,
          total: recipients.length,
        })
        await sleep(50)
      }
      publish({
        type: 'campaign.done',
        merchantId,
        campaignId,
        sentCount: sent,
        failedCount: failed,
      })
      return { sentCount: sent, failedCount: failed }
    }
    throw new Error('sesión no conectada')
  }

  let sent = 0
  let failed = 0
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    try {
      // Personalizamos {{nombre}} por cada destinatario (no el nombre del 1º a todos).
      await s.client.sendMessage(toChatId(r.to), personalizar(text, r.nombre))
      sent += 1
      await onEach?.(i, true)
    } catch (err: any) {
      failed += 1
      await onEach?.(i, false, err?.message ?? String(err))
    }
    publish({
      type: 'campaign.progress',
      merchantId,
      campaignId,
      sent,
      failed,
      total: recipients.length,
    })
    // Rate limit anti-ban: delay aleatorio 2-5s entre cada mensaje.
    // WhatsApp banea cuentas que mandan mensajes en ráfaga.
    if (i < recipients.length - 1) {
      await sleep(2000 + Math.random() * 3000)
    }
  }

  publish({
    type: 'campaign.done',
    merchantId,
    campaignId,
    sentCount: sent,
    failedCount: failed,
  })
  return { sentCount: sent, failedCount: failed }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
