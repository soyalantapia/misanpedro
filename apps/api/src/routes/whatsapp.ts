import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { toWhatsappDigits } from '@misanpedro/shared'
import { requireMerchantAuth, requireMerchantActive } from '@/middleware/auth'
import { tenantContext, getAppId } from '@/middleware/tenant'
import { resolveSseMerchant, signSseTicket } from '@/services/jwt.service'
import { WaSend } from '@/models'
import * as wa from '@/services/whatsapp.service'

export const whatsappRoutes = new Hono()

// El SSE /stream NO usa tenantContext (token viene por query, no header).
// El resto sí. Aplicamos al final, después de declarar /stream.

const MAX_CAMPAIGNS_PER_MONTH = 4

/**
 * Campañas corriendo en background, por comercio. El envío es async (202) porque
 * dura minutos; acá guardamos la promesa para (a) rechazar un segundo envío del
 * mismo comercio y (b) poder esperarla desde tests o un shutdown ordenado.
 * [cazabug S9-01]
 */
const campaignsInFlight = new Map<string, Promise<void>>()

/** Espera a que termine la campaña en curso de un comercio (tests / shutdown). */
export function awaitCampaign(merchantId: string): Promise<void> {
  return campaignsInFlight.get(merchantId) ?? Promise.resolve()
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function campaignsThisMonth(appId: ReturnType<typeof getAppId>, merchantId: string): Promise<number> {
  const since = startOfMonth()
  const ids = await WaSend.distinct('campaignId', {
    appId,
    merchantId,
    sentAt: { $gte: since },
    campaignId: { $ne: null },
  })
  return ids.filter(Boolean).length
}

/**
 * GET /wa/ticket — ticket efímero (60s) para abrir el stream sin poner el access
 * token en la URL. Autenticado por header. NO requiere tenantContext.
 */
whatsappRoutes.get('/ticket', requireMerchantAuth, (c) => {
  const auth = c.get('auth') as { merchantId?: string }
  if (!auth?.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  return c.json({ ok: true, ticket: signSseTicket(auth.merchantId) })
})

/**
 * GET /wa/stream — Server-Sent Events. Preferimos `?ticket=` efímero; aceptamos
 * `?token=` legacy por compat con bundles cacheados. NO requiere tenantContext
 * (hace pub/sub interno por merchantId).
 */
whatsappRoutes.get('/stream', (c) => {
  const merchantId = resolveSseMerchant(c.req.query('ticket'), c.req.query('token'))
  if (!merchantId) return c.json({ ok: false, error: 'invalid ticket' }, 401)

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

    // El cliente se fue (cerró la pestaña, perdió señal, se durmió el celular).
    // Es LA señal buena: el `catch { alive = false }` de abajo no sirve porque el
    // `write` de Hono se traga todos los errores, así que el loop giraba para
    // siempre y este unsubscribe no corría nunca. Con el EventSource reconectando
    // solo, cada bajón de señal dejaba otro listener colgado. [cazabug loop2]
    stream.onAbort(() => {
      alive = false
      unsubscribe()
    })

    const initial = await wa.getStatus(merchantId)
    await send({
      type: 'status',
      merchantId,
      status: initial.status,
      lastError: initial.lastError,
    })
    if (initial.qr) await send({ type: 'qr', merchantId, qr: initial.qr })

    while (alive && !stream.aborted) {
      await stream.sleep(25_000)
      if (!alive || stream.aborted) break
      try {
        await stream.writeSSE({ event: 'heartbeat', data: String(Date.now()) })
      } catch {
        alive = false
      }
    }
    unsubscribe()
  })
})

// Resto requieren tenant context
whatsappRoutes.use('*', tenantContext)

whatsappRoutes.get('/status', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const state = await wa.getStatus(auth.merchantId)
  const used = await campaignsThisMonth(appId, auth.merchantId)
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

whatsappRoutes.post('/start', requireMerchantAuth, requireMerchantActive, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const state = await wa.startSession(auth.merchantId)
  return c.json({
    ok: true,
    status: state.status,
    qr: state.qr,
  })
})

whatsappRoutes.post('/stop', requireMerchantAuth, async (c) => {
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  await wa.stopSession(auth.merchantId)
  return c.json({ ok: true })
})

const sendSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1).max(2000),
  campaignId: z.string().optional(),
})
whatsappRoutes.post('/send', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  // El destino se guarda en forma canónica LOCAL; WhatsApp exige el internacional
  // completo. Sin reponer el país, el envío falla siempre. [cazabug S9-07]
  const tenant = c.get('tenant') as { phonePrefix?: string } | undefined
  const to = toWhatsappDigits(parsed.data.to, tenant?.phonePrefix)
  if (!to) {
    return c.json({ ok: false, error: 'número inválido: no pudimos armar el WhatsApp' }, 400)
  }

  const result = await wa.sendMessage(auth.merchantId, to, parsed.data.text)
  await WaSend.create({
    appId,
    merchantId: auth.merchantId,
    to,
    text: parsed.data.text,
    ok: result.ok,
    error: result.error,
    campaignId: parsed.data.campaignId,
  })
  return c.json({ ok: result.ok, error: result.error })
})

const campaignSchema = z.object({
  // Cada destinatario lleva su nombre para personalizar {{nombre}} en el backend.
  //
  // `to` se acepta como string NO vacío y nada más: quién es enviable lo decide
  // toWhatsappDigits más abajo, que sabe de códigos de país. Antes acá se exigía
  // min(8) por destinatario, y como Zod valida el array entero, un solo cliente
  // con el teléfono mal cargado tiraba TODA la campaña con un "invalid input"
  // incomprensible — sin mandarle a nadie y sin que el skippedCount (que existe
  // justamente para reportar esos casos) llegara a correr. [cazabug loop2]
  recipients: z
    .array(z.object({ to: z.string().trim().min(1), nombre: z.string().max(80).optional() }))
    .min(1)
    .max(500),
  text: z.string().min(1).max(2000),
})
whatsappRoutes.post('/campaign', requireMerchantAuth, requireMerchantActive, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const parsed = campaignSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'invalid input' }, 400)

  const used = await campaignsThisMonth(appId, auth.merchantId)
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

  // Los teléfonos de los vecinos están en forma canónica LOCAL (sin país): hay que
  // reponer el prefijo del tenant o WhatsApp rechaza TODOS los envíos. Los que no
  // se pueden normalizar se informan como OMITIDOS — nunca como enviados.
  // [cazabug S9-07]
  const tenant = c.get('tenant') as { phonePrefix?: string } | undefined
  const recipients: { to: string; nombre?: string }[] = []
  let skippedCount = 0
  for (const r of parsed.data.recipients) {
    const to = toWhatsappDigits(r.to, tenant?.phonePrefix)
    if (!to) {
      skippedCount++
      continue
    }
    recipients.push({ to, nombre: r.nombre })
  }
  if (recipients.length === 0) {
    return c.json(
      { ok: false, error: 'ningún número de la lista es válido para WhatsApp', skippedCount },
      400,
    )
  }

  // Una campaña por comercio a la vez: si el comercio vuelve a apretar "enviar",
  // no arrancamos un segundo lote sobre los mismos vecinos. [cazabug S9-01]
  if (campaignsInFlight.has(merchantId)) {
    return c.json({ ok: false, error: 'ya hay una campaña en curso' }, 409)
  }
  // Validamos ANTES de aceptar: un 202 que nunca envía sería peor que el error.
  if (!wa.isSendable(merchantId)) {
    return c.json({ ok: false, error: 'la sesión de WhatsApp no está conectada' }, 503)
  }

  // 202 ASYNC: el envío lleva 2-5s por mensaje (hasta ~29 min con 500 vecinos).
  // Antes el handler hacía `await sendCampaign(...)` y el HTTP quedaba colgado toda
  // la campaña: el browser/proxy cortaba por timeout, la UI mostraba un error falso
  // mientras el server seguía enviando, y el reintento duplicaba envíos y cupo.
  // Ahora respondemos de una y el progreso/cierre viaja por SSE
  // (campaign.progress / campaign.done), que el front ya escucha. [cazabug S9-01]
  const run = (async () => {
    try {
      await wa.sendCampaign(
        merchantId,
        campaignId,
        recipients,
        parsed.data.text,
        async (i, ok, error) => {
          await WaSend.create({
            appId,
            merchantId,
            to: recipients[i].to,
            text: parsed.data.text,
            ok,
            error,
            campaignId,
          })
        },
      )
    } catch (err: any) {
      // El front se entera por SSE (no hay HTTP al que responderle).
      console.error('[wa-campaign]', campaignId, err?.message ?? err)
    } finally {
      campaignsInFlight.delete(merchantId)
    }
  })()
  campaignsInFlight.set(merchantId, run)

  return c.json(
    {
      ok: true,
      campaign: {
        id: campaignId,
        // La campaña ARRANCÓ: el resultado final llega por SSE campaign.done.
        total: recipients.length,
        // Números que no pudimos normalizar a E.164: no se enviaron. Se informan
        // aparte para no inflar el total con envíos que nunca van a ocurrir.
        skippedCount,
      },
      quota: {
        used: used + 1,
        max: MAX_CAMPAIGNS_PER_MONTH,
        remaining: Math.max(0, MAX_CAMPAIGNS_PER_MONTH - used - 1),
      },
    },
    202,
  )
})

whatsappRoutes.get('/campaigns', requireMerchantAuth, async (c) => {
  const appId = getAppId(c)
  const auth = c.get('auth')
  if (!auth.merchantId) return c.json({ ok: false, error: 'forbidden' }, 403)
  const sends = await WaSend.find({
    appId,
    merchantId: auth.merchantId,
    campaignId: { $ne: null },
  })
    .sort({ sentAt: -1 })
    .limit(500)

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
