import { Hono } from 'hono'
import { z } from 'zod'
import { requireMerchantAuth } from '@/middleware/auth'
import * as wa from '@/services/whatsapp.service'

export const whatsappRoutes = new Hono()

// GET /wa/status — estado de la sesión + QR si está pendiente
whatsappRoutes.get('/status', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const state = await wa.getStatus(auth.merchantId)
  return c.json({
    ok: true,
    status: state.status,
    qr: state.qr,
    lastError: state.lastError,
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

// POST /wa/send — enviar mensaje (opcional, generalmente lo dispara el sistema)
const sendSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1).max(2000),
})
whatsappRoutes.post('/send', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)
  const result = await wa.sendMessage(auth.merchantId, parsed.data.to, parsed.data.text)
  return c.json({ ok: result.ok, error: result.error })
})
