/**
 * WhatsApp Web service — usa whatsapp-web.js + LocalAuth (Puppeteer).
 *
 * Ciclo de vida:
 *   - getClient(merchantId) → instancia un Client con sesión persistida en disco
 *   - on('qr') → guarda el QR en memoria para que el comercio lo escanee desde su panel
 *   - on('ready') → marcamos la sesión como conectada
 *   - sendMessage(merchantId, to, text)
 *
 * NOTA: requiere `pnpm add whatsapp-web.js qrcode-terminal` (Puppeteer headless).
 * Si la dependencia no está instalada, el servicio funciona en modo "stub" y
 * loguea los mensajes en consola.
 */

import path from 'node:path'
import { env } from '@/env'

type ClientStatus = 'disconnected' | 'qr' | 'authenticating' | 'ready' | 'error'

type SessionState = {
  status: ClientStatus
  qr?: string
  lastError?: string
  client?: any
}

const sessions = new Map<string, SessionState>()
let WAClient: any = null
let LocalAuth: any = null
let waLoadAttempted = false

async function loadWA() {
  if (waLoadAttempted) return
  waLoadAttempted = true
  try {
    // Dependencia opcional: si no está instalada, corremos en modo stub.
    // Usamos un import dinámico con specifier indirecto para que tsc no
    // intente resolver el módulo en compile-time.
    const moduleName = 'whatsapp-web.js'
    const wa: any = await import(/* @vite-ignore */ moduleName)
    WAClient = wa.Client
    LocalAuth = wa.LocalAuth
  } catch {
    console.warn('[wa] whatsapp-web.js no instalado; servicio en modo stub')
  }
}

export async function getStatus(merchantId: string): Promise<SessionState> {
  await loadWA()
  return sessions.get(merchantId) ?? { status: 'disconnected' }
}

export async function startSession(merchantId: string): Promise<SessionState> {
  await loadWA()
  const existing = sessions.get(merchantId)
  if (existing && existing.client) return existing

  if (!WAClient || !LocalAuth) {
    const stub: SessionState = { status: 'qr', qr: 'STUB_QR_PLACEHOLDER' }
    sessions.set(merchantId, stub)
    return stub
  }

  const dataPath = path.join(env.WHATSAPP_SESSIONS_DIR, merchantId)
  const client = new WAClient({
    authStrategy: new LocalAuth({ clientId: merchantId, dataPath }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
  })
  client.on('authenticated', () => {
    const s = sessions.get(merchantId)
    if (s) s.status = 'authenticating'
  })
  client.on('ready', () => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'ready'
      s.qr = undefined
    }
  })
  client.on('disconnected', () => {
    sessions.delete(merchantId)
  })
  client.on('auth_failure', (err: any) => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'error'
      s.lastError = String(err)
    }
  })

  client.initialize().catch((err: any) => {
    const s = sessions.get(merchantId)
    if (s) {
      s.status = 'error'
      s.lastError = err?.message ?? String(err)
    }
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
  // wa: el formato es ${numero}@c.us (sin + y solo dígitos)
  const normalized = to.replace(/\D/g, '')
  const chatId = `${normalized}@c.us`
  try {
    await s.client.sendMessage(chatId, text)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}
