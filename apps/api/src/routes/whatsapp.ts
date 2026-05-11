import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireMerchantAuth } from '@/middleware/auth'
import { verifyAccessToken } from '@/services/jwt.service'
import { WaSend } from '@/models'
import * as wa from '@/services/whatsapp.service'

export const whatsappRoutes = new Hono()

const MAX_CAMPAIGNS_PER_MONTH = 4

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function campaignsThisMonth(merchantId: string): Promise<number> {
  const since = startOfMonth()
  const ids = await WaSend.distinct('campaignId', {
    merchantId,
    sentAt: { $gte: since },
    campaignId: { $ne: null },
  })
  return ids.filter(Boolean).length
}

// GET /wa/status — estado de la sesión + QR si está pendiente + cupo
whatsappRoutes.get('/status', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const state = await wa.getStatus(auth.merchantId)
  const used = await campaignsThisMonth(auth.merchantId)
  return c.json({
    ok: true,
    status: state.status,
    qr: state.qr,
    lastError: state.lastError,
    quota: {
      used,
      max: MAX_CAMPAIGNS_PER_MONTH,
      remaining: Math.max(0, MAX_CAMPAIGNS_PER_MONTH - used),
    },
  })
})

// POST /wa/start — iniciar sesión (genera QR)
whatsappRoutes.post('/start', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const state = await wa.startSession(auth.merchantId)
  return c.json({
    ok: true,
    status: state.status,
    qr: state.qr,
  })
})

// POST /wa/stop
whatsappRoutes.post('/stop', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  await wa.stopSession(auth.merchantId)
  return c.json({ ok: true })
})

// POST /wa/send — enviar mensaje a un destinatario (cuenta como "ad-hoc",
// no consume cupo de campaña a menos que se mande campaignId).
const sendSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1).max(2000),
  campaignId: z.string().optional(),
})
whatsappRoutes.post('/send', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const result = await wa.sendMessage(auth.merchantId, parsed.data.to, parsed.data.text)
  await WaSend.create({
    merchantId: auth.merchantId,
    to: parsed.data.to,
    text: parsed.data.text,
    ok: result.ok,
    error: result.error,
    campaignId: parsed.data.campaignId,
  })
  return c.json({ ok: result.ok, error: result.error })
})

// POST /wa/campaign — envío masivo. Una sola request, el server itera.
//   - Verifica cupo mensual (4 campañas/mes)
//   - Loguea cada send individual con el mismo campaignId
//   - Devuelve resumen
const campaignSchema = z.object({
  recipients: z.array(z.string().min(8)).min(1).max(500),
  text: z.string().min(1).max(2000),
})
whatsappRoutes.post('/campaign', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = campaignSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const used = await campaignsThisMonth(auth.merchantId)
  if (used >= MAX_CAMPAIGNS_PER_MONTH) {
    return c.json(
      {
        ok: false,
        error: `cupo mensual agotado (${MAX_CAMPAIGNS_PER_MONTH} campañas/mes)`,
        quota: { used, max: MAX_CAMPAIGNS_PER_MONTH, remaining: 0 },
      },
      429,
    )
  }

  const campaignId = `c-${randomBytes(8).toString('hex')}`
  const merchantId = auth.merchantId

  // Disparamos la campaña con rate-limit anti-ban. Cada envío:
  //  - emite progreso vía SSE pub/sub (publish 'campaign.progress')
  //  - persiste el send individual en WaSend para historial/quota
  // Si la sesión WA no está conectada, sendCampaign tira error y el cliente
  // ve un 503.
  let result: { sentCount: number; failedCount: number }
  try {
    result = await wa.sendCampaign(
      merchantId,
      campaignId,
      parsed.data.recipients,
      parsed.data.text,
      async (i, ok, error) => {
        await WaSend.create({
          merchantId,
          to: parsed.data.recipients[i],
          text: parsed.data.text,
          ok,
          error,
          campaignId,
        })
      },
    )
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: err?.message ?? 'no pudimos enviar la campaña',
      },
      503,
    )
  }

  return c.json({
    ok: true,
    campaign: { id: campaignId, sentCount: result.sentCount, failedCount: result.failedCount },
    quota: {
      used: used + 1,
      max: MAX_CAMPAIGNS_PER_MONTH,
      remaining: Math.max(0, MAX_CAMPAIGNS_PER_MONTH - used - 1),
    },
  })
})

/**
 * GET /wa/stream — Server-Sent Events para que el panel del comercio reciba
 * en tiempo real:
 *   - eventos `qr` cuando WhatsApp genera/refresca el código (se renueva cada
 *     ~20s mientras nadie escanee)
 *   - eventos `status` cuando la sesión pasa por authenticating → ready o se
 *     desconecta
 *   - `campaign.progress` con `{sent, failed, total}` durante un envío masivo
 *   - `campaign.done` al cierre
 *
 * El navegador no puede setear Authorization en EventSource, así que el JWT
 * viaja por query string `?token=…` (HTTPS-only en prod).
 */
whatsappRoutes.get('/stream', (c) => {
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
    let alive = true
    const send = async (event: any) => {
      if (!alive) return
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
          id: String(Date.now()),
        })
      } catch {
        alive = false
      }
    }
    const unsubscribe = wa.subscribe(merchantId, (e) => void send(e))

    // Push estado inicial inmediatamente para que el cliente no espere
    const initial = await wa.getStatus(merchantId)
    await send({
      type: 'status',
      merchantId,
      status: initial.status,
      lastError: initial.lastError,
    })
    if (initial.qr) await send({ type: 'qr', merchantId, qr: initial.qr })

    // Heartbeat cada 25s contra timeout de proxies
    while (alive) {
      await stream.sleep(25_000)
      if (!alive) break
      try {
        await stream.writeSSE({ event: 'heartbeat', data: String(Date.now()) })
      } catch {
        alive = false
      }
    }
    unsubscribe()
  })
})

// GET /wa/campaigns — historial de campañas del comercio
whatsappRoutes.get('/campaigns', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sends = await WaSend.find({
    merchantId: auth.merchantId,
    campaignId: { $ne: null },
  })
    .sort({ sentAt: -1 })
    .limit(500)

  // Agrupamos por campaignId
  const byCampaign = new Map<
    string,
    { id: string; sentAt: Date; sentCount: number; failedCount: number; text: string }
  >()
  for (const s of sends) {
    if (!s.campaignId) continue
    const existing = byCampaign.get(s.campaignId)
    if (existing) {
      if (s.ok) existing.sentCount += 1
      else existing.failedCount += 1
      if (s.sentAt > existing.sentAt) existing.sentAt = s.sentAt
    } else {
      byCampaign.set(s.campaignId, {
        id: s.campaignId,
        sentAt: s.sentAt,
        sentCount: s.ok ? 1 : 0,
        failedCount: s.ok ? 0 : 1,
        text: s.text,
      })
    }
  }
  const campaigns = [...byCampaign.values()]
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, 50)
    .map((c) => ({ ...c, sentAt: c.sentAt.toISOString() }))

  return c.json({ ok: true, campaigns })
})
