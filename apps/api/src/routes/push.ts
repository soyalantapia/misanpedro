import { Hono } from 'hono'
import { z } from 'zod'
import { PushSubscription } from '@/models'
import { env } from '@/env'
import { tenantContext, getAppId } from '@/middleware/tenant'

export const pushRoutes = new Hono()

pushRoutes.use('*', tenantContext)

// Clave pública VAPID para que el frontend pueda suscribirse.
pushRoutes.get('/vapid-public', (c) =>
  c.json({ ok: true, key: env.VAPID_PUBLIC_KEY ?? null }),
)

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  categories: z.array(z.string()).optional().default([]),
})

pushRoutes.post('/subscribe', async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid input', issues: parsed.error.format() }, 400)
  }
  const { subscription, categories } = parsed.data
  // Scopeado por (appId, endpoint): un mismo browser puede suscribirse a varias
  // ciudades, y un cliente de otro tenant no puede pisar/robar esta suscripción.
  await PushSubscription.findOneAndUpdate(
    { appId, endpoint: subscription.endpoint },
    {
      appId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      categories,
      userAgent: c.req.header('user-agent'),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return c.json({ ok: true })
})

const unsubscribeSchema = z.object({ endpoint: z.string().url() })

pushRoutes.post('/unsubscribe', async (c) => {
  const appId = getAppId(c)
  const body = await c.req.json().catch(() => ({}))
  const parsed = unsubscribeSchema.safeParse(body)
  if (parsed.success) {
    await PushSubscription.deleteOne({ appId, endpoint: parsed.data.endpoint })
  }
  return c.json({ ok: true })
})
