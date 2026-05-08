import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireMerchantAuth } from '@/middleware/auth'
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
  let sentCount = 0
  let failedCount = 0
  for (const to of parsed.data.recipients) {
    const result = await wa.sendMessage(auth.merchantId, to, parsed.data.text)
    if (result.ok) sentCount += 1
    else failedCount += 1
    await WaSend.create({
      merchantId: auth.merchantId,
      to,
      text: parsed.data.text,
      ok: result.ok,
      error: result.error,
      campaignId,
    })
  }

  return c.json({
    ok: true,
    campaign: { id: campaignId, sentCount, failedCount },
    quota: {
      used: used + 1,
      max: MAX_CAMPAIGNS_PER_MONTH,
      remaining: Math.max(0, MAX_CAMPAIGNS_PER_MONTH - used - 1),
    },
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
